DeckitModule.define(
    'deckit/feature/app/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host',
            'deckit/service/plugin/host/lifecycle',
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
        HOST,
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
            HOST.start();
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
        // main as it starts.
        function serve() {
            const { net } = require('electron');
            const path = require('path');
            const { pathToFileURL } = require('url');
            const page = pathToFileURL(path.join(__dirname, 'page.html')).toString();
            const own = SESSION.own();
            own.protocol.handle(SCHEME.scheme, (request) => {
                const { pathname } = new URL(request.url);
                return pathname === '/' ? net.fetch(page) : new Response('', { status: 404 });
            });
            // Electron grants every permission a session has no handler for. A plugin reaches the camera, the
            // clipboard or a notice through deckit's API, which holds it to its permissions, and never through the web's.
            own.setPermissionRequestHandler((_webContents, _permission, answer) => answer(false));
            own.setPermissionCheckHandler(() => false);
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
