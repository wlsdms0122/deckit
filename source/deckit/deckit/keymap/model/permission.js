DeckitModule.define(
    'deckit/keymap/model/permission',
    {
        uses: [],
        provides: ['GLOBAL_KEYS', 'KEY_MAP'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // The ids of the permissions this service checks; what each grants is in the app's list.
        const GLOBAL_KEYS = 'system.global-keys';
        const KEY_MAP = 'deckit.key-map';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { GLOBAL_KEYS, KEY_MAP };
    }
);
