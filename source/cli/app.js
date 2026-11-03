// Deckit.app, put together from a deckit archive the way any app that embeds deckit loads it.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');
const ELECTRON = require('./electron.js');

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
// the renderer bundles, then what Electron gives the page, handed to the shell's start, in a function of its own, so
// what the bundles declare stays in it.
function assemble(archive, to) {
    const order = require(path.join(APP, 'bundle.js'));
    fs.rmSync(to, { recursive: true, force: true });
    const library = path.join(to, 'deckit');
    fs.mkdirSync(library, { recursive: true });
    execFileSync('tar', ['-xzf', archive, '-C', library]);
    const built = JSON.parse(fs.readFileSync(path.join(library, 'deckit.json'), 'utf8'));
    for (const file of order.files) {
        fs.mkdirSync(path.dirname(path.join(to, file)), { recursive: true });
        fs.copyFileSync(path.join(APP, file), path.join(to, file));
    }
    // The page's globals before the bundles run, so boot can take away every one they added.
    const read = (bundle) => fs.readFileSync(path.join(library, built.bundles[bundle].file), 'utf8');
    fs.writeFileSync(
        path.join(to, 'preload.js'),
        [
            '(() => {',
            'const before = new Set(Object.keys(globalThis));',
            ...order.preload.map(read),
            `const environment = ${built.bundles.renderer.global}.boot({ before });`,
            `if (environment) ${built.bundles['shell-renderer'].global}.start(environment);`,
            '})();',
        ].join('\n;\n') + '\n'
    );
    fs.writeFileSync(
        path.join(to, 'package.json'),
        JSON.stringify({ name: 'deckit', productName: 'Deckit', version: built.version, main: order.entry }, null, 4) +
            '\n'
    );
    return to;
}

// Deckit.app in .build/, from the archive the last build made: Electron's app named and drawn as Deckit, the archive
// put together inside it, signed ad hoc. The app made before stays until the new one verifies. Answers what it made.
function make() {
    const archive = builtArchive();
    const electron = ELECTRON.electronApp();
    const app = path.join(ROOT, '.build', 'Deckit.app');
    const made = app + '.new';
    const resources = path.join(made, 'Contents', 'Resources');
    const refuse = (message) => {
        fs.rmSync(made, { recursive: true, force: true });
        throw new Error(message);
    };
    fs.rmSync(made, { recursive: true, force: true });
    // -c clones on APFS; a plain copy where the disk cannot.
    if (spawnSync('cp', ['-Rc', electron, made], { stdio: 'ignore' }).status !== 0) {
        fs.rmSync(made, { recursive: true, force: true });
        execFileSync('cp', ['-R', electron, made]);
    }
    for (const file of ['default_app.asar', 'electron.icns']) fs.rmSync(path.join(resources, file), { force: true });
    // The icon as the system draws it now (Assets.car), and as an older one does (Deckit.icns).
    const icon = made + '.icon.plist';
    execFileSync(
        'xcrun',
        [
            'actool',
            path.join(APP, 'Deckit.icon'),
            '--compile',
            resources,
            '--platform',
            'macosx',
            '--minimum-deployment-target',
            '12.0',
            '--app-icon',
            'Deckit',
            '--output-partial-info-plist',
            icon,
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] }
    );
    fs.rmSync(icon, { force: true });
    const { version } = JSON.parse(
        fs.readFileSync(path.join(assemble(archive, path.join(resources, 'app')), 'package.json'), 'utf8')
    );
    const plist = path.join(made, 'Contents', 'Info.plist');
    const keys = {
        CFBundleName: 'Deckit',
        CFBundleDisplayName: 'Deckit',
        CFBundleIdentifier: 'dev.deckit.app',
        CFBundleIconFile: 'Deckit',
        CFBundleIconName: 'Deckit',
        CFBundleShortVersionString: version,
        CFBundleVersion: version,
    };
    for (const [key, value] of Object.entries(keys)) execFileSync('plutil', ['-replace', key, '-string', value, plist]);
    // codesign says it replaces Electron's signature each time: what it says is shown only when it fails.
    const signed = spawnSync('codesign', ['--force', '--deep', '--sign', '-', made], { encoding: 'utf8' });
    if (signed.status !== 0) refuse(`${signed.stderr.trim()}\nDeckit.app could not be signed: the last one stays`);
    if (spawnSync('codesign', ['--verify', '--deep', made], { stdio: 'inherit' }).status !== 0)
        refuse('Deckit.app does not verify: the last one stays');
    fs.rmSync(app, { recursive: true, force: true });
    fs.renameSync(made, app);
    return `made .build/Deckit.app (deckit ${version}, Electron ${ELECTRON.VERSION}, dev.deckit.app, signed ad hoc)`;
}

module.exports = { builtArchive, assemble, make };
if (require.main === module) {
    try {
        console.log(make());
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    }
}
