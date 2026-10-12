// Deckit.app's Electron entry: deckit's main bundle around the app's own files, then connect.
const path = require('path');
const { app, protocol } = require('electron');

// Started by `deckit dev`, Electron's default app loads this folder; Deckit.app has none. Not app.isPackaged: Electron
// reads that off the executable's name, which Deckit.app keeps as Electron's.
const DEVELOPMENT = !!process.defaultApp;
if (DEVELOPMENT) {
    if (!process.env.DECKIT_DEV_DATA) throw new Error('[deckit] run from its sources, start it with `deckit dev`');
    app.setPath('userData', process.env.DECKIT_DEV_DATA);
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    for (const file of require('./load.json').main) require(path.join(__dirname, file));
    DeckitModule.use(['deckit/feature/app/main', 'host/shell'], (DECKIT, SHELL) => {
        protocol.registerSchemesAsPrivileged([DECKIT.SCHEME]);
        // relaunch() only queues the new instance; quit() still has to end this one.
        const restart = DEVELOPMENT
            ? () => app.exit(Number(process.env.DECKIT_DEV_RESTART) || 0)
            : () => {
                  app.relaunch();
                  app.quit();
              };
        const shell = SHELL.make({ restart });
        DECKIT.connect({ preload: path.join(__dirname, 'preload.js'), shell });
        // Closing the window leaves the app running; the Dock icon and a second launch bring the panel back.
        app.on('activate', () => shell.reveal());
        app.on('second-instance', () => shell.reveal());
        app.on('window-all-closed', () => {});
    });
}
