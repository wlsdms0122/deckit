DeckitModule.define("deckit/service/web/server", {
  uses: [
    "deckit/service/storage/model/space",
    "deckit/service/web/server/agent",
    "deckit/service/web/server/pages",
    "deckit/service/web/server/session",
    "deckit/service/web/server/permission",
    "deckit/service/web/server/certificate",
    "deckit/service/web/server/shim",
    "deckit/service/web/model/protocol",
    // certificate.js is here for the handlers it sets up, not for anything it returns.
  ],
  provides: [
    "connect", "host", "windowOptions", "hostOf", "holdsKeyboard",
  ],
}, (SPACE, AGENT, PAGES, SESSION, PERMISSION, CERTIFICATE, SHIM, PROTOCOL) => {
  const { shell } = require("electron");

  // Deckit's window frame, handed in by connect before any page can open a window.
  let FRAME = null;

  // Also used for the panel's own pages (feature/panel/main.js), so the two cannot differ.
  const windowOptions = ({ disposition, frameName } = {}) => ({
    activates: disposition !== "background-tab",
    target: String(frameName || ""),
  });

  /* The one rule every load is held to. A file only in the panel, and only in a session whose space
     mayShowFile allows, asked at each load so a plugin updated without the permission loses it at once. */
  let mayShowFile = () => false;
  const mayShow = (partition, url, { inPanel }) => /^https?:\/\//i.test(url) || (inPanel && /^file:\/\//i.test(url)
    && !!partition && !!mayShowFile(SPACE.ownerOf(partition)));
  /* A file document never becomes a web one in its page: the session given to show files would keep
     the web's cookies. The web it asks for goes to whoever shows the page instead (leave). */
  const showsFile = (guest) => /^file:/i.test(guest.getURL() || "");
  const leavesFile = (guest, url) => showsFile(guest) && /^https?:/i.test(String(url || ""));

  /* A popup that states a size means to keep talking to its opener (a sign-in posts its result back
     through `window.opener`), so it stays Chromium's own window: only Chromium makes the opener link,
     and no API hands the contents to a view of ours. Not a child window: macOS fastens a child to its
     parent, and a sign-in window should go anywhere. */
  const popupWindow = (h, guest) => ({
    action: "allow",
    overrideBrowserWindowOptions: {
      // No size: the page asked for one and the features already carry it.
      backgroundColor: h.style().background || FRAME.FALLBACK_BG,
      titleBarStyle: "hidden",
      trafficLightPosition: FRAME.LIGHTS_AT,
      autoHideMenuBar: true,
      // In the opener's session, which is where the opener link has to be made.
      webPreferences: { session: guest.session, sandbox: true, contextIsolation: true, nodeIntegration: false },
    },
  });

  /* In a window, every page opened is a window: a consent step's popup posts its answer back to its
     opener, which a tab could not do. A file page's window would share its session, so it is asked
     of the delegate instead. The app may set its own window-open handler on every webContents a
     moment after it is made, and the last one set wins, so ours is set again as the page starts. */
  const holdWindowOpen = (h, guest, { inPanel }) => {
    const set = () => {
      try {
        guest.setWindowOpenHandler(({ url, disposition, frameName }) => {
          // An app's address opened as a window is the same question as one navigated to (mayOpenApp).
          if (!/^https?:\/\//i.test(url || "")) {
            PERMISSION.mayOpenApp(h, guest, url).then((ok) => { if (ok) shell.openExternal(url).catch(() => {}); });
            return { action: "deny" };
          }
          if ((!inPanel || disposition === "new-window") && !showsFile(guest)) return popupWindow(h, guest);
          PAGES.send(h, PROTOCOL.opens, { id: PAGES.get(guest.id)?.tab ?? guest.id, url, ...windowOptions({ disposition, frameName }) });
          return { action: "deny" };
        });
      } catch {}
    };
    set();
    setImmediate(set);
    guest.on("did-start-navigation", set);
  };

  const icons = new Map();   // page webContents id -> the icon it last announced
  const stateOf = (guest) => {
    const icon = icons.get(guest.id) || "";
    const history = guest.navigationHistory;
    return {
      url: guest.getURL() || "",
      title: guest.getTitle() || "",
      icon: icon || "",
      loading: guest.isLoading(),
      canGoBack: !!(history && history.canGoBack()),
      canGoForward: !!(history && history.canGoForward()),
      audible: guest.isCurrentlyAudible(),
      muted: guest.isAudioMuted(),
      capture: SHIM.captureOf(guest.id),
    };
  };

  const adopt = (h, guest, { inPanel }) => {
    const id = guest.id;
    guest.once("destroyed", () => icons.delete(id));
    const report = () => { if (!guest.isDestroyed()) PAGES.send(h, PROTOCOL.state, { id, state: stateOf(guest) }); };
    for (const event of ["did-start-loading", "did-stop-loading", "did-navigate-in-page", "page-title-updated", "did-fail-load", "audio-state-changed"]) {
      guest.on(event, report);
    }
    /* Wrapped because every load passes here, whoever starts it: page-do, or the element's src,
       which goes straight to loadURL. A link followed inside the page is will-navigate. */
    const load = guest.loadURL.bind(guest);
    guest.loadURL = (url, options) => {
      const to = String(url || "");
      if (leavesFile(guest, to)) { PAGES.send(h, PROTOCOL.leave, { id, url: to }); return Promise.resolve(); }
      return mayShow(SESSION.partitionOf(guest), to, { inPanel }) ? load(url, options) : Promise.resolve();
    };
    guest.on("will-navigate", (e, url) => {
      if (!leavesFile(guest, url)) return;
      e.preventDefault();
      PAGES.send(h, PROTOCOL.leave, { id, url: String(url) });
    });
    // A new document starts without the last one's icon or streams; it announces its own.
    guest.on("did-navigate", () => { icons.delete(id); SHIM.forget(id); report(); });
    guest.on("page-favicon-updated", (_e, list) => { icons.set(id, (list && list[0]) || ""); report(); });
    guest.on("found-in-page", (_e, r) => PAGES.send(h, PROTOCOL.found, {
      id, matches: r.matches | 0, active: r.activeMatchOrdinal | 0, final: !!r.finalUpdate,
    }));
    PAGES.own(guest, h, id, { inPanel });
    SHIM.bridge(h, guest, report);
    holdWindowOpen(h, guest, { inPanel });
    watchWindows(h, guest, id);
  };
  // A window the page opened answers to that page (`tab`), as do the windows it opens in turn.
  const watchWindows = (h, guest, tab) => {
    guest.on("did-create-window", (child) => {
      try { PAGES.own(child.webContents, h, tab); } catch {}
      try { FRAME.dress(child, h.style()); } catch (e) { console.error("[deckit] could not dress a page's window", e); }
      try { holdWindowOpen(h, child.webContents, { inPanel: false }); watchWindows(h, child.webContents, tab); } catch {}
    });
  };

  const hosts = new Map();   // the webContents of a page that holds pages -> what host() was told

  // `style()` is asked each time it is needed, because the panel changes theme.
  const host = (wc, { style }) => {
    const h = { wc, style };
    const wcId = wc.id;
    hosts.set(wcId, h);
    // A window page answers to the document that asked for it; a new document has no delegate for it.
    const closeWindows = () => { for (const w of windows.values()) if (w.h === h) w.win.close(); };
    wc.on("did-navigate", closeWindows);
    wc.once("destroyed", () => { hosts.delete(wcId); closeWindows(); });
    /* Decided here, not by the element: the panel's own preload would otherwise be inherited. Both
       spellings of the session are read, the attribute and webpreferences="partition=…" (in prefs);
       naming none would mean the app's own session. */
    wc.on("will-attach-webview", (e, prefs, params) => {
      delete prefs.preload;
      prefs.nodeIntegration = false;
      prefs.contextIsolation = true;
      prefs.sandbox = true;
      const partitions = [params.partition, prefs.partition].filter(Boolean);
      if (!partitions.length || partitions.some((p) => !SESSION.isSession(p))) { e.preventDefault(); return; }
      // Handed out here, so the page made in it is known to be in it (session.js).
      for (const p of partitions) SESSION.of(p);
      // Still made, but blank; a later load is held to the same rule.
      const src = String(params.src || "");
      if (src !== "about:blank" && !mayShow(partitions[0], src, { inPanel: true })) params.src = "about:blank";
    });
    wc.on("did-attach-webview", (_e, guest) => adopt(h, guest, { inPanel: true }));
  };

  /* Over the focused window, since asking was a click there, but not its child: macOS fastens a
     child window to its parent. */
  const windows = new Map();   // the window page's webContents id -> { win, h }
  PROTOCOL.window.answer(({ partition, url, title }, sender) => {
    const h = hosts.get(sender.id);
    if (!h || !SESSION.isSession(partition) || !mayShow(partition, url, { inPanel: false })) return 0;
    const { BrowserWindow } = require("electron");
    const opener = BrowserWindow.getFocusedWindow();
    const style = h.style() || {};
    const size = { width: 520, height: 700 };
    const at = opener && !opener.isDestroyed() ? opener.getBounds() : null;
    const win = new BrowserWindow({
      ...size, title,
      ...(at ? {
        x: Math.round(at.x + (at.width - size.width) / 2),
        y: Math.round(at.y + Math.max(0, (at.height - size.height) / 2)),
      } : {}),
      backgroundColor: style.background || FRAME.FALLBACK_BG,
      titleBarStyle: "hidden",
      trafficLightPosition: FRAME.LIGHTS_AT,
      autoHideMenuBar: true,
      webPreferences: { session: SESSION.of(partition), sandbox: true, contextIsolation: true, nodeIntegration: false },
    });
    const guest = win.webContents;
    const id = guest.id;
    windows.set(id, { win, h });
    win.on("closed", () => { windows.delete(id); PAGES.send(h, PROTOCOL.closed, { id }); });
    adopt(h, guest, { inPanel: false });
    try { FRAME.dress(win, style); } catch (err) { console.error("[deckit] could not dress a page's window", err); }
    guest.loadURL(url).catch(() => {});
    return id;
  });
  PROTOCOL.act.hear(({ id, op, arg }, sender) => {
    try {
      const { webContents } = require("electron");
      const h = PAGES.isTab(id) ? PAGES.get(id).h : null;
      const guest = webContents.fromId(id);
      if (!h || h.wc !== sender || !guest || guest.isDestroyed()) return;
      const history = guest.navigationHistory;
      if (op === "load") guest.loadURL(String(arg || "")).catch(() => {});
      else if (op === "back" && history.canGoBack()) history.goBack();
      else if (op === "forward" && history.canGoForward()) history.goForward();
      else if (op === "reload") guest.reload();
      else if (op === "stop") guest.stop();
      else if (op === "state") PAGES.send(h, PROTOCOL.state, { id, state: stateOf(guest) });
      else if (op === "notification-click") SHIM.notificationClicked(guest, arg);
      else if (op === "mute") { guest.setAudioMuted(!!arg); PAGES.send(h, PROTOCOL.state, { id, state: stateOf(guest) }); }
      else if (op === "close") windows.get(id)?.win.close();
      // Electron's findNext is true for a new search (`start`), false to move to the next match.
      else if (op === "find" && arg && String(arg.text || "")) {
        guest.findInPage(String(arg.text), { forward: !arg.back, findNext: !!arg.start, matchCase: !!arg.matchCase });
      }
      else if (op === "find-stop") guest.stopFindInPage(arg === "keep" ? "keepSelection" : "clearSelection");
    } catch (err) { console.error("[deckit] page request failed", err); }
  });

  const inPanel = (wc) => {
    const p = wc && PAGES.get(wc.id);
    return p && p.inPanel && p.tab === wc.id ? p.h?.wc || null : null;
  };

  return {
    connect: ({ mayShowFile: answer, agent = [], frame } = {}) => {
      if (typeof answer === "function") mayShowFile = answer;
      FRAME = frame;
      AGENT.hideFromAgent(agent);
    },
    host,
    windowOptions,
    // So a keystroke in a web page is routed as if it were in the panel's document.
    hostOf: inPanel,
    holdsKeyboard: (wc) => {
      const { webContents } = require("electron");
      const all = [wc, ...[...PAGES.entries()].filter(([id, p]) => p.inPanel && p.tab === id && p.h?.wc === wc).map(([id]) => webContents.fromId(id))];
      return all.some((x) => { try { return !!x && !x.isDestroyed() && x.isFocused(); } catch { return false; } });
    },
  };
});
