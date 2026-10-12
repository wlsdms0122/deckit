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
        const SHIPS = ['editor', 'finder', 'note', 'browser', 'settings'];
        // Run from its sources by `deckit dev`, it keeps its data in the package's .dev/.
        const development = process.env.DECKIT_DEV_DATA;

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return {
            home: development ? path.join(development, 'deckit') : null,
            ship: SHIPS.map((id) => path.join(__dirname, 'deckit', 'plugin', id)),
        };
    }
);
