// The libraries as the build reads them: deckit, and the shell on it. Their files, what each declares, and each bundle
// worked out from its entry. A file is named by its path under source/deckit, its library first.
const fs = require('fs');
const path = require('path');

const DECKIT = path.join(__dirname, '..', 'deckit');
const LIBRARIES = ['deckit', 'shell'];
const MODS = path.join(DECKIT, 'mod');
const APP = path.join(DECKIT, 'deckit-app');
const REGISTRY = 'deckit/module/registry/index.js';
const ENTRIES = {
    chord: () => ['deckit/module/chord'],
    main: () => ['deckit/feature/app/main'],
    page: () => ['deckit/feature/app/page'],
    'shell-main': () => ['shell/feature/app/main'],
    'shell-page': () => ['shell/feature/app/page'],
};
// The shell's bundles load after deckit's of the same process, so they carry nothing deckit's already do.
const LOADS_AFTER = { 'shell-main': 'main', 'shell-page': 'page' };
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

// Every script of the libraries, by its path under source/deckit.
function files() {
    const walk = (folder) =>
        fs.readdirSync(path.join(DECKIT, folder), { withFileTypes: true }).flatMap((entry) => {
            const relative = path.posix.join(folder, entry.name);
            if (entry.isDirectory()) return walk(relative);
            return entry.name.endsWith('.js') ? [relative] : [];
        });
    return LIBRARIES.flatMap(walk).sort();
}

// A file's declaration, read by running it against a registry that records define() and makes nothing.
function moduleOf(file) {
    const text = fs.readFileSync(path.resolve(DECKIT, file), 'utf8');
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

// A file's module name: its path, with index.js standing for its folder.
function nameOf(file) {
    return file.replace(/(\/index)?\.js$/, '');
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

// Each file after what it names, starting at the entries, but those `loaded` already. A name no library defines is
// one the app hands it, loaded before the bundle.
function filesFrom(entries, all = modules(), loaded = []) {
    const order = [];
    const seen = new Set(loaded.map(nameOf));
    const visit = (module) => {
        if (seen.has(module) || !all.has(module)) return;
        seen.add(module);
        for (const use of all.get(module).uses) visit(use.name);
        order.push(all.get(module).file);
    };
    for (const entry of entries) visit(entry);
    return order;
}

function bundles() {
    const all = modules();
    const made = { registry: [REGISTRY] };
    for (const name of Object.keys(ENTRIES))
        made[name] = filesFrom(ENTRIES[name](), all, made[LOADS_AFTER[name]] || []);
    return made;
}

module.exports = {
    DECKIT,
    LIBRARIES,
    MODS,
    APP,
    REGISTRY,
    ENTRIES,
    code,
    files,
    moduleOf,
    nameOf,
    modules,
    filesFrom,
    bundles,
};
