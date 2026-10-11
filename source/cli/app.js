const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const source = path.join(__dirname, '..');
const root = path.join(source, '..');
const APP = path.join(source, 'deckit', 'deckit-app');

const builtArchive = () => {
    const out = path.join(root, '.build');
    const found = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /^deckit-lib-.+\.tgz$/.test(f)) : [];
    if (found.length !== 1) throw new Error('no deckit-lib archive in .build/: run deckit build first');
    return path.join(out, found[0]);
};

const assemble = (archive, to) => {
    const list = require(path.join(APP, 'bundle.js'));
    fs.rmSync(to, { recursive: true, force: true });
    const lib = path.join(to, 'deckit');
    fs.mkdirSync(lib, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', lib]);
    const said = JSON.parse(fs.readFileSync(path.join(lib, 'deckit.json'), 'utf8'));

    const placed = (entry) =>
        typeof entry === 'string' ? path.basename(entry) : path.join('deckit', said.bundles[entry.bundle].file);
    for (const entry of [list.entry, ...list.main, ...list.page]) {
        if (typeof entry === 'string') fs.copyFileSync(path.join(APP, entry), path.join(to, path.basename(entry)));
    }
    fs.writeFileSync(
        path.join(to, 'load.json'),
        JSON.stringify(
            {
                main: ['deckit/' + said.bundles.registry.file, ...list.main.map(placed)],
            },
            null,
            2
        ) + '\n'
    );

    // globalsBefore lets boot take away every global the scripts after it added.
    const read = (file) => fs.readFileSync(path.join(to, file), 'utf8');
    fs.writeFileSync(
        path.join(to, 'preload.js'),
        [
            'const globalsBefore = new Set(Object.keys(globalThis));',
            read('deckit/' + said.bundles.registry.file),
            ...list.page.map((entry) => read(placed(entry))),
            'DeckitModule.use(["deckit/feature/app/view"], (boot) => boot.boot(globalsBefore));',
        ].join('\n;\n') + '\n'
    );

    fs.writeFileSync(
        path.join(lib, 'deckit-build.json'),
        JSON.stringify({ version: said.version, source: said.source }, null, 2) + '\n'
    );
    fs.writeFileSync(
        path.join(to, 'package.json'),
        JSON.stringify(
            {
                name: 'deckit',
                productName: 'Deckit',
                version: said.version,
                main: 'main.js',
            },
            null,
            2
        ) + '\n'
    );
    return to;
};

module.exports = { builtArchive, assemble };
