// The libraries as the build reads them: deck, deckit on it, and deckit-shell on deckit, each a package of ES modules
// under source/deckit, and the bundles they are carried in. A file is named by its path under source/deckit.
const fs = require('fs');
const path = require('path');

const DECKIT = path.join(__dirname, '..', 'deckit');
const PACKAGES = ['deck', 'deckit', 'deckit-shell'];
const MODS = path.join(DECKIT, 'mods');
const APP = path.join(DECKIT, 'deckit-app');
const ESBUILD = 'esbuild@0.28.2';
// Each bundle: the file it starts from, how it loads, and for a renderer's, the global the preload starts it by. Main's
// bundles are CommonJS modules a host app requires; a renderer's run as they are in the preload.
const BUNDLES = {
    main: { entry: 'deckit/main.js', format: 'cjs', platform: 'node', target: 'node22' },
    'shell-main': { entry: 'deckit-shell/main.js', format: 'cjs', platform: 'node', target: 'node22' },
    renderer: {
        entry: 'deckit/renderer.js',
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        global: 'DeckitRenderer',
    },
    'shell-renderer': {
        entry: 'deckit-shell/renderer.js',
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        global: 'DeckitShellRenderer',
    },
    chord: {
        entry: 'deckit/keymap/chord.js',
        format: 'iife',
        platform: 'browser',
        target: 'chrome120',
        global: 'DeckitChord',
    },
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

// Every script of the libraries, by its path under source/deckit.
function files() {
    const walk = (folder) =>
        fs.readdirSync(path.join(DECKIT, folder), { withFileTypes: true }).flatMap((entry) => {
            const relative = path.posix.join(folder, entry.name);
            if (entry.isDirectory()) return walk(relative);
            return entry.name.endsWith('.js') ? [relative] : [];
        });
    return PACKAGES.flatMap(walk).sort();
}

// What a file imports: each `import ... from`, `export ... from` and bare `import '...'`, with the file a relative
// path names, or null for a package.
function importsOf(file) {
    const plain = code(fs.readFileSync(path.join(DECKIT, file), 'utf8'));
    const statements = /^\s*(?:(?:import|export)\b[^;'"]*?\bfrom\s*|import\s*)(['"])([^'"]+)\1/gm;
    return [...plain.matchAll(statements)].map(([, , spec]) => ({
        spec,
        file: spec.startsWith('.') ? path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)) : null,
    }));
}

// The files a bundle carries: the one it starts from and every file that one imports, through and through.
function reach(entry) {
    const seen = new Set();
    const visit = (file) => {
        const full = path.join(DECKIT, file);
        if (seen.has(file) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return;
        seen.add(file);
        for (const imported of importsOf(file)) if (imported.file) visit(imported.file);
    };
    visit(entry);
    return seen;
}

module.exports = { DECKIT, PACKAGES, MODS, APP, ESBUILD, BUNDLES, code, files, importsOf, reach };
