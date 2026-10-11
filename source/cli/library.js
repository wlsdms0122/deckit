// The library as the build reads it: its files, what each declares, and each bundle worked out from its entry.
const fs = require('fs');
const path = require('path');

const DECKIT = path.join(__dirname, '..', 'deckit');
const LIBRARY = path.join(DECKIT, 'deckit');
const PLUGINS = path.join(DECKIT, 'plugin');
const APP = path.join(DECKIT, 'deckit-app');
const CLI = path.join(DECKIT, 'deckit-cli');
const REGISTRY = 'module/registry/index.js';
const PAGE = 'feature/panel/page.html';
// deckit-cli is not in the library: its bundle starts from the library modules its commands name.
const ENTRIES = {
    chord: () => ['deckit/module/chord'],
    cli: () =>
        moduleOf(path.join(CLI, 'commands.js'))
            .uses.map(({ name }) => name)
            .filter((name) => name.startsWith('deckit/')),
    main: () => ['deckit/feature/app/main'],
    page: () => ['deckit/feature/app/view'],
};
// A "/" starts a regular expression where a value is expected: after one of these, or at the start.
const VALUE_BEFORE = '(,=:[!&|?{};+-*%<>~^';

// Code without its comments, so a name in a comment is not taken for a use. A scanner, not a pattern: a string,
// a template or a regular expression may hold what looks like a comment's start.
function code(text) {
    let out = '';
    let at = 0;
    const last = () => out.trimEnd().slice(-1);
    while (at < text.length) {
        const character = text[at];
        const next = text[at + 1];
        if (character === '/' && next === '*') {
            const end = text.indexOf('*/', at + 2);
            at = end < 0 ? text.length : end + 2;
            out += ' ';
        } else if (character === '/' && next === '/') {
            const end = text.indexOf('\n', at);
            at = end < 0 ? text.length : end;
        } else if (character === '"' || character === "'" || character === '`') {
            const start = at++;
            while (at < text.length && text[at] !== character) at += text[at] === '\\' ? 2 : 1;
            out += text.slice(start, ++at);
        } else if (character === '/' && (last() === '' || VALUE_BEFORE.includes(last()))) {
            const start = at++;
            let inClass = false;
            while (at < text.length && (inClass || text[at] !== '/') && text[at] !== '\n') {
                if (text[at] === '\\') at++;
                else if (text[at] === '[') inClass = true;
                else if (text[at] === ']') inClass = false;
                at++;
            }
            out += text.slice(start, ++at);
        } else {
            out += character;
            at++;
        }
    }
    return out;
}

// Every script of the library, by its path under it.
function files(folder = '') {
    return fs
        .readdirSync(path.join(LIBRARY, folder), { withFileTypes: true })
        .flatMap((entry) => {
            const relative = path.posix.join(folder, entry.name);
            if (entry.isDirectory()) return files(relative);
            return entry.name.endsWith('.js') ? [relative] : [];
        })
        .sort();
}

// A file's declaration, read by running it against a registry that records define() and makes nothing.
function moduleOf(file) {
    const text = fs.readFileSync(path.resolve(LIBRARY, file), 'utf8');
    const plain = code(text);
    const defines = [];
    const recorder = { define: (name, declared) => defines.push({ name, ...declared }), use: () => {} };
    try {
        new Function('DeckitModule', text)(recorder);
    } catch (error) {
        return { problem: `does not load: ${error.message}`, plain };
    }
    if (defines.length !== 1) {
        return {
            problem: `defines ${defines.length} modules, not one, each as define('<name>', { uses, provides, runs }, make)`,
            plain,
        };
    }
    const [{ name, uses = [], provides = [], runs = null }] = defines;
    return {
        name,
        runs,
        uses: uses.map((written) => ({ name: written.replace(/\?$/, ''), optional: written.endsWith('?') })),
        provides,
        plain,
    };
}

// A file's module name: deckit/ and its path, with index.js standing for its folder.
function nameOf(file) {
    return 'deckit/' + file.replace(/(\/index)?\.js$/, '');
}

// The registry defines the modules but is not one.
function modules() {
    const all = new Map();
    for (const file of files()) {
        if (file === REGISTRY) continue;
        const declared = moduleOf(file);
        if (declared.name) all.set(declared.name, { file, uses: declared.uses, provides: declared.provides });
    }
    return all;
}

// Each file after what it names, starting at the entry. A name the library does not define is one the app hands
// it, loaded before the bundle.
function bundle(name, all = modules()) {
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
}

function bundles() {
    const all = modules();
    return {
        registry: [REGISTRY],
        ...Object.fromEntries(Object.keys(ENTRIES).map((name) => [name, bundle(name, all)])),
    };
}

module.exports = {
    DECKIT,
    LIBRARY,
    PLUGINS,
    APP,
    CLI,
    REGISTRY,
    PAGE,
    ENTRIES,
    code,
    files,
    moduleOf,
    nameOf,
    modules,
    bundles,
};
