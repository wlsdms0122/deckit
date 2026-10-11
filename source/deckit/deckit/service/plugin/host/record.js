DeckitModule.define(
    'deckit/service/plugin/host/record',
    {
        uses: ['deckit/service/storage', 'deckit/service/plugin/identity', 'deckit/service/plugin/host/model/protocol'],
        provides: ['start'],
        runs: 'main',
    },
    (STORAGE, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // A plugin reaches its own records and no one else's: which ones is who asked.
        function start() {
            PROTOCOL.readRecord.handle(({ key }, sender) => STORAGE.records.read(IDENTITY.pluginFrom(sender).id, key));
            PROTOCOL.writeRecord.handle(({ key, value }, sender) => {
                STORAGE.records.write(IDENTITY.pluginFrom(sender).id, key, value);
                return true;
            });
            PROTOCOL.removeRecord.handle(({ key }, sender) => {
                STORAGE.records.remove(IDENTITY.pluginFrom(sender).id, key);
                return true;
            });
            PROTOCOL.recordKeys.handle((_payload, sender) => STORAGE.records.keys(IDENTITY.pluginFrom(sender).id));
        }

        // MARK: - Private

        return { start };
    }
);
