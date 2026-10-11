const path = require('path');
const { app, protocol, net } = require('electron');
const { pathToFileURL } = require('url');

const lib = path.join(__dirname, 'deckit');

/* Run by `deckit dev`, Electron's default app loads this folder; Deckit.app has none. Not
   app.isPackaged: Electron reads that off the executable name, which Deckit.app keeps as Electron's. */
const DEV = !!process.defaultApp;
if (DEV) {
    const data = process.env.DECKIT_DEV_DATA;
    if (!data)
        throw new Error('[deckit] run from its sources, Deckit.app needs DECKIT_DEV_DATA: start it with `deckit dev`');
    app.setPath('userData', data);
    process.env.DECKIT_HOME = path.join(data, 'deckit');
    process.env.DECKIT_PLUGIN_SOURCES = path.join(lib, 'plugin');
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    // An origin of its own (deckit://app) so its localStorage persists. Electron requires this before ready.
    protocol.registerSchemesAsPrivileged([
        { scheme: 'deckit', privileges: { standard: true, secure: true, supportFetchAPI: true } },
    ]);

    for (const file of require('./load.json').main) require(path.join(__dirname, file));

    DeckitModule.use(
        ['deckit/feature/app/main', 'deckit/service/plugin/install', 'app/shell'],
        (BOOT, INSTALL, SHELL) => {
            if (!DEV) {
                const catalog = path.join(lib, 'plugin');
                const folders = require('fs')
                    .readdirSync(catalog)
                    .map((id) => path.join(catalog, id));
                try {
                    for (const { id, outcome } of INSTALL.installShipped(folders))
                        console.log(`[deckit] ${outcome} ${id}`);
                } catch (e) {
                    console.error('[deckit] the plugins Deckit ships were not installed', e);
                }
            }

            const PAGE = path.join(lib, 'page.html');
            app.whenReady().then(() => {
                protocol.handle('deckit', (request) => {
                    const { pathname } = new URL(request.url);
                    return pathname === '/page.html'
                        ? net.fetch(pathToFileURL(PAGE).toString())
                        : new Response('', { status: 404 });
                });
            });

            // relaunch() only queues the new instance; quit() still has to end this one.
            const restart = DEV
                ? () => app.exit(Number(process.env.DECKIT_DEV_RESTART) || 0)
                : () => {
                      app.relaunch();
                      app.quit();
                  };
            const shell = SHELL.make({ restart });
            BOOT.connect({
                assets: {
                    preload: path.join(__dirname, 'preload.js'),
                    load: (wc) => wc.loadURL('deckit://app/page.html'),
                    sandbox: true,
                },
                shell,
            });

            // The window-all-closed handler is empty so the app keeps running when its window closes.
            app.on('activate', () => shell.reveal());
            app.on('second-instance', () => shell.reveal());
            app.on('window-all-closed', () => {});
        }
    );
}
