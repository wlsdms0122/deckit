DeckitModule.define("deckit/service/open/client", {
  uses: [
    "deckit/service/home/model/config",
    "deckit/service/open/model/scheme",
    "deckit/service/open/model/protocol",
  ],
  provides: [
    "register", "arrange", "listen", "open", "fileURL", "filePath", "reveal", "everyScheme", "list",
    "set",
  ],
}, (CONFIG, SCHEMES, PROTOCOL) => {
  const { SCHEME, NOT_PLACES, EVERY } = SCHEMES;
  const answer = (end, payload) => Promise.resolve().then(() => end.ask(payload)).catch(() => false);

  // Each part escaped, so a space or a # stays part of the name.
  const fileURL = (file) => {
    const p = String(file || "");
    return p.startsWith("/") ? "file://" + p.split("/").map(encodeURIComponent).join("/") : "";
  };
  const filePath = (url) => {
    try {
      const u = new URL(String(url || ""));
      if (u.protocol !== "file:" || (u.host && u.host !== "localhost")) return "";
      const p = decodeURIComponent(u.pathname);
      return p.startsWith("/") ? p : "";
    } catch { return ""; }
  };

  const web = { when: "A web address: a link clicked in a plugin, or a page asking for a new window.",
                fallback: "Opens in the system browser",
                run: (url, options) => answer(PROTOCOL.external, { url, activates: options.activates }) };
  // A Map: a scheme is a name anyone may write, and one like "constructor" must not be found on a prototype.
  const ANSWERS = new Map([
    ["http", web],
    ["https", web],
    ["file", { when: "A file on this Mac, such as a row in a file list.",
               fallback: "Opens in the system's app when you asked for it, otherwise shows it in Finder",
               run: (url, options) => answer(PROTOCOL.path, { file: filePath(url), userInitiated: options.userInitiated }) }],
  ]);
  // Own keys only, for the same reason.
  const by = (table, key) => (table && Object.hasOwn(table, key) ? table[key] : undefined);

  const schemeOf = (url) => {
    const at = url.indexOf(":");
    const scheme = at > 0 ? url.slice(0, at).toLowerCase() : "";
    return SCHEME.test(scheme) ? scheme : "";
  };

  // By line: { https: { order: [id...], off: [id...] } }.
  const readChosen = () => {
    try { return PROTOCOL.config.ask() || {}; } catch { return {}; }
  };
  let chosen = readChosen();

  // Their order is the order of a line no one has placed yet.
  const handlers = [];
  const register = ({ id, name, schemes, open, invalid } = {}) => {
    if (!id || handlers.some((h) => h.id === id)) return console.warn("[deckit] an open handler needs an id of its own", id);
    if (typeof open !== "function") return console.warn("[deckit] an open handler needs open()", id);
    const say = typeof invalid === "function" ? invalid : (why) => console.warn(`[deckit] ${id}: ${why}`);
    handlers.push({ id: String(id), name: String(name || id), schemes: [...(schemes || [])], open, invalid: say });
  };
  const arrange = (ids) => {
    const at = new Map([...ids].map((id, i) => [id, i]));
    const rank = (x) => (at.has(x.id) ? at.get(x.id) : Infinity);
    handlers.sort((a, b) => rank(a) - rank(b));
  };

  // What the app names first and the person has not placed goes ahead of what they placed.
  const lineOf = (line) => {
    const placed = by(chosen, line)?.order || [];
    return [...(by(CONFIG.openWith, line) || []).filter((id) => !placed.includes(id)), ...placed];
  };

  const lines = () => {
    const named = handlers.flatMap((h) => h.schemes);
    const own = named.filter((s) => s !== EVERY);
    return [...new Set([...ANSWERS.keys(), ...own, ...(named.includes(EVERY) ? [EVERY] : [])])];
  };
  const lineFor = (scheme) => (scheme !== EVERY && lines().includes(scheme) ? scheme : EVERY);

  const providers = (line) => {
    const order = lineOf(line);
    const off = new Set(by(chosen, line)?.off || []);
    const rank = (id) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
    return handlers
      .filter((h) => h.schemes.some((s) => s === EVERY || s === line))
      .map((h, i) => ({ id: h.id, name: h.name, on: !off.has(h.id), at: i }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.at - b.at)
      .map(({ at, ...rest }) => rest);
  };

  // What the screen does after is the taker's: only it knows whether it moved the panel out of the way.
  const offer = async (line, url, options) => {
    for (const p of providers(line)) {
      if (!p.on) continue;
      const handler = handlers.find((h) => h.id === p.id);
      let taken;
      // Said to `invalid`, so Settings can say why addresses kept going to the next one.
      try { taken = await handler.open(url, options); }
      catch (e) { handler.invalid(`open() threw: ${(e && e.message) || e}`); continue; }
      // Only a plain true takes it, so a forgotten return passes it on rather than losing it.
      if (taken !== true) continue;
      return true;
    }
    return false;
  };

  const open = async (url, { activates = true, userInitiated = false, usesDefaultApp = false, target = "" } = {}) => {
    const address = String(url || "").trim();
    const scheme = schemeOf(address);
    if (!scheme || NOT_PLACES.has(scheme)) return false;
    const options = { activates: activates !== false, userInitiated: !!userInitiated, target: String(target || "") };
    if (!usesDefaultApp && await offer(lineFor(scheme), address, options)) return true;
    return ANSWERS.get(scheme)?.run(address, options) || false;
  };

  const reveal = (file) => answer(PROTOCOL.reveal, { file: String(file || "") });

  // A window.open of the panel's own page, which has no owner to ask first. Heard only in the panel's page.
  const listen = () => {
    PROTOCOL.url.hear(({ url, activates, target }) => open(url, { activates, target }));
  };

  return {
    register,
    arrange,
    listen,
    open,
    fileURL,
    filePath,
    reveal,
    everyScheme: EVERY,
    // `fallback` is null where the host has no answer: those addresses end unopened.
    list: () => lines().map((id) => ({
      id,
      name: id === EVERY ? "Every other scheme" : id + ":",
      when: id === EVERY ? "An address no line above names, for the plugins that take every scheme."
        : ANSWERS.get(id)?.when || `An address that starts with ${id}:, which a plugin named.`,
      fallback: ANSWERS.get(id)?.fallback || null,
      providers: providers(id),
    })),
    /* A plugin absent from the line now (failed to load, or waiting on what it requires) keeps its
       place and switch: otherwise editing the line while it was gone would hand its place back to the
       app's default over what the person chose. Lines absent now keep what was chosen for the same reason. */
    set(line, { order, off }) {
      if (!lines().includes(line)) throw new Error("there is no Open With line " + line);
      const next = [...(order || [])];
      const present = new Set(next);
      const before = lineOf(line);
      const merged = before.map((id) => (present.has(id) ? next.shift() : id));
      merged.push(...next);
      const offNow = new Set(off || []);
      const offKept = (by(chosen, line)?.off || []).filter((id) => !present.has(id));
      chosen = { ...chosen, [line]: { order: merged, off: [...offKept, ...offNow] } };
      Promise.resolve().then(() => PROTOCOL.setConfig.ask({ config: chosen }))
        .catch((e) => console.warn("[deckit] the Open With order was not saved", e));
    },
  };
});
