// Deckit.app's Electron entry: deckit's main bundle around the app's own files, then connect.
const path = require('path');
const { app, protocol } = require('electron');

// Run unpackaged, Electron's default app loads this folder; Deckit.app has none. Not app.isPackaged: Electron reads
// that off the executable's name, which Deckit.app keeps as Electron's. Unpackaged, it keeps all its data in the
// folder DECKIT_DATA names, never the person's, and a restart is asked of whoever started it, by exiting with RESTART.
const UNPACKAGED = !!process.defaultApp;
const RESTART = 75;
if (UNPACKAGED) {
    if (!process.env.DECKIT_DATA)
        throw new Error('[deckit] run unpackaged, Deckit.app needs DECKIT_DATA: its data folder');
    app.setPath('userData', process.env.DECKIT_DATA);
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    for (const file of require('./load.json').main) require(path.join(__dirname, file));
    DeckitModule.use(['deckit/feature/app/main', 'deckit-ui/feature/app/main', 'host/shell'], (DECKIT, UI, SHELL) => {
        protocol.registerSchemesAsPrivileged([DECKIT.SCHEME]);
        // A restart is a quit, so every mod stops first. relaunch() only queues the new instance.
        const restart = () => {
            if (UNPACKAGED) app.once('quit', () => app.exit(RESTART));
            else app.relaunch();
            app.quit();
        };
        const shell = SHELL.make({ restart });
        const deckit = DECKIT.connect({ preload: path.join(__dirname, 'preload.js'), shell });
        UI.attach(deckit, { shell });
        // Closing the window leaves the app running; the Dock icon and a second launch bring the panel back.
        app.on('activate', () => shell.reveal());
        app.on('second-instance', () => shell.reveal());
        app.on('window-all-closed', () => {});
    });
}
