DeckitModule.define(
    'deckit/service/clipboard/main',
    {
        uses: ['deckit/service/deck/identity', 'deckit/service/clipboard/protocol'],
        provides: ['start'],
    },
    (IDENTITY, PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // From main: a page reaches the clipboard only while it has focus, and a command picked in the switcher runs
        // in a mod's view while the switcher has it. Copying is everyone's; reading what was copied is
        // system.clipboard.
        function start() {
            const { clipboard } = require('electron');
            PROTOCOL.readText.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, 'system.clipboard');
                return clipboard.readText();
            });
            PROTOCOL.writeText.handle(({ text }, sender) => {
                IDENTITY.modFrom(sender);
                clipboard.writeText(text);
                return true;
            });
        }

        // MARK: - Private

        return { start };
    }
);
