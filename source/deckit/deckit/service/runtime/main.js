DeckitModule.define(
    'deckit/service/runtime/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/home',
            'deckit/service/log/main',
            'deckit/service/plugin/identity',
            'deckit/service/runtime/model/protocol',
        ],
        provides: ['start'],
    },
    (CONFIG, HOME, LOG, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // `restart` is the app's: the process is its own.
        function start({ restart }) {
            const { app } = require('electron');
            const build = buildOf();
            PROTOCOL.about.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender);
                return {
                    ...build,
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
        // The build writes what it built beside the bundle; a deckit run from its sources has none.
        function buildOf() {
            const file = path.join(__dirname, 'deckit.json');
            if (!fs.existsSync(file)) return { version: null, source: null };
            const { version, source } = JSON.parse(fs.readFileSync(file, 'utf8'));
            return { version, source };
        }

        return { start };
    }
);
