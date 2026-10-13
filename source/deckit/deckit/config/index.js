DeckitModule.define(
    'deckit/config',
    {
        uses: ['host/config?', 'host/folders?'],
        provides: ['id', 'name', 'agent', 'schemeHandlers', 'home', 'ship', 'sources'],
        runs: 'any',
    },
    (config, folders) => {
        // MARK: - Property
        // From host/config, read in every process. id: what everything deckit keeps is named from. agent: names in
        // the app's user agent, taken out of a web page's. schemeHandlers: by scheme, the plugins asked first to open an address.
        const CONFIG = { id: 'deckit', name: 'Deckit', agent: [], schemeHandlers: {} };
        // From host/folders, read where there is a disk. home: deckit's folder, ~/.config/<id> when unset.
        // ship: the plugin folders the app ships. sources: plugin folders read in place, ahead of installed ones.
        const FOLDERS = { home: null, ship: [], sources: [] };

        // MARK: - Initializer
        refuseUnknown('host/config', config, CONFIG);
        refuseUnknown('host/folders', folders, FOLDERS);

        // MARK: - Public
        // MARK: - Private
        function refuseUnknown(module, given, known) {
            const unknown = Object.keys(given || {}).filter((key) => !Object.hasOwn(known, key));
            if (unknown.length)
                throw new Error(`[deckit] ${module} sets ${unknown.join(', ')}, which deckit does not read`);
        }

        return { ...CONFIG, ...config, ...FOLDERS, ...folders };
    }
);
