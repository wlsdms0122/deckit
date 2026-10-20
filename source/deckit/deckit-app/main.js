// Deckit.app's Electron entry: deckit's main bundles, the app's own files, then connect.
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
    const DECKIT = require('./deckit/main.js');
    const SHELL = require('./deckit/shell-main.js');
    const { config, folders } = require('./config.js');
    const { createWindow } = require('./window.js');
    const { createApp } = require('./app.js');
    const { createTheme } = require('./theme.js');
    protocol.registerSchemesAsPrivileged([DECKIT.SCHEME]);
    // A restart is a quit, so every mod stops first. relaunch() only queues the new instance.
    const restart = () => {
        if (UNPACKAGED) app.once('quit', () => app.exit(RESTART));
        else app.relaunch();
        app.quit();
    };
    const THEME = createTheme();
    const host = createApp({ WINDOW: createWindow({ CONFIG: config, THEME }), THEME }).make({ restart });
    const deckit = DECKIT.connect({
        preload: path.join(__dirname, 'preload.js'),
        core: path.join(__dirname, 'deckit', require('./deckit/deckit.json').core),
        host,
        config,
        folders,
    });
    SHELL.attach(deckit, { host });
    // Closing the window leaves the app running; the Dock icon and a second launch bring the panel back.
    app.on('activate', () => host.show());
    app.on('second-instance', () => host.show());
    app.on('window-all-closed', () => {});
}
