DeckitModule.define(
    'deck/service/deck/record',
    {
        uses: ['deck/service/storage', 'deck/service/deck/identity', 'deck/service/deck/protocol'],
        provides: ['start'],
        runs: 'main',
    },
    (STORAGE, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // A mod reaches its own records and no one else's: which ones is who asked.
        function start() {
            PROTOCOL.readRecord.handle(({ key }, sender) => STORAGE.records.read(IDENTITY.modFrom(sender).id, key));
            PROTOCOL.writeRecord.handle(({ key, value }, sender) => {
                STORAGE.records.write(IDENTITY.modFrom(sender).id, key, value);
                return true;
            });
            PROTOCOL.removeRecord.handle(({ key }, sender) => {
                STORAGE.records.remove(IDENTITY.modFrom(sender).id, key);
                return true;
            });
            PROTOCOL.recordKeys.handle((_payload, sender) => STORAGE.records.keys(IDENTITY.modFrom(sender).id));
        }

        // MARK: - Private

        return { start };
    }
);
