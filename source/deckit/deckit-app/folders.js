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
        // The plugins Deckit ships, in the order its panel lists them until the person changes it.
        const SHIPS = ['editor', 'finder', 'note', 'browser', 'settings', 'deckit'];
        // Run unpackaged, all its data is in the folder DECKIT_DATA names (main.js).
        const data = process.env.DECKIT_DATA;

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return {
            home: data ? path.join(data, 'deckit') : null,
            ship: SHIPS.map((id) => path.join(__dirname, 'deckit', 'plugin', id)),
        };
    }
);
