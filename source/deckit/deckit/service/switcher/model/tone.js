DeckitModule.define(
    'deckit/service/switcher/model/tone',
    {
        uses: [],
        provides: ['TONES'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // A row of the switcher's Now strip says its state by name, and the list decides how each looks, so the strip
        // keeps one scale.
        const TONES = ['info', 'ok', 'warn', 'alert'];

        // MARK: - Initializer
        // MARK: - Public
        // MARK: - Private

        return { TONES };
    }
);
