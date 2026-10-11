DeckitModule.define(
    'deckit/module/clipboard/client',
    {
        uses: ['deckit/module/clipboard/model/protocol'],
        provides: ['readText', 'writeText'],
    },
    (PROTOCOL) =>
        Object.freeze({
            readText: () => PROTOCOL.read.ask(),
            writeText: (text) => PROTOCOL.write.ask({ text: String(text ?? '') }),
        })
);
