DeckitModule.define(
    'deckit/service/keymap/model/permission',
    {
        uses: [],
        provides: ['GLOBAL_KEYS', 'KEY_MAP'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What a mod holds for keys that work wherever the person is in the app, and to change every mod's keys.
        const GLOBAL_KEYS = 'system.global-keys';
        const KEY_MAP = 'deckit.key-map';

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { GLOBAL_KEYS, KEY_MAP };
    }
);
