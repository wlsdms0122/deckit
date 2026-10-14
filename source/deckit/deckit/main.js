DeckitModule.define(
    'deckit/main',
    {
        uses: [
            'deck/log/main',
            'deck/mod/manifest',
            'deck/mod/permission',
            'deckit/window',
            'deck/identity',
            'deck/main',
            'deck/sandbox',
            'deckit/web/session',
            'deckit/web/main',
            'deckit/keymap/main',
            'deckit/open/main',
            'deckit/notify/main',
            'deckit/clipboard/main',
            'deckit/runtime/main',
            'deck/event/main',
            'deckit/command/main',
            'deckit/main-process/main',
            'deckit/mod-folder/main',
            'deckit/api',
            'deckit/protocol',
            'deckit/model/permission',
            'deckit/open/model/scheme',
            'deck/sandbox/model/origin',
        ],
        provides: ['SCHEME', 'connect'],
    },
    (
        LOG,
        MANIFEST,
        MOD_PERMISSION,
        WINDOW,
        IDENTITY,
        DECK,
        SANDBOX,
        SESSION,
        WEB,
        KEYMAP,
        OPEN,
        NOTIFY,
        CLIPBOARD,
        RUNTIME,
        EVENT,
        COMMAND,
        MAIN_PROCESS,
        MOD_FOLDER,
        API,
        PROTOCOL,
        PERMISSIONS,
        SCHEMES,
        ORIGIN
    ) => {
        // MARK: - Property
        // The scheme deck's pages load from, for the host app's registerSchemesAsPrivileged.
        const SCHEME = SANDBOX.SCHEME;
        // What the host app answers deckit: the windows and the process are its own.
        const ANSWERS = ['openWindow', 'noticeClicked', 'restart'];
        const starting = []; // what starts with deckit, before any mod launches: the shell on it
        let connected = false;
        let started = false;

        // MARK: - Initializer
        // MARK: - Public
        // How a host app starts deckit, once, before it is ready: `preload` is the file it put together around deckit's
        // page bundles, and `host` answers what of deckit is the app's. Answers what the app and its shell reach of
        // deckit (feature/api).
        function connect({ preload, host } = {}) {
            if (connected) throw new Error('[deckit] connect is called once');
            const missing = ANSWERS.filter((name) => typeof host?.[name] !== 'function');
            if (missing.length) throw new Error(`[deckit] the host does not answer ${missing.join(', ')}`);
            if (!preload) throw new Error('[deckit] connect needs the preload deckit pages load with');
            connected = true;
            for (const permission of PERMISSIONS.PERMISSIONS)
                MOD_PERMISSION.define(permission, {
                    before: permission.id.startsWith('system.') ? PERMISSIONS.WIDER_THAN : null,
                });
            MANIFEST.define(SCHEMES.FIELD, SCHEMES.field());
            LOG.start();
            require('electron')
                .app.whenReady()
                .then(() => start(preload, host));
            return API.make({
                makeView: SANDBOX.view,
                onStart,
            });
        }

        // MARK: - Private
        // `listener` is told once, as deckit starts once the app is ready, before any mod launches. It is handed over
        // before then.
        function onStart(listener) {
            if (started) throw new Error('[deckit] what starts with deckit is handed over before the app is ready');
            starting.push(listener);
        }

        function start(preload, host) {
            DECK.prepare({ preload });
            WINDOW.start({ openWindow: (options) => host.openWindow(options) });
            WEB.start();
            KEYMAP.start();
            OPEN.start();
            NOTIFY.start({ clicked: () => host.noticeClicked() });
            CLIPBOARD.start();
            EVENT.start();
            COMMAND.start();
            MAIN_PROCESS.start();
            MOD_FOLDER.start();
            RUNTIME.start({ restart: () => host.restart() });
            PROTOCOL.setup.handle((_payload, sender) => {
                const page = IDENTITY.pageNameOf(sender);
                return page ? { page } : {};
            });
            KEYMAP.connect({ pageFor: WEB.pageFor });
            started = true;
            // What fails to start with deckit fails alone: the mods run whatever it did.
            for (const listener of starting) {
                try {
                    listener();
                } catch (error) {
                    LOG.error('what starts with deckit did not start', error);
                }
            }
            DECK.start({
                preparePage,
                describe: (mod) => ({
                    mainProcess: { running: MAIN_PROCESS.started(mod.id), failure: MAIN_PROCESS.failure(mod.id) },
                }),
                installed: (id) => {
                    MAIN_PROCESS.restartFor(id);
                    return { restart: MAIN_PROCESS.restartPending().some((pending) => pending.id === id) };
                },
                removed: MAIN_PROCESS.unload,
                forget: SESSION.forget,
            });
        }

        // A mod's page shows the web, hears the key map, and offers what it opens to the scheme's handlers: a window it
        // asks for, and a link that leaves its origin, which deck holds it to.
        function preparePage(webContents, mod) {
            WEB.host(webContents);
            KEYMAP.listen(webContents);
            const pressed = () => ({ userInitiated: IDENTITY.consumeUserActivation(webContents) });
            webContents.setWindowOpenHandler((details) => {
                OPEN.open(details.url, { ...WEB.windowOptions(details), ...pressed() });
                return { action: 'deny' };
            });
            const origin = ORIGIN.originOf(mod.id);
            LOG.guard(webContents, 'will-frame-navigate', (details) => {
                if (details.isMainFrame && !details.url.startsWith(origin + '/')) OPEN.open(details.url, pressed());
            });
        }

        return { SCHEME, connect };
    }
);
