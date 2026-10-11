DeckitModule.define("deckit/service/web/server/shim", {
  uses: [
    "deckit/service/web/server/pages",
    "deckit/service/web/server/session",
    "deckit/service/web/server/permission",
    "deckit/service/web/model/protocol",
  ],
  provides: ["bridge", "notificationClicked", "captureOf", "forget"],
}, (PAGES, SESSION, PERMISSION, PROTOCOL) => {
  /* Electron's own notice knows nothing of the tab, so the page's Notification is replaced, through
     the debugger before the page's scripts run, reporting through a binding only the debugger hears.
     Chromium does not tell an embedder what a page captures, so its capture calls are watched too.
     Neither covers a service worker or a frame inside the page. */
  const PAGE_BINDING = "__deckitPage";

  // Runs in the page, as source. Everything it needs is in its arguments.
  function pageShim(binding, table) {
    if (window.__deckitNotification) return;
    // The binding may arrive after the page's first script, so messages wait for it.
    let call = null, retry = 0;
    const outbox = [];
    const flush = () => {
      if (!call && typeof window[binding] === "function") {
        call = window[binding];
        try { delete window[binding]; } catch {}
      }
      if (!call) { if (outbox.length && !retry) retry = setTimeout(() => { retry = 0; flush(); }, 100); return; }
      while (outbox.length) call(outbox.shift());
    };
    const say = (msg) => { outbox.push(JSON.stringify(msg)); flush(); };
    flush();
    let permission = table[location.origin] || "default";
    let seq = 0;
    const ids = new WeakMap(), live = new Map(), waiting = new Map();
    const fire = (n, type) => {
      const ev = new Event(type);
      n.dispatchEvent(ev);
      const fn = n["on" + type];
      if (typeof fn === "function") { try { fn.call(n, ev); } catch (err) { setTimeout(() => { throw err; }); } }
    };
    class Notification extends EventTarget {
      constructor(title, options) {
        super();
        if (arguments.length === 0) {
          throw new TypeError("Failed to construct 'Notification': 1 argument required, but only 0 present.");
        }
        const o = options || {};
        Object.assign(this, {
          title: String(title), body: String(o.body || ""), tag: String(o.tag || ""),
          icon: String(o.icon || ""), badge: String(o.badge || ""), image: String(o.image || ""),
          lang: String(o.lang || ""), dir: o.dir || "auto", data: o.data === undefined ? null : o.data,
          silent: !!o.silent, renotify: !!o.renotify, requireInteraction: !!o.requireInteraction,
          timestamp: o.timestamp || Date.now(), actions: [],
          onclick: null, onshow: null, onerror: null, onclose: null,
        });
        const id = ++seq;
        ids.set(this, id);
        setTimeout(() => {
          if (permission !== "granted") return fire(this, "error");
          live.set(id, this);
          say({ op: "show", id, title: this.title, body: this.body, silent: this.silent });
          fire(this, "show");
        });
      }
      close() {
        const id = ids.get(this);
        if (!live.delete(id)) return;
        fire(this, "close");
      }
      static get permission() { return permission; }
      static get maxActions() { return 2; }
      static requestPermission(callback) {
        const answer = permission !== "default" ? Promise.resolve(permission)
          : new Promise((resolve) => { const id = ++seq; waiting.set(id, resolve); say({ op: "request", id }); });
        if (typeof callback === "function") answer.then(callback);
        return answer;
      }
    }
    Object.defineProperty(window, "Notification", { value: Notification, writable: true, configurable: true });
    const perms = navigator.permissions;
    if (perms && typeof perms.query === "function") {
      const query = perms.query.bind(perms);
      perms.query = (desc) => (desc && desc.name === "notifications")
        ? Promise.resolve(Object.assign(new EventTarget(), {
            name: "notifications", onchange: null,
            state: permission === "default" ? "prompt" : permission,
          }))
        : query(desc);
    }
    const tracks = new Map();   // track -> "microphone" | "camera" | "screen"
    let reported = "";
    const reportCapture = () => {
      const on = { microphone: false, camera: false, screen: false };
      for (const [track, kind] of tracks) {
        if (track.readyState === "live") on[kind] = true; else tracks.delete(track);
      }
      const sig = JSON.stringify(on);
      if (sig === reported) return;
      reported = sig;
      say({ op: "capture", ...on });
    };
    const watch = (track, kind) => {
      tracks.set(track, kind);
      track.addEventListener("ended", reportCapture);
    };
    const devices = navigator.mediaDevices && Object.getPrototypeOf(navigator.mediaDevices);
    for (const [name, screen] of [["getUserMedia", false], ["getDisplayMedia", true]]) {
      const original = devices && devices[name];
      if (typeof original !== "function") continue;
      Object.defineProperty(devices, name, {
        configurable: true, writable: true,
        value: function (...args) {
          return original.apply(this, args).then((stream) => {
            for (const t of stream.getTracks()) watch(t, screen ? "screen" : t.kind === "audio" ? "microphone" : "camera");
            reportCapture();
            return stream;
          });
        },
      });
    }
    const track = window.MediaStreamTrack && MediaStreamTrack.prototype;
    if (track) {
      const stop = track.stop, clone = track.clone;
      track.stop = function () {
        const r = stop.apply(this, arguments);
        if (tracks.delete(this)) reportCapture();
        return r;
      };
      track.clone = function () {
        const copy = clone.apply(this, arguments);
        const kind = tracks.get(this);
        if (kind) watch(copy, kind);
        return copy;
      };
    }
    Object.defineProperty(window, "__deckitNotification", {
      value: {
        click(id) { const n = live.get(id); if (n) fire(n, "click"); },
        // id 0 is news for the page as a whole (a grant made in another tab), not an answer.
        permission(id, state) {
          if (id === 0 && permission !== "default") return;
          permission = state;
          const resolve = waiting.get(id);
          if (resolve) { waiting.delete(id); resolve(state); }
        },
      },
    });
  }

  const bridges = new Map();   // page webContents id -> reinstall with the current grants
  PERMISSION.onChange(() => { for (const again of bridges.values()) again(); });
  const capturing = new Map();   // page webContents id -> { microphone, camera, screen }, as the page reports
  const NOT_CAPTURING = { microphone: false, camera: false, screen: false };

  const bridgePage = (h, guest, changed) => {
    const dbg = guest.debugger;
    const run = (method, params) => dbg.sendCommand(method, params);
    const evaluate = (expression) =>
      run("Runtime.evaluate", { expression, userGesture: true }).catch(() => {});
    const partition = SESSION.partitionOf(guest);
    const allowed = (origin) => PERMISSION.granted(partition, origin, "notifications");
    let script = null;
    const install = () => {
      if (guest.isDestroyed() || !dbg.isAttached()) return Promise.resolve();
      const source = `(${pageShim})(${JSON.stringify(PAGE_BINDING)}, ${JSON.stringify(PERMISSION.notices(partition))})`;
      const drop = script
        ? run("Page.removeScriptToEvaluateOnNewDocument", { identifier: script }).catch(() => {})
        : Promise.resolve();
      /* Also run in the document already there: it is usually under way before the debugger gets
         here. The shim does nothing the second time. */
      return drop.then(() => run("Page.addScriptToEvaluateOnNewDocument", { source }))
        .then((r) => { script = r.identifier; })
        .then(() => evaluate(source))
        .catch(() => {});
    };
    bridges.set(guest.id, () => {
      install();
      if (allowed(PERMISSION.originOf(guest.getURL()))) {
        evaluate(`window.__deckitNotification && window.__deckitNotification.permission(0, "granted")`);
      }
    });
    guest.once("destroyed", () => { bridges.delete(guest.id); capturing.delete(guest.id); });

    dbg.on("message", (_e, method, params, sessionId) => {
      if (method !== "Runtime.bindingCalled" || sessionId || !params || params.name !== PAGE_BINDING) return;
      let msg;
      try { msg = JSON.parse(params.payload); } catch { return; }
      const id = Number(msg && msg.id) || 0;
      const origin = PERMISSION.originOf(guest.getURL());
      if (msg.op === "capture") {
        capturing.set(guest.id, { microphone: !!msg.microphone, camera: !!msg.camera, screen: !!msg.screen });
        changed();
      } else if (msg.op === "show" && allowed(origin)) {
        PAGES.send(h, PROTOCOL.notification, {
          id: guest.id, notification: id, title: String(msg.title || "").slice(0, 200), body: String(msg.body || "").slice(0, 400),
          silent: !!msg.silent,
        });
      } else if (msg.op === "request") {
        PERMISSION.ask(h, guest, origin, ["notifications"]).then((ok) =>
          evaluate(`window.__deckitNotification && window.__deckitNotification.permission(${id}, "${ok ? "granted" : "denied"}")`));
      }
    });

    /* A binding reaches later documents only while Runtime is enabled, which a page can detect
       (sign-in and bot checks look for it), so Runtime stays off and each new document is bound. */
    const bind = () => run("Runtime.removeBinding", { name: PAGE_BINDING }).catch(() => {})
      .then(() => run("Runtime.addBinding", { name: PAGE_BINDING }));
    guest.on("did-navigate", () => { if (dbg.isAttached()) bind().catch(() => {}); });

    // A webContents that has not started loading has no page to talk to yet.
    const arm = () => {
      if (!dbg.isAttached()) return;
      run("Page.enable", {})
        .then(bind)
        .then(install)
        .catch((e) => console.error("[deckit] page notifications and capture stay the page's own", e));
    };
    if (guest.getURL() || guest.isLoading()) arm(); else guest.once("did-start-loading", arm);
  };

  const notificationClicked = (guest, id) => {
    try {
      guest.debugger.sendCommand("Runtime.evaluate", {
        expression: `window.__deckitNotification && window.__deckitNotification.click(${Number(id) || 0})`,
        userGesture: true,
      }).catch(() => {});
    } catch {}
  };

  return {
    bridge: bridgePage,
    notificationClicked,
    captureOf: (id) => ({ ...(capturing.get(id) || NOT_CAPTURING) }),
    forget: (id) => capturing.delete(id),
  };
});
