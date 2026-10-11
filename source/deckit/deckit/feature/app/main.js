DeckitModule.define(
    'deckit/feature/app/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/plugin/package/install',
            'deckit/service/plugin/host',
            'deckit/service/web/session',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/service/notify/main',
            'deckit/service/clipboard/main',
            'deckit/service/runtime/main',
            'deckit/feature/panel/main',
            'deckit/feature/switcher/main',
        ],
        provides: ['SCHEME', 'connect'],
    },
    (CONFIG, LOG, WINDOW, INSTALL, HOST, SESSION, WEB, KEYMAP, OPEN, NOTIFY, CLIPBOARD, RUNTIME, PANEL, SWITCHER) => {
        // MARK: - Property
        // The scheme deckit's pages load from. Electron takes privileged schemes in one call before the app is ready,
        // and the app makes that call, so it adds this one to its own.
        const SCHEME = { scheme: 'deckit', privileges: { standard: true, secure: true, supportFetchAPI: true } };
        // What a shell answers: where deckit is shown is the app's.
        const ANSWERS = ['start', 'showsPanel', 'reveal', 'dismiss', 'summonSwitcher', 'noticeClicked', 'restart'];
        let connected = false;

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
            HOST.start();
            WEB.start();
            KEYMAP.start();
            OPEN.start();
            NOTIFY.start({ clicked: () => shell.noticeClicked() });
            CLIPBOARD.start();
            RUNTIME.start({ restart: () => shell.restart() });
            const makeView = (origin, { webview }) => viewOf(preload, webview);
            PANEL.start({ makeView, shell });
            SWITCHER.start({ makeView, shell });
            shell.start({
                panel: PANEL.deck,
                switcher: SWITCHER.deck,
                window: {
                    open: WINDOW.open,
                    get: WINDOW.get,
                    close: WINDOW.close,
                    raise: WINDOW.raise,
                    place: WINDOW.place,
                },
                keymap: { listen: KEYMAP.listen },
            });
        }

        // Every page of deckit's is the same page.html, whichever origin it is loaded under: what it becomes is asked of
        // main as it starts.
        function serve() {
            const { net } = require('electron');
            const path = require('path');
            const { pathToFileURL } = require('url');
            const page = pathToFileURL(path.join(__dirname, 'page.html')).toString();
            SESSION.own().protocol.handle(SCHEME.scheme, (request) => {
                const { pathname } = new URL(request.url);
                return pathname === '/' ? net.fetch(page) : new Response('', { status: 404 });
            });
        }

        // A deckit view: sandboxed, isolated, in deckit's own session, and clear, so the glass under it shows.
        function viewOf(preload, webview) {
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
