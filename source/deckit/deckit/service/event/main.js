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
        const listening = new Map(); // a plugin's page -> the event names it listens to

        // MARK: - Initializer
        // MARK: - Public
        // Plugins say what happened to them through deck, never to each other: an event is named after the plugin that
        // sent it, which main knows by the page it came from, so none speaks for another. It goes to the pages that
        // listen to it, and only from a plugin that is running.
        function start() {
            PROTOCOL.listen.on(({ names }, sender) => {
                IDENTITY.pluginFrom(sender);
                if (!listening.has(sender)) IDENTITY.whenPageEnds(sender, () => listening.delete(sender));
                listening.set(sender, new Set(names));
            });
            PROTOCOL.emit.on(({ name, args }, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                if (RUNNER.runOf(plugin.id)?.state !== 'running') return;
                const named = NAME.nameOf(plugin.id, name);
                for (const [page, names] of listening)
                    if (names.has(named)) PROTOCOL.event.send(page, { name: named, args });
            });
        }

        // MARK: - Private

        return { start };
    }
);
