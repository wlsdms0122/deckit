DeckitModule.define(
    'deckit/service/clipboard/view',
    {
        uses: ['deckit/service/clipboard/protocol'],
        provides: ['readText', 'writeText'],
    },
    (PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        function readText() {
            return PROTOCOL.readText.invoke();
        }

        function writeText(text) {
            return PROTOCOL.writeText.invoke({ text: String(text ?? '') });
        }

        // MARK: - Private

        return { readText, writeText };
    }
);
