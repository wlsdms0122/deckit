DeckitModule.define(
    'deckit/service/runtime/main',
    {
        uses: [
            'deckit/config',
            'deck/service/home',
            'deck/service/log/main',
            'deck/service/deck/identity',
            'deckit/service/runtime/protocol',
            'deckit/service/build',
            'deck/service/mod/permission',
        ],
        provides: ['start'],
    },
    (CONFIG, HOME, LOG, IDENTITY, PROTOCOL, BUILD, MOD_PERMISSION) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // `restart` is the app's: the process is its own.
        function start({ restart }) {
            const { app } = require('electron');
            PROTOCOL.about.handle((_payload, sender) => {
                IDENTITY.modFrom(sender);
                return {
                    version: BUILD.VERSION,
                    source: BUILD.SOURCE,
                    name: CONFIG.name,
                    home: require('os').homedir(),
                    app: `${app.getName()} ${app.getVersion()}`,
                    electron: process.versions.electron,
                    chrome: process.versions.chrome,
                    mods: HOME.mods,
                    data: HOME.data,
                    log: LOG.file(),
                };
            });
            PROTOCOL.restart.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
                restart();
                return true;
            });
        }

        // MARK: - Private

        return { start };
    }
);
