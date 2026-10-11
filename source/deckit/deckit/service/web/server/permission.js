DeckitModule.define("deckit/service/web/server/permission", {
  uses: [
    "deckit/module/log",
    "deckit/service/web/server/pages",
    "deckit/service/web/server/session",
    "deckit/service/web/model/protocol",
  ],
  provides: ["granted", "ask", "mayOpenApp", "originOf", "onChange", "notices"],
}, (log, PAGES, SESSION, PROTOCOL) => {
  const { app } = require("electron");
  const { guard } = log;

  /* The app may answer every permission itself and grant only its own pages, so a request from a
     page of ours is asked of the document holding it; the rest stays the app's. Allowances live
     only until exit (the plugin hands them back through allow()). A refusal is not kept, so a page
     refused by mistake can ask again once reloaded. */
  const GRANTED = new Set();
  const grantKey = (partition, origin, permission) => partition + "|" + origin + "|" + permission;
  const granted = (partition, origin, permission) => !!partition && !!origin && GRANTED.has(grantKey(partition, origin, permission));
  const originOf = (url) => {
    try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : ""; } catch { return ""; }
  };
  const MEDIA = { audio: "microphone", video: "camera" };

  /* One question per page, site and set of permissions: a page asking again before it is answered
     (a sign-in trying its app every second) joins the question already up. */
  const asked = new Map();     // request id -> { h, key, guest, gone, waiting: [resolve] }
  const askedFor = new Map();  // page|origin|permissions -> request id
  let askSeq = 0;
  const settle = (id, allow) => {
    const a = asked.get(id);
    if (!a) return;
    asked.delete(id);
    askedFor.delete(a.key);
    a.guest.removeListener("destroyed", a.gone);
    for (const resolve of a.waiting) resolve(!!allow);
  };
  const ask = (h, guest, origin, permissions, about = {}) => new Promise((resolve) => {
    if (!origin || !permissions.length) return resolve(false);
    const partition = SESSION.partitionOf(guest);
    if (permissions.every((p) => granted(partition, origin, p))) return resolve(true);
    const key = [guest.id, origin, ...[...permissions].sort()].join("|");
    const up = asked.get(askedFor.get(key));
    if (up) { up.waiting.push(resolve); return; }
    const id = ++askSeq;
    const gone = () => settle(id, false);
    asked.set(id, { h, key, guest, gone, waiting: [resolve] });
    askedFor.set(key, id);
    guest.once("destroyed", gone);
    PAGES.send(h, PROTOCOL.permission, { id: guest.id, ask: id, origin, permissions, ...about });
  });

  PROTOCOL.permit.hear(({ ask: id, allow }, sender) => {
    const a = asked.get(id);
    if (a && a.h.wc === sender) settle(id, allow);
  });

  /* Asked per scheme ("open:<scheme>"), so a site allowed one app is not allowed every app, and of
     the top document's site whichever frame asked: that is the site the person sees and can revoke. */
  const NEVER_OUT = new Set(["javascript", "data", "blob", "file", "filesystem", "about", "chrome", "chrome-extension",
    "devtools", "view-source", "http", "https", "ws", "wss"]);
  // `guest` is the tab the question is asked on, `asking` the page that wants the app.
  const mayOpenApp = (h, guest, url, asking = guest) => {
    const origin = originOf(asking.getURL());
    let scheme = "";
    try { scheme = new URL(String(url)).protocol.replace(/:$/, "").toLowerCase(); } catch {}
    if (!scheme || NEVER_OUT.has(scheme)) return Promise.resolve(false);
    let name = "";
    try { name = app.getApplicationNameForProtocol(String(url)); } catch {}
    if (!name) return Promise.resolve(false);
    return ask(h, guest, origin, ["open:" + scheme], { app: name.replace(/\.app$/i, ""), url: String(url) });
  };
  const listeners = new Set();
  const changed = () => { for (const fn of listeners) { try { fn(); } catch (e) { console.error("[deckit] a permission listener threw", e); } } };
  const change = (partition, entries, apply) => {
    SESSION.of(partition);   // throws for anything but a session of storage's
    for (const entry of entries) {
      const origin = originOf(entry && entry.origin);
      if (origin && entry.permission) apply(grantKey(partition, origin, String(entry.permission)));
    }
    changed();
    return GRANTED.size;
  };
  PROTOCOL.allow.answer(({ partition, entries }) => change(partition, entries, (key) => GRANTED.add(key)));
  /* A page already holding a stream keeps it, and one told "granted" keeps believing it: the plugin
     reloads its pages of that origin. */
  PROTOCOL.revoke.answer(({ partition, entries }) => change(partition, entries, (key) => GRANTED.delete(key)));

  // null is "not ours": the request goes on to whatever the app registered.
  const onRequest = (wc, permission, callback, details) => {
    const at = PAGES.tabOf(wc);
    if (!at) return null;
    const { h, tab } = at;
    const origin = originOf((details && (details.securityOrigin || details.requestingUrl)) || wc.getURL());
    let permissions;
    if (permission === "media") {
      permissions = [...new Set(((details && details.mediaTypes) || []).map((t) => MEDIA[t]).filter(Boolean))];
    } else if (permission === "notifications") {
      permissions = ["notifications"];
    } else if (permission === "openExternal") {
      // Granted, Electron hands the address to the system, which opens its app.
      mayOpenApp(h, tab, details && details.externalURL, wc).then(callback, () => callback(false));
      return true;
    } else {
      return null;
    }
    ask(h, tab, origin, permissions).then(callback, () => callback(false));
    return true;
  };

  /* A check has no "ask" answer, and a page told no stops before it ever asks, so media says yes
     and the request that follows asks. Local network access says yes because nothing follows to ask,
     and Electron does not block the connection anyway (a fetch from https to 127.0.0.1 goes through). */
  const LOCAL_NETWORK = new Set(["local-network-access", "local-network", "loopback-network"]);
  const onCheck = (wc, permission, requestingOrigin, details) => {
    // A final answer, for every page of ours: a sign-in in its own window asks it too.
    if (LOCAL_NETWORK.has(permission)) return wc && PAGES.has(wc.id) ? true : null;
    if (!PAGES.tabOf(wc)) return null;
    if (permission === "media") return true;
    if (permission === "notifications") {
      return granted(SESSION.partitionOf(wc), originOf((details && details.securityOrigin) || requestingOrigin), "notifications");
    }
    return null;
  };

  /* One handler per session, so the app's is chained behind ours, as in session.js. Without one
     from the app, the fallback is Electron's own, which allows. */
  const chainPermissions = (ses) => {
    const through = (method, ours, fallback) => {
      const register = ses[method].bind(ses);
      let downstream = null;
      register((...args) => {
        const mine = ours(...args);
        if (mine !== null) return mine;
        return downstream ? downstream(...args) : fallback(...args);
      });
      ses[method] = (fn) => { downstream = typeof fn === "function" ? fn : null; };
    };
    through("setPermissionRequestHandler", onRequest, (_wc, _p, callback) => callback(true));
    through("setPermissionCheckHandler", onCheck, () => true);
  };

  guard(app, "session-created", (ses) => {
    if (ses.__deckitPermissions) return;
    ses.__deckitPermissions = true;
    chainPermissions(ses);
  });

  return {
    granted, ask, mayOpenApp, originOf,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    notices: (partition) => {
      const table = {};
      const prefix = partition + "|";
      for (const key of GRANTED) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length), cut = rest.lastIndexOf("|");
        if (rest.slice(cut + 1) === "notifications") table[rest.slice(0, cut)] = "granted";
      }
      return table;
    },
  };
});
