DeckitModule.define(
    'deckit/service/runtime/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/runtime/protocol',
            'deckit/service/build',
        ],
        provides: ['start'],
    },
    (CONFIG, HOME, LOG, IDENTITY, PROTOCOL, BUILD) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // `restart` is the app's: the process is its own.
        function start({ restart }) {
            const { app } = require('electron');
            PROTOCOL.about.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender);
                return {
                    version: BUILD.VERSION,
                    source: BUILD.SOURCE,
                    name: CONFIG.name,
                    home: require('os').homedir(),
                    app: `${app.getName()} ${app.getVersion()}`,
                    electron: process.versions.electron,
                    chrome: process.versions.chrome,
                    plugins: HOME.plugins,
                    data: HOME.data,
                    log: LOG.file(),
                };
            });
            PROTOCOL.restart.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                restart();
                return true;
            });
        }

        // MARK: - Private

        return { start };
    }
);
