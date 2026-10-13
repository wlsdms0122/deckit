DeckitModule.define(
    'deckit/service/web/model/partition',
    {
        uses: ['deckit/config'],
        provides: ['spell', 'read'],
        runs: 'any',
    },
    (CONFIG) => {
        // MARK: - Property
        const NAME = /^[a-z0-9][a-z0-9-]{0,39}$/;

        // MARK: - Initializer
        // MARK: - Public
        // A plugin's web session: under the app's id, so two apps in one profile stay apart, then the plugin's id
        // and the session's name. Neither id nor name holds a colon, so "mail" + "work-x" and "mail-work" + "x" differ.
        function spell(pluginId, name) {
            if (!NAME.test(String(name))) throw new Error('not a session name: ' + name);
            return `persist:${CONFIG.id}:${pluginId}:${name}`;
        }

        // { plugin, name } for a partition spelled as a plugin's session, or null.
        function read(partition) {
            const prefix = `persist:${CONFIG.id}:`;
            if (!String(partition).startsWith(prefix)) return null;
            const [plugin, name, ...rest] = String(partition).slice(prefix.length).split(':');
            if (rest.length || !plugin || !NAME.test(name || '')) return null;
            return { plugin, name };
        }

        // MARK: - Private

        return { spell, read };
    }
);
