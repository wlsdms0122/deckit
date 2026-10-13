DeckitModule.define(
    'deckit/service/event/model/name',
    {
        uses: [],
        provides: ['nameOf', 'isNamed'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // A plugin id holds no colon, so the first one ends it.
        const SEPARATOR = ':';

        // MARK: - Initializer
        // MARK: - Public
        // How an event is named for whoever listens: after the plugin that sent it, `<plugin id>:<event name>`.
        function nameOf(pluginId, name) {
            return pluginId + SEPARATOR + name;
        }

        function isNamed(name) {
            return name.includes(SEPARATOR);
        }

        // MARK: - Private

        return { nameOf, isNamed };
    }
);
