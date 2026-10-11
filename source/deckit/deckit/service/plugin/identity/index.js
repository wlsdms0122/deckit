DeckitModule.define(
    'deckit/service/plugin/identity',
    {
        uses: [],
        provides: ['originOf', 'add', 'pluginOf', 'pluginFrom', 'isSwitcher', 'viewOf'],
        runs: 'main',
    },
    () => {
        // MARK: - Property
        const owners = new Map(); // webContents id -> { plugin } or { switcher: true }
        const views = new Map(); // plugin id -> its webContents

        // MARK: - Initializer
        // MARK: - Public
        // Where a plugin's view loads from: an origin of its own, so its page storage is no one else's. Every plugin
        // host ends in .plugin, so deckit's own views (the switcher's) never share an origin with one.
        function originOf(pluginId) {
            return `deckit://${pluginId}.plugin`;
        }

        // Only main makes the views a plugin or the switcher runs in, so who sent a message is known by which
        // webContents it came from, and never by what the message says.
        function add(webContents, owner) {
            const id = webContents.id;
            owners.set(id, owner);
            if (owner.plugin) views.set(owner.plugin.id, webContents);
            webContents.once('destroyed', () => {
                owners.delete(id);
                if (owner.plugin && views.get(owner.plugin.id) === webContents) views.delete(owner.plugin.id);
            });
        }

        // The plugin a renderer runs, or null for one that is not a plugin's.
        function pluginOf(webContents) {
            return owners.get(webContents.id)?.plugin || null;
        }

        // The plugin that sent this, held to holding `permission` when one is named.
        function pluginFrom(webContents, permission = null) {
            const plugin = pluginOf(webContents);
            if (!plugin) throw Object.assign(new Error('only a plugin asks this'), { kind: 'REFUSED' });
            if (permission && !plugin.permissions.some(({ id }) => id === permission)) {
                throw Object.assign(new Error(`${plugin.id} does not have the ${permission} permission`), {
                    kind: 'REFUSED',
                });
            }
            return plugin;
        }

        function isSwitcher(webContents) {
            return !!owners.get(webContents.id)?.switcher;
        }

        function viewOf(pluginId) {
            return views.get(pluginId) || null;
        }

        // MARK: - Private

        return { originOf, add, pluginOf, pluginFrom, isSwitcher, viewOf };
    }
);
