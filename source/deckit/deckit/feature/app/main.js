DeckitModule.define(
    'deckit/feature/app/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/deck',
            'deckit/service/plugin/deck/lifecycle',
            'deckit/service/web/session',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/service/notify/main',
            'deckit/service/clipboard/main',
            'deckit/service/runtime/main',
            'deckit/feature/panel/main',
            'deckit/feature/switcher/main',
            'deckit/feature/app/protocol',
        ],
        provides: ['SCHEME', 'connect'],
    },
    (
        CONFIG,
        LOG,
        WINDOW,
        INSTALL,
        IDENTITY,
        DECK,
        LIFECYCLE,
        SESSION,
        WEB,
        KEYMAP,
        OPEN,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        PANEL,
        SWITCHER,
        PROTOCOL
    ) => {
        // MARK: - Property
        // The scheme deckit's pages load from. Electron takes privileged schemes in one call before the app is ready,
        // and the app makes that call, so it adds this one to its own.
        const SCHEME = { scheme: 'deckit', privileges: { standard: true, secure: true, supportFetchAPI: true } };
        // What a shell answers: where deckit is shown is the app's.
        const ANSWERS = [
            'start',
            'showsPanel',
            'reveal',
            'dismiss',
            'summonSwitcher',
            'openWindow',
            'panelTitled',
            'noticeClicked',
            'restart',
        ];
        let connected = false;
        let theme = null; // the app's, which every deckit page derives its look from

        // MARK: - Initializer
        // MARK: - Public
        // How an app starts deckit, once, before it is ready: `preload` is the file it put together around deckit's
        // page bundle, and `shell` answers where deckit is shown.
        function connect({ preload, shell } = {}) {
            if (connected) throw new Error('[deckit] connect is called once');
            const missing = ANSWERS.filter((name) => typeof shell?.[name] !== 'function');
            if (missing.length) throw new Error(`[deckit] the shell does not answer ${missing.join(', ')}`);
            if (!preload) throw new Error('[deckit] connect needs the preload deckit pages load with');
            connected = true;
            LOG.start();
            require('electron')
                .app.whenReady()
                .then(() => start(preload, shell));
        }

        // MARK: - Private
        function start(preload, shell) {
            serve();
            if (CONFIG.ship.length) {
                for (const { id, outcome } of INSTALL.installShipped()) LOG.info(`${outcome} ${id}`);
            }
            WINDOW.start({ openWindow: (options) => shell.openWindow(options) });
            DECK.start();
            WEB.start();
            KEYMAP.start();
            OPEN.start();
            NOTIFY.start({ clicked: () => shell.noticeClicked() });
            CLIPBOARD.start();
            RUNTIME.start({ restart: () => shell.restart() });
            PROTOCOL.setup.handle((_payload, sender) => ({
                role: IDENTITY.isSwitcher(sender) ? 'switcher' : 'plugin',
                theme,
            }));
            PANEL.start({ shell });
            SWITCHER.start({ makeView: () => pageView(preload, false), shell });
            KEYMAP.connect({ pageOf: LIFECYCLE.pageFor, showsPanel: PANEL.showsPanel, dismisses: PANEL.dismisses });
            LIFECYCLE.start({ makePage: () => pageView(preload, true) });
            shell.start({
                setTheme,
                panel: PANEL.deck,
                switcher: SWITCHER.deck,
                window: { place: WINDOW.place },
                keymap: { listen: KEYMAP.listen },
            });
        }

        // A new theme makes every page again, which draws in it from the start.
        function setTheme(next) {
            if (JSON.stringify(next) === JSON.stringify(theme)) return;
            theme = next;
            LIFECYCLE.reload();
            SWITCHER.reload();
        }

        // Every page of deckit's is the same page.html, whichever origin it is loaded under: what it becomes is asked of
        // main as it starts. Under a plugin's origin the rest of its folder is served too, for its page to use: images,
        // styles, data, scripts.
        function serve() {
            const { net } = require('electron');
            const path = require('path');
            const { pathToFileURL } = require('url');
            const page = pathToFileURL(path.join(__dirname, 'page.html')).toString();
            const missing = () => new Response('', { status: 404 });
            const own = SESSION.own();
            own.protocol.handle(SCHEME.scheme, (request) => {
                const { host, pathname } = new URL(request.url);
                if (pathname === '/') return net.fetch(page);
                const id = host.endsWith('.plugin') ? host.slice(0, -'.plugin'.length) : null;
                const folder = DECK.plugins().find((entry) => entry.id === id)?.folder;
                const file = folder && servedFile(folder, pathname);
                return file ? net.fetch(pathToFileURL(file).toString()).catch(missing) : missing();
            });
            // Electron grants every permission a session has no handler for. A plugin reaches the camera, the
            // clipboard or a notice through deckit's API, which holds it to its permissions, and never through the web's.
            own.setPermissionRequestHandler((_webContents, _permission, answer) => answer(false));
            own.setPermissionCheckHandler(() => false);
        }

        // The file of the plugin's folder a path names, where it really is: a link out of the folder and a path that
        // is not one are not served.
        function servedFile(folder, pathname) {
            const fs = require('fs');
            const path = require('path');
            let real;
            try {
                const root = fs.realpathSync(folder);
                real = fs.realpathSync(path.resolve(root, '.' + decodeURIComponent(pathname)));
                const inside = path.relative(root, real);
                if (!inside || inside.split(path.sep)[0] === '..' || path.isAbsolute(inside)) return null;
            } catch {
                return null;
            }
            return real;
        }

        // A deckit view: sandboxed, isolated, in deckit's own session, and clear, so the glass under it shows.
        function pageView(preload, webview) {
            const { WebContentsView } = require('electron');
            const view = new WebContentsView({
                webPreferences: {
                    preload,
                    session: SESSION.own(),
                    sandbox: true,
                    contextIsolation: true,
                    webviewTag: webview,
                    transparent: true,
                },
            });
            view.setBackgroundColor('#00000000');
            view.setVisible(false);
            return view;
        }

        return { SCHEME, connect };
    }
);
