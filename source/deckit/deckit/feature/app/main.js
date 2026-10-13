DeckitModule.define(
    'deckit/feature/app/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/deck/install',
            'deckit/service/plugin/folder',
            'deckit/service/deck/identity',
            'deckit/service/deck/main',
            'deckit/service/deck/catalog',
            'deckit/service/deck/runner',
            'deckit/service/web/session',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/service/notify/main',
            'deckit/service/clipboard/main',
            'deckit/service/runtime/main',
            'deckit/service/event/main',
            'deckit/feature/panel/main',
            'deckit/feature/switcher/main',
            'deckit/feature/app/protocol',
            'deckit/service/deck/model/origin',
        ],
        provides: ['SCHEME', 'connect'],
    },
    (
        CONFIG,
        LOG,
        WINDOW,
        INSTALL,
        FOLDER,
        IDENTITY,
        DECK,
        CATALOG,
        RUNNER,
        SESSION,
        WEB,
        KEYMAP,
        OPEN,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        EVENT,
        PANEL,
        SWITCHER,
        PROTOCOL,
        ORIGIN
    ) => {
        // MARK: - Property
        // Electron takes privileged schemes in one call to registerSchemesAsPrivileged, before the app is ready, and a
        // later call replaces an earlier one; the app makes it, with deckit's scheme beside its own.
        const SCHEME = ORIGIN.SCHEME;
        // Every deckit page. deckit and a plugin's entry run in the preload's isolated world, whose code the policy
        // leaves alone; the page's own world runs only scripts from its origin, a plugin's own files. What the isolated
        // world loads the policy still holds, so the ranker's blob worker is named. Transparent: the view is a
        // rectangle, and what is rounded is drawn inside it. No drag selection: text meant to be copied opts in
        // (ui.selectable).
        const PAGE = [
            '<!doctype html>',
            '<meta charset="utf-8">',
            '<title></title>',
            `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`,
            '<style>',
            '  html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }',
            '  body { -webkit-user-select: none; user-select: none; }',
            '</style>',
            '',
        ].join('\n');
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
                for (const { id, outcome, problem } of INSTALL.installShipped())
                    if (problem) LOG.warn(`${id} did not install: ${problem}`);
                    else LOG.info(`${outcome} ${id}`);
            }
            WINDOW.start({ openWindow: (options) => shell.openWindow(options) });
            WEB.start();
            KEYMAP.start();
            OPEN.start();
            NOTIFY.start({ clicked: () => shell.noticeClicked() });
            CLIPBOARD.start();
            EVENT.start();
            RUNTIME.start({ restart: () => shell.restart() });
            PROTOCOL.setup.handle((_payload, sender) => ({
                role: IDENTITY.isSwitcher(sender) ? 'switcher' : 'plugin',
                theme,
            }));
            PANEL.start({ shell });
            SWITCHER.start({ makeView: () => pageView(preload, { plugin: false }), shell });
            KEYMAP.connect({ pageFor: WEB.pageFor, showsPanel: PANEL.showsPanel, dismisses: PANEL.dismisses });
            DECK.start({ makeView: () => pageView(preload, { plugin: true }) });
            shell.start({
                setTheme,
                panel: PANEL.control,
                switcher: SWITCHER.control,
                window: { place: WINDOW.place },
                keymap: { listen: KEYMAP.listen },
            });
        }

        // A new theme makes every page again, which draws in it from the start.
        function setTheme(next) {
            if (JSON.stringify(next) === JSON.stringify(theme)) return;
            theme = next;
            RUNNER.restart();
            SWITCHER.reload();
        }

        // Every page of deckit's is the same PAGE, whichever origin it is loaded under: what it becomes is asked of
        // main as it starts. Under a plugin's origin the rest of its folder is served too, for its page to use: images,
        // styles, data, scripts.
        function serve() {
            const { net } = require('electron');
            const { pathToFileURL } = require('url');
            const missing = () => new Response('', { status: 404 });
            const own = SESSION.own();
            own.protocol.handle(SCHEME.scheme, (request) => {
                const { host, pathname } = new URL(request.url);
                if (pathname === '/')
                    return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
                const id = ORIGIN.pluginOfHost(host);
                const folder = CATALOG.plugins().find((plugin) => plugin.id === id)?.folder;
                const file = folder && servedFile(folder, pathname);
                return file ? net.fetch(pathToFileURL(file).toString()).catch(missing) : missing();
            });
            // Electron grants every permission a session has no handler for. A plugin reaches the camera, the
            // clipboard or a notice through deckit's API, which holds it to its permissions, and never through the web's.
            own.setPermissionRequestHandler((_webContents, _permission, answer) => answer(false));
            own.setPermissionCheckHandler(() => false);
        }

        // The file of the plugin's folder a path names: a link out of the folder and a path that is not one are not
        // served.
        function servedFile(folder, pathname) {
            try {
                return FOLDER.fileIn(folder, '.' + decodeURIComponent(pathname))?.file || null;
            } catch {
                return null;
            }
        }

        // A deckit view: sandboxed, isolated, in deckit's own session, and clear, so the glass under it shows. A
        // plugin's page may show the web.
        function pageView(preload, { plugin }) {
            const { WebContentsView } = require('electron');
            const view = new WebContentsView({
                webPreferences: {
                    preload,
                    session: SESSION.own(),
                    sandbox: true,
                    contextIsolation: true,
                    webviewTag: plugin,
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
