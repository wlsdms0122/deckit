// Deckit.app, put together from the archive the last build left, started in the background with data of its own that
// is thrown away, and a client of it (devtools.js). The folders it is given, and the WebKit stores that came while it
// ran, go as the process exits.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, execSync } = require('child_process');

const root = path.join(__dirname, '..', '..', '..');
const APP = require(path.join(root, 'source', 'cli', 'app.js'));
const { launch } = require('./launch.js');
const { connect } = require('./devtools.js');
const { electronApp } = require(path.join(root, 'source', 'cli', 'electron.js'));

// The WebKit stores there before the first start: every other one is a start's.
let stored = null;

// An app's bundle identifier.
function bundleOf(app) {
    const plist = path.join(app, 'Contents', 'Info.plist');
    return execFileSync('plutil', ['-extract', 'CFBundleIdentifier', 'raw', plist], { encoding: 'utf8' }).trim();
}

function listing(folder) {
    return fs.existsSync(folder) ? fs.readdirSync(folder) : [];
}

// `seed({ data, files, app })` writes what the app finds as it starts; `shots` is where the client's pictures go, `log`
// the app's log, `port` its main process's inspector's, and `limit` how long the process may run, in ms. What the app
// was started with and the client's calls, with `endCore()`, which kills the app's core as a crash would, `logged()`,
// the app's log so far, `home`, the app's folder, `id`, the id it runs under, and `stop()`.
function start({ seed, shots, log, port, limit }) {
    const archive = APP.builtArchive();
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-test-app-'));
    const data = fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-test-data-'));
    // The folder of files has the same name every run: a page draws the name, and how wide it is drawn decides what
    // fits beside it.
    const held = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'deckit-test-files-')));
    const files = path.join(held, 'deckit-test-files');
    fs.mkdirSync(files);
    // WebKit keeps what the app's pages store for the app that runs it, Electron's, under an id the data folder's own:
    // the stores that came while the app ran are its, and go with its folders.
    const stores = path.join(os.homedir(), 'Library', 'WebKit', bundleOf(electronApp()), 'WebsiteDataStore');
    const before = (stored ??= new Set(listing(stores)));
    process.on('exit', () => {
        for (const made of [folder, data, held]) fs.rmSync(made, { recursive: true, force: true });
        for (const store of listing(stores))
            if (!before.has(store)) fs.rmSync(path.join(stores, store), { recursive: true, force: true });
    });
    APP.assemble(archive, folder);
    seed({ data, files, app: folder });
    const app = launch({ app: folder, data, port, log, limit });
    const module = path.join(fs.realpathSync(folder), 'deckit', 'deckit-web.node');
    const devtools = connect({ port, shots, module });
    // The app may name its folder through /private: the core is matched by the end of its path.
    const endCore = () => execSync(`pkill -9 -f -- '${path.basename(folder)}/deckit/deckit$'`);
    const logged = () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '');
    // The id the app runs under, as its configuration makes it of the data folder.
    process.env.DECKIT_DATA = data;
    const { id } = require(path.join(folder, 'config', 'config.js')).config;
    const stop = () => {
        devtools.close();
        app.stop();
    };
    return { ...devtools, endCore, logged, home: path.join(data, 'deckit'), data, files, id, stop };
}

module.exports = { start };
