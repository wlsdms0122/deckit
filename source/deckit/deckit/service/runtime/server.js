DeckitModule.define(
    'deckit/service/runtime/server',
    {
        uses: [
            'deckit/service/home/model/config',
            'deckit/service/home',
            'deckit/service/log',
            'deckit/service/storage',
            'deckit/service/runtime/model/protocol',
        ],
        provides: ['connect'],
    },
    (CONFIG, home, log, storage, PROTOCOL) => {
        const { app } = require('electron');
        const fs = require('fs');
        const path = require('path');

        // Written by the app's build beside this bundle; absent when the app runs from its sources.
        const buildInfo = (() => {
            try {
                return JSON.parse(fs.readFileSync(path.join(__dirname, `${CONFIG.id}-build.json`), 'utf8'));
            } catch {
                return { version: null, builtAt: null, source: null };
            }
        })();

        PROTOCOL.about.answer(() => ({
            ...buildInfo,
            name: CONFIG.name,
            app: `${app.getName()} ${app.getVersion()}`,
            electron: process.versions.electron,
            chrome: process.versions.chrome,
            pluginRoot: home.pluginInstall.root,
            dataRoot: storage.root,
            logFile: log.file || null,
        }));

        let restart = null;
        PROTOCOL.restart.answer(() => {
            if (!restart) return false;
            try {
                restart();
                return true;
            } catch (e) {
                console.error("[deckit] the app's restart threw", e);
                return false;
            }
        });

        return Object.freeze({
            connect: ({ restart: r } = {}) => {
                restart = typeof r === 'function' ? r : null;
            },
        });
    }
);
