const fs = require("fs");
const path = require("path");

const source = path.join(__dirname, "..");
const DECKIT = path.join(source, "deckit");
const LIBRARY = path.join(DECKIT, "deckit");
const PLUGINS = path.join(DECKIT, "plugin");
const APP = path.join(DECKIT, "deckit-app");
const CLI = path.join(DECKIT, "deckit-cli");
const REGISTRY = "module/registry/index.js";
const PAGE = "feature/panel/page.html";

// deckit-cli is not in the library: its bundle starts from the library modules commands.js names.
const ENTRIES = {
  chord: () => ["deckit/module/chord"],
  cli: () => moduleOf(path.join(CLI, "commands.js")).uses.map((use) => use.name).filter((name) => name.startsWith("deckit/")),
  main: () => ["deckit/feature/app/main"],
  page: () => ["deckit/feature/app/view"],
};

/* Code without its comments, so a name in a comment is not taken for a use. A scanner, not a
   pattern: a string, template or regular expression may hold what looks like a comment start. */
const code = (text) => {
  let out = "";
  let i = 0;
  // A "/" starts a regular expression where a value is expected: after one of these, or at the start.
  const VALUE_BEFORE = "(,=:[!&|?{};+-*%<>~^";
  const last = () => out.trimEnd().slice(-1);
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (c === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 2;
      out += " ";
    } else if (c === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      i = end < 0 ? text.length : end;
    } else if (c === '"' || c === "'" || c === "`") {
      const start = i++;
      while (i < text.length && text[i] !== c) i += text[i] === "\\" ? 2 : 1;
      out += text.slice(start, ++i);
    } else if (c === "/" && (last() === "" || VALUE_BEFORE.includes(last()))) {
      const start = i++;
      let inClass = false;
      while (i < text.length && (inClass || text[i] !== "/") && text[i] !== "\n") {
        if (text[i] === "\\") i++;
        else if (text[i] === "[") inClass = true;
        else if (text[i] === "]") inClass = false;
        i++;
      }
      out += text.slice(start, ++i);
    } else {
      out += c;
      i++;
    }
  }
  return out;
};

const files = () => {
  const walk = (dir) => fs.readdirSync(path.join(LIBRARY, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return e.name.endsWith(".js") ? [rel] : [];
  });
  return walk("").sort();
};

// A file's declaration, read by running it against a registry that records define() and makes nothing.
const moduleOf = (file) => {
  const text = fs.readFileSync(path.resolve(LIBRARY, file), "utf8");
  const plain = code(text);
  const defines = [];
  const recorder = { define: (name, declared) => defines.push({ name, ...declared }), use: () => {} };
  try {
    new Function("DeckitModule", text)(recorder);
  } catch (error) {
    return { problem: `does not load: ${error.message}`, plain };
  }
  if (defines.length !== 1) {
    return { problem: `defines ${defines.length} modules, not one, each as define("<name>", { uses, provides, runs }, make)`, plain };
  }
  const [{ name, uses = [], provides = [], runs = null }] = defines;
  return {
    name,
    runs,
    uses: uses.map((written) => ({ name: written.replace(/\?$/, ""), optional: written.endsWith("?") })),
    provides,
    plain,
  };
};

const nameOf = (file) => "deckit/" + file.replace(/(\/index)?\.js$/, "");

// The registry defines the modules but is not one.
const modules = () => {
  const all = new Map();
  for (const file of files()) {
    if (file === REGISTRY) continue;
    const m = moduleOf(file);
    if (m.name) all.set(m.name, { file, uses: m.uses, provides: m.provides });
  }
  return all;
};

// A name the library does not define is one the app hands it, loaded before the bundle.
const bundle = (name, all = modules()) => {
  const order = [];
  const seen = new Set();
  const visit = (module) => {
    if (seen.has(module) || !all.has(module)) return;
    seen.add(module);
    for (const use of all.get(module).uses) visit(use.name);
    order.push(all.get(module).file);
  };
  for (const entry of ENTRIES[name]()) visit(entry);
  return order;
};

const bundles = () => {
  const all = modules();
  return { registry: [REGISTRY], ...Object.fromEntries(Object.keys(ENTRIES).map((b) => [b, bundle(b, all)])) };
};

module.exports = { DECKIT, LIBRARY, PLUGINS, APP, CLI, REGISTRY, PAGE, ENTRIES, code, files, moduleOf, nameOf, modules, bundles };
