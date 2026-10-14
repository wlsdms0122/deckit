DeckitModule.define(
    'deck/config',
    {
        uses: ['host/config?', 'host/folders?'],
        provides: ['KEYS', 'id', 'home', 'ship', 'sources'],
        runs: 'any',
    },
    (config, folders) => {
        // MARK: - Property
        // From host/config, read in every process. id: what everything deck keeps is named from.
        const CONFIG = { id: 'deckit' };
        // From host/folders, read where there is a disk. home: deck's folder, ~/.config/<id> when unset.
        // ship: the mod folders the app ships. sources: mod folders read in place, ahead of installed ones.
        const FOLDERS = { home: null, ship: [], sources: [] };
        // What deck reads of each, for whoever holds the host app to what it sets.
        const KEYS = Object.freeze({ config: Object.keys(CONFIG), folders: Object.keys(FOLDERS) });

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        const given = { ...CONFIG, ...config, ...FOLDERS, ...folders };

        return { KEYS, id: given.id, home: given.home, ship: given.ship, sources: given.sources };
    }
);
