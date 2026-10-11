// Deckit.app's folder, put together from a deckit-lib archive the way any app that embeds deckit loads it.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(__dirname, '..', 'deckit', 'deckit-app');

// The one archive the last build made.
function builtArchive() {
    const out = path.join(ROOT, '.build');
    const found = fs.existsSync(out) ? fs.readdirSync(out).filter((file) => /^deckit-lib-.+\.tgz$/.test(file)) : [];
    if (found.length !== 1) throw new Error('no deckit-lib archive in .build/: run deckit build first');
    return path.join(out, found[0]);
}

// The archive unpacked into `to`/deckit, the app's own files beside it, and what loads them: load.json for main,
// preload.js for every deckit page.
function assemble(archive, to) {
    const order = require(path.join(APP, 'bundle.js'));
    fs.rmSync(to, { recursive: true, force: true });
    const library = path.join(to, 'deckit');
    fs.mkdirSync(library, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', library]);
    const built = JSON.parse(fs.readFileSync(path.join(library, 'deckit.json'), 'utf8'));
    const placed = (entry) =>
        typeof entry === 'string' ? entry : path.join('deckit', built.bundles[entry.bundle].file);
    for (const entry of [order.entry, ...order.main, ...order.page]) {
        if (typeof entry === 'string') fs.copyFileSync(path.join(APP, entry), path.join(to, entry));
    }
    fs.writeFileSync(
        path.join(to, 'load.json'),
        JSON.stringify({ main: ['deckit/' + built.bundles.registry.file, ...order.main.map(placed)] }, null, 4) + '\n'
    );
    // The page's globals before the bundle runs, so boot can take away every one the bundle added.
    const read = (file) => fs.readFileSync(path.join(to, file), 'utf8');
    fs.writeFileSync(
        path.join(to, 'preload.js'),
        [
            'const globalsBefore = new Set(Object.keys(globalThis));',
            read('deckit/' + built.bundles.registry.file),
            ...order.page.map((entry) => read(placed(entry))),
            "DeckitModule.use(['deckit/feature/app/view'], (APP) => APP.boot(globalsBefore));",
        ].join('\n;\n') + '\n'
    );
    fs.writeFileSync(
        path.join(to, 'package.json'),
        JSON.stringify({ name: 'deckit', productName: 'Deckit', version: built.version, main: 'main.js' }, null, 4) +
            '\n'
    );
    return to;
}

module.exports = { builtArchive, assemble };
