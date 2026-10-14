DeckitModule.define(
    'host/folders',
    {
        uses: [],
        provides: ['home', 'ship'],
        runs: 'node',
    },
    () => {
        // MARK: - Property
        const path = require('path');
        // The mods Deckit ships, in their order until the person changes it: the panel lists those with a view.
        const SHIPS = ['editor', 'finder', 'note', 'browser', 'calendar', 'settings', 'deckit'];
        // Run unpackaged, all its data is in the folder DECKIT_DATA names (main.js).
        const data = process.env.DECKIT_DATA;

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return {
            home: data ? path.join(data, 'deckit') : null,
            ship: SHIPS.map((id) => path.join(__dirname, 'deckit', 'mod', id)),
        };
    }
);
