(() => {
  const made = new Map();
  const resolve = (asker, names) => names.map((written) => {
    const optional = written.endsWith("?");
    const name = optional ? written.slice(0, -1) : written;
    if (made.has(name)) return made.get(name);
    if (optional) return undefined;
    throw new Error(`[deckit] ${asker} uses ${name}, which is not defined before it`);
  });

  /* Any other name throws, so a stale member fails where it is read. Symbols and `then` pass:
     runtimes probe every value for symbols, and a promise asks `then` of what it resolves with. */
  const viewOf = (name, value) => new Proxy(value, {
    get(target, key, receiver) {
      if (typeof key === "symbol" || key in target) return Reflect.get(target, key, receiver);
      if (key === "then") return undefined;
      throw new Error(`[deckit] ${name} provides no ${key}`);
    },
  });

  /* source/cli/library.js also parses every define's `{ uses, provides, runs }` from source, in that
     order, to build and order the bundles; `runs` is read only there. Change both together. */
  const define = (name, { uses = [], provides = [] } = {}, make) => {
    if (made.has(name)) throw new Error(`[deckit] ${name} is defined twice`);
    const value = make(...resolve(name, uses));
    if (value === undefined && !provides.length) { made.set(name, viewOf(name, Object.freeze({}))); return; }
    if (value === null || typeof value !== "object") {
      throw new Error(`[deckit] ${name} made ${value === null ? "null" : typeof value}, not the names it provides`);
    }
    const has = Object.keys(value);
    if (has.length !== provides.length || provides.some((key) => !has.includes(key))) {
      throw new Error(`[deckit] ${name} provides ${provides.join(", ") || "nothing"}, but made ${has.join(", ") || "nothing"}`);
    }
    made.set(name, viewOf(name, value));
  };
  const use = (uses, run) => run(...resolve("a caller of use()", uses));
  globalThis.DeckitModule = Object.freeze({ define, use });
})();
