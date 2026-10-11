DeckitModule.define("deckit/feature/panel/main", {
  uses: [
    "deckit/module/log",
    "deckit/service/log",
    "deckit/feature/window/main",
    "deckit/service/web/server",
    "deckit/service/open/server",
    "deckit/service/keymap/server",
    "deckit/feature/panel/model/protocol",
  ],
  provides: ["connect", "deck", "pageView", "page", "awaitPage"],
}, (LOG, log, FRAME, WEB, OPEN, KEYMAP, PROTOCOL) => {
  const { app } = require("electron");
  const fs = require("fs");

  // Every listener runs in main, where an uncaught exception ends the app, so all go through guard.
  const { guard } = LOG;
  const { keep } = log;

  const panel = {
    view: null, wc: null,
    theme: null,
    // Only the shell changes it (show, hide), so it never disagrees with what the shell believes.
    shown: false,
    /* floating: drawn over something, rounded and ringed. dismissible: Escape with nothing else to
       close puts it away. */
    look: { floating: false, dismissible: false },
  };

  const toPanel = (end, payload) => { if (panel.wc) end.send(panel.wc, payload); };
  let assets = null;
  let shell = null;

  /* Main waits on the page only for an exit before a view moves and a fade-out before it goes off
     screen; the timeout guards a page that is gone or wedged. A wait is answered only by its own
     token: otherwise, after a close, an open and a close in quick succession, the first fade's reply
     would answer the second wait and take the view away mid-fade. A newer wait on the same reply
     replaces the older, which runs `superseded` instead of `next`. */
  const PANEL_REPLY_TIMEOUT = 400;
  let replySeq = 0;
  const waiting = new Map();   // reply -> the wait in progress for it
  const heard = new Set();     // replies listened to

  const awaitPage = (wc, reply, next, { superseded = null } = {}) => {
    waiting.get(reply)?.drop();
    if (!wc || wc.isDestroyed()) { next(); return null; }
    if (!heard.has(reply)) {
      heard.add(reply);
      reply.hear(({ token }, sender) => waiting.get(reply)?.answer(sender, token));
    }
    const token = ++replySeq;
    let done = false;
    const finish = (run) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (waiting.get(reply) === wait) waiting.delete(reply);
      run?.();
    };
    const timer = setTimeout(() => finish(next), PANEL_REPLY_TIMEOUT);
    const wait = {
      drop: () => finish(superseded),
      answer: (sender, answered) => { if (sender === wc && answered === token) finish(next); },
    };
    waiting.set(reply, wait);
    return token;
  };

  // The page cannot tell its role (one bundle, two pages), so panel-setup answers the one it was built for.
  const roles = new Map();   // webContents.id -> "panel" | "switcher"
  // Whether one of the other pages (the switcher, in front) has the keyboard.
  const anotherPageHasKeyboard = () => [...roles].some(([id, role]) => {
    if (role === "panel") return false;
    const wc = require("electron").webContents.fromId(id);
    try { return !!wc && !wc.isDestroyed() && wc.isFocused(); } catch { return false; }
  });

  // The page's own idea of whether it is up (didAppear, live keys, entrance and exit) must never part from this one.
  const setShown = (on, token) => {
    panel.shown = on;
    toPanel(PROTOCOL.visible, { open: on, token });
  };
  // Hiding waits for the page: a view taken off screen mid-fade vanishes instead of closing.
  const show = () => {
    if (!panel.view) return;
    const was = panel.shown;
    panel.view.setVisible(true);
    if (!was) setShown(true);
    /* Showing over an app does not move focus off the app's document, so the app's chords would still
       answer under the panel. Only on the way in: a later click into the app is the person's. */
    if (!was && !anotherPageHasKeyboard()) focus();
  };
  /* True when the panel had the keyboard as it went: a hidden view keeps its focus and goes on
     taking keystrokes, so the shell has to give it back. False when a click in the app took it already. */
  const hide = () => new Promise((resolve) => {
    if (!panel.view || !panel.shown) { resolve(false); return; }
    // Put away while it is leaving for another window: the move is called off (leave resolves false).
    waiting.get(PROTOCOL.played)?.drop();
    const token = awaitPage(panel.wc, PROTOCOL.hidden, () => {
      if (!panel.view || panel.shown) { resolve(false); return; }
      const held = !!panel.wc && !panel.wc.isDestroyed() && WEB.holdsKeyboard(panel.wc);
      panel.view.setVisible(false);
      resolve(held);
    });
    setShown(false, token);
  });
  const focus = () => { try { if (panel.wc && !panel.wc.isDestroyed()) panel.wc.focus(); } catch {} };

  /* A move keeps the panel up the whole way, joined by leaving as it closes and arriving as it opens.
     leave() resolves false when it was put away on the way or a newer leave replaced it, and then the
     move is off. A view whose window already went has no exit to play. */
  const leave = () => new Promise((resolve) => {
    if (!panel.shown || !panel.wc || panel.wc.isDestroyed()) { resolve(true); return; }
    const token = awaitPage(panel.wc, PROTOCOL.played, () => resolve(true), { superseded: () => resolve(false) });
    toPanel(PROTOCOL.play, { direction: "out", token });
  });
  const arrive = () => {
    show();
    toPanel(PROTOCOL.play, { direction: "in" });
  };

  const present = (look) => {
    panel.look = {
      floating: !!look?.floating,
      dismissible: !!look?.dismissible,
    };
    toPanel(PROTOCOL.look, panel.look);
  };

  // One answer, so the bar of the panel's window and the windows its pages open cannot drift apart.
  const windowStyle = () => (panel.theme ? {
    background: panel.theme.sidebarBg || panel.theme.contentBg,
    color: panel.theme.sidebarStrong || panel.theme.sidebarColor,
    font: panel.theme.font,
  } : {});

  /* The window is glass because the panel is: a coloured window under it would make the panel solid
     in one place and not the other. onClose runs once the view is out of the window, and the view
     waits, unplaced and still up, for the shell to place or hide it. */
  const presentInWindow = async ({ key, title, boundsKey, onClose } = {}) => {
    const there = FRAME.get(key);
    if (there) { FRAME.raise(there); return there; }
    buildPanel();
    const view = panel.view;
    if (!view || !(await leave())) return null;
    const win = FRAME.open({
      key, title, boundsKey, view, glass: true,
      barStyle: windowStyle(),
      // So its plugins can step out from under the bar.
      onShown: (px) => toPanel(PROTOCOL.bar, { inset: Number(px) || 0 }),
      afterDetach: () => onClose?.(),
    });
    if (!win) return null;
    present({ floating: false, dismissible: false });
    arrive();
    return win;
  };

  /* Only the panel shows web pages, so only it may hold a <webview>, and always through WEB.host,
     which strips what a page element could inherit (this preload, with its IPC). */
  const pageView = (role) => {
    const { WebContentsView } = require("electron");
    if (!assets || !fs.existsSync(assets.preload)) {
      console.error("[deckit] the panel's page is not where the app says it is; was it built?");
      return null;
    }
    const view = new WebContentsView({
      webPreferences: {
        preload: assets.preload,
        contextIsolation: true,
        sandbox: assets.sandbox,
        webviewTag: role === "panel",
        transparent: true,
      },
    });
    view.setBackgroundColor("#00000000");
    view.setVisible(false);
    const id = view.webContents.id;
    roles.set(id, role);
    guard(view.webContents, "destroyed", () => roles.delete(id), { once: true });
    // Ours, for the log to keep what it says.
    keep(view.webContents);
    if (role === "panel") WEB.host(view.webContents, { style: windowStyle });
    assets.load(view.webContents);
    return view;
  };

  // Built once, the first time it is asked for, and moved from then on.
  const buildPanel = () => {
    if (panel.view) return;
    const view = pageView("panel");
    if (!view) return;
    panel.view = view;
    panel.wc = view.webContents;
    const takeWindowOpen = () => {
      try {
        view.webContents.setWindowOpenHandler((details) => {
          // Every scheme: which ones open, and how, is open's to say, not this handler's.
          OPEN.open(view.webContents, details.url || "", WEB.windowOptions(details));
          return { action: "deny" };
        });
      } catch {}
    };
    takeWindowOpen();
    /* Set again once the page is up: the app may set its own handler a tick after
       `web-contents-created`, and the last one set wins. After every load, since a theme change
       reloads this view. */
    guard(view.webContents, "did-finish-load", takeWindowOpen);

    guard(view.webContents, "destroyed", () => { panel.view = null; panel.wc = null; panel.shown = false; });
  };

  // Both pages are rebuilt for a new theme; a switcher that is up closes as its page goes.
  const setTheme = (theme) => {
    const changed = JSON.stringify(theme) !== JSON.stringify(panel.theme);
    panel.theme = theme;
    if (!changed) return;
    const { webContents } = require("electron");
    for (const id of roles.keys()) {
      const wc = webContents.fromId(id);
      if (wc && !wc.isDestroyed()) wc.reload();
    }
  };

  // A web page a plugin shows counts as the panel; anything else is the shell's to answer.
  const surface = (wc) => (WEB.hostOf(wc) === panel.wc ? panel.wc : wc);
  const showsPanel = (wc) => {
    if (!panel.wc || panel.wc.isDestroyed() || !panel.shown) return false;
    try { return !!shell?.showsPanel(surface(wc)); } catch (e) { console.error("[deckit] the shell's showsPanel threw", e); return false; }
  };

  /* On re-activation Electron hands the keyboard to the window's own document, not to the panel's
     view inside it, so role-based menu items (copy, paste) would miss the panel. Restoring focus only
     when the panel held it before cannot be written: a WebContentsView emits no "focus", and by
     browser-window-blur every webContents is already blurred. Deferred a tick, because Electron
     focuses the window's own webContents as part of activating it. */
  guard(app, "browser-window-focus", (_e, win) => {
    if (!showsPanel(win.webContents)) return;
    setImmediate(() => {
      try { if (!win.isDestroyed() && win.isFocused()) focus(); } catch {}
    });
  });

  PROTOCOL.setup.answer((_payload, sender) => ({
    role: roles.get(sender.id) || "panel",
    theme: panel.theme, shown: panel.shown, look: panel.look,
  }));

  PROTOCOL.ready.hear(({ running }) => {
    console.log("[deckit] panel up with: " + (running.join(", ") || "nothing"));
    if (panel.shown) toPanel(PROTOCOL.visible, { open: true });
  });

  // Each leg names its sender: every page in this app shares one preload, so a channel with no
  // sender check is a channel any of them can speak on.
  const fromPanel = (fn) => (payload, sender) => { if (sender === panel.wc) fn(payload); };

  PROTOCOL.show.hear(fromPanel(() => shell?.reveal()));
  PROTOCOL.hide.hear(fromPanel(() => shell?.dismiss()));

  const summonSwitcher = (wc) => shell?.summonSwitcher(surface(wc));

  /* Escape is the panel's only where it puts the panel away (a panel over an app); in a window of
     its own, Escape belongs to what is in the window. */
  KEYMAP.connect({
    answersFor: (wc) => (showsPanel(wc) ? panel.wc : null),
    escape: (wc) => showsPanel(wc) && panel.look.dismissible,
    run: {
      "host.switcher": (wc) => summonSwitcher(wc),
    },
  });

  return Object.freeze({
    connect: ({ assets: a, shell: s }) => { assets = a; shell = s; },
    deck: Object.freeze({
      view: () => { buildPanel(); return panel.view; },
      show, hide, leave, arrive, focus, present, setTheme, presentInWindow,
      shown: () => panel.shown,
    }),
    pageView,
    page: () => (panel.wc && !panel.wc.isDestroyed() ? panel.wc : null),
    awaitPage,
  });
});
