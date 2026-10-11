DeckitModule.define("deckit/service/web/server/session", {
  uses: [
    "deckit/module/log",
    "deckit/service/storage/model/space",
    "deckit/service/web/model/protocol",
  ],
  provides: ["of", "partitionOf", "isSession"],
}, (log, SPACE, PROTOCOL) => {
  const { app } = require("electron");
  const { guard } = log;

  const partitions = new WeakMap();   // session -> partition
  // Sessions are handed out only here: recording the partition is how partitionOf knows a page's.
  const of = (partition) => {
    if (!SPACE.isJar(partition)) throw new Error("not a web session: " + partition);
    const ses = require("electron").session.fromPartition(partition);
    partitions.set(ses, partition);
    return ses;
  };
  const partitionOf = (wc) => (wc && !wc.isDestroyed() && partitions.get(wc.session)) || "";

  const FETCH_LIMIT = 4 * 1024 * 1024;

  // Limited as bytes arrive: this is the app's process, and a huge answer would be held whole first.
  PROTOCOL.fetchText.answer(async ({ partition, url }) => {
    const ses = of(partition);
    if (!/^https?:\/\//i.test(url)) throw new Error("unsupported url: " + url);
    const res = await ses.fetch(url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    const tooLarge = (bytes) => new Error(`response too large: more than ${FETCH_LIMIT} bytes (${bytes})`);
    const declared = Number(res.headers.get("content-length"));
    if (declared > FETCH_LIMIT) { res.body?.cancel().catch(() => {}); throw tooLarge(declared); }
    if (!res.body) return "";
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > FETCH_LIMIT) { reader.cancel().catch(() => {}); throw tooLarge(total); }
      chunks.push(value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  });

  PROTOCOL.clear.answer(async ({ partition }) => {
    const ses = of(partition);
    await ses.clearStorageData();
    await ses.clearCache();
    await ses.clearAuthCache();
    return true;
  });

  /* A cookie with no expiry would sign the person out of every site at each launch; a browser
     restoring its session keeps them, so here it is given a lifetime.
     A session allows one onHeadersReceived listener and the app may register its own, so the
     registration is intercepted and chained: ours first, then the app's for its URLs. Chained as
     each session is made, before of() records it, so whether it is ours is asked per response. */
  const SESSION_COOKIE_TTL = 60 * 60 * 24 * 14;

  const keepSessionCookies = (headers) => {
    if (!headers) return;
    for (const key of Object.keys(headers)) {
      if (key.toLowerCase() !== "set-cookie") continue;
      headers[key] = [].concat(headers[key]).map((c) =>
        /;\s*(expires|max-age)=/i.test(c) ? c : c + "; Max-Age=" + SESSION_COOKIE_TTL);
    }
  };

  const toRegExp = (pattern) => new RegExp("^" + pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");

  const chain = (wr, event, pre, resultKey) => {
    const register = wr[event].bind(wr);
    let downstream = null;
    register((details, callback) => {
      pre(details);
      const hit = downstream && (!downstream.tests.length ||
        downstream.tests.some((re) => re.test(details.url)));
      if (hit) return downstream.listener(details, callback);
      callback({ [resultKey]: details[resultKey] });
    });
    wr[event] = (filterOrListener, maybeListener) => {
      if (filterOrListener === null) { downstream = null; return; }
      const listener = typeof filterOrListener === "function" ? filterOrListener : maybeListener;
      const urls = (typeof filterOrListener === "object" && filterOrListener?.urls) || [];
      downstream = { tests: urls.map(toRegExp), listener };
    };
  };

  guard(app, "session-created", (ses) => {
    const wr = ses.webRequest;
    if (wr.__deckitWrapped) return;
    wr.__deckitWrapped = true;
    chain(wr, "onHeadersReceived", (details) => {
      if (/^https:/i.test(details.url) && partitions.has(ses)) keepSessionCookies(details.responseHeaders);
    }, "responseHeaders");
  });

  return { of, partitionOf, isSession: (partition) => SPACE.isJar(partition) };
});
