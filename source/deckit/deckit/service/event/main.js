DeckitModule.define(
    'deckit/service/event/main',
    {
        uses: [
            'deckit/service/deck/identity',
            'deckit/service/deck/runner',
            'deckit/service/event/protocol',
            'deckit/service/event/model/name',
        ],
        provides: ['start'],
    },
    (IDENTITY, RUNNER, PROTOCOL, NAME) => {
        // MARK: - Property
        const listening = new Map(); // a mod's page -> the event names it listens to

        // MARK: - Initializer
        // MARK: - Public
        // Mods say what happened to them through deck, never to each other: an event is named after the mod that
        // sent it, which main knows by the page it came from, so none speaks for another. It goes to the pages that
        // listen to it, and only from a mod that is running.
        function start() {
            PROTOCOL.listen.on(({ names }, sender) => {
                IDENTITY.modFrom(sender);
                if (!listening.has(sender)) IDENTITY.whenPageEnds(sender, () => listening.delete(sender));
                listening.set(sender, new Set(names));
            });
            PROTOCOL.emit.on(({ name, args }, sender) => {
                const mod = IDENTITY.modFrom(sender);
                if (RUNNER.runOf(mod.id)?.state !== 'running') return;
                const named = NAME.nameOf(mod.id, name);
                for (const [page, names] of listening)
                    if (names.has(named)) PROTOCOL.event.send(page, { name: named, args });
            });
        }

        // MARK: - Private

        return { start };
    }
);
