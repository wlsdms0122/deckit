// Deckit.app's folder, put together from a deckit archive the way any app that embeds deckit loads it.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const APP = path.join(__dirname, '..', 'deckit', 'deckit-app');

// The one archive the last build made.
function builtArchive() {
    const out = path.join(ROOT, '.build');
    const found = fs.existsSync(out) ? fs.readdirSync(out).filter((file) => /^deckit-[0-9].*\.tgz$/.test(file)) : [];
    if (found.length !== 1) throw new Error('no deckit archive in .build/: run deckit build first');
    return path.join(out, found[0]);
}

// The archive unpacked into `to`/deckit, the app's own files beside it, and the preload every deckit page loads with:
// the renderer bundles, then what Electron gives the page, handed to the shell's start.
function assemble(archive, to) {
    const order = require(path.join(APP, 'bundle.js'));
    fs.rmSync(to, { recursive: true, force: true });
    const library = path.join(to, 'deckit');
    fs.mkdirSync(library, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', library]);
    const built = JSON.parse(fs.readFileSync(path.join(library, 'deckit.json'), 'utf8'));
    for (const file of order.files) fs.copyFileSync(path.join(APP, file), path.join(to, file));
    // The page's globals before the bundles run, so boot can take away every one they added.
    const read = (bundle) => fs.readFileSync(path.join(library, built.bundles[bundle].file), 'utf8');
    fs.writeFileSync(
        path.join(to, 'preload.js'),
        [
            'const before = new Set(Object.keys(globalThis));',
            ...order.preload.map(read),
            `const environment = ${built.bundles.renderer.global}.boot({ before });`,
            `if (environment) ${built.bundles['shell-renderer'].global}.start(environment);`,
        ].join('\n;\n') + '\n'
    );
    fs.writeFileSync(
        path.join(to, 'package.json'),
        JSON.stringify({ name: 'deckit', productName: 'Deckit', version: built.version, main: order.entry }, null, 4) +
            '\n'
    );
    return to;
}

module.exports = { builtArchive, assemble };
