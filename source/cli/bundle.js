#!/usr/bin/env node
// One CommonJS file from an entry and the files it requires by relative path, for a plugin's sandbox, which has no
// require of its own: each file becomes a function in a table, and the bundle's module.exports is the entry's.
// Usage: bundle.js <entry> <output>
const fs = require('fs');
const path = require('path');

const REQUIRE = /\brequire\(\s*(["'])([^"']+)\1\s*\)/g;

if (require.main === module) {
    const [entry, output] = process.argv.slice(2);
    if (!entry || !output) {
        console.error('usage: bundle.js <entry> <output>');
        process.exit(2);
    }
    try {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, bundle(entry));
    } catch (error) {
        console.error(error.message);
        process.exit(1);
    }
}

function bundle(entry) {
    const files = []; // in the order first reached: the entry is 0
    const ids = new Map(); // file -> its place in files
    const add = (file) => {
        if (!ids.has(file)) {
            ids.set(file, files.length);
            files.push({ file, source: fs.readFileSync(file, 'utf8'), requires: {} });
        }
        return ids.get(file);
    };
    add(path.resolve(entry));
    for (let index = 0; index < files.length; index++) {
        const at = files[index];
        for (const [, , specifier] of at.source.matchAll(REQUIRE)) {
            if (!specifier.startsWith('./') && !specifier.startsWith('../'))
                throw new Error(`${at.file} requires "${specifier}": a sandbox has only the plugin's own files`);
            at.requires[specifier] = add(resolved(path.dirname(at.file), specifier, at.file));
        }
    }
    const root = path.dirname(path.resolve(entry));
    const table = files
        .map(
            ({ file, source, requires }) =>
                `// ${path.relative(root, file)}\n[function (module, exports, require) {\n${source}\n}, ${JSON.stringify(requires)}]`
        )
        .join(',\n');
    return `(function (files) {
    const made = [];
    const load = (id) => {
        if (!made[id]) {
            const [run, requires] = files[id];
            made[id] = { exports: {} };
            run(made[id], made[id].exports, (specifier) => load(requires[specifier]));
        }
        return made[id].exports;
    };
    module.exports = load(0);
})([
${table}
]);
`;
}

// As Node resolves a relative path: the file, the file with .js, or the folder's index.js.
function resolved(folder, specifier, from) {
    const base = path.resolve(folder, specifier);
    for (const file of [base, base + '.js', path.join(base, 'index.js')])
        if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
    throw new Error(`${from} requires "${specifier}", which is no file`);
}

module.exports = { bundle };
