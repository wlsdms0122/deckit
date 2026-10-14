DeckitModule.define(
    'deckit/config',
    {
        uses: ['host/config?', 'host/folders?', 'deck/config'],
        provides: ['id', 'name', 'agent', 'schemeHandlers'],
        runs: 'any',
    },
    (config, folders, DECK) => {
        // MARK: - Property
        // From host/config, read in every process, beside deck's. name: what a person reads. agent: names in the app's
        // user agent, taken out of a web page's. schemeHandlers: by scheme, the mods asked first to open an address.
        const CONFIG = { name: 'Deckit', agent: [], schemeHandlers: {} };

        // MARK: - Initializer
        refuseUnknown('host/config', config, [...DECK.KEYS.config, ...Object.keys(CONFIG)]);
        refuseUnknown('host/folders', folders, DECK.KEYS.folders);

        // MARK: - Public
        // MARK: - Private
        function refuseUnknown(module, given, known) {
            const unknown = Object.keys(given || {}).filter((key) => !known.includes(key));
            if (unknown.length)
                throw new Error(`[deckit] ${module} sets ${unknown.join(', ')}, which deckit does not read`);
        }

        const given = { ...CONFIG, ...config };

        return { id: DECK.id, name: given.name, agent: given.agent, schemeHandlers: given.schemeHandlers };
    }
);
