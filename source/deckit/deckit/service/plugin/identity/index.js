DeckitModule.define(
    'deckit/service/plugin/identity',
    {
        uses: [],
        provides: [
            'SWITCHER_ORIGIN',
            'originOf',
            'add',
            'whenPageEnds',
            'pluginOf',
            'pluginFrom',
            'isSwitcher',
            'viewOf',
        ],
        runs: 'main',
    },
    () => {
        // MARK: - Property
        const SWITCHER_ORIGIN = 'deckit://switcher';
        const owners = new Map(); // webContents id -> { plugin } or { switcher: true }
        const views = new Map(); // plugin id -> its webContents
        const ends = new Map(); // webContents id -> Set of what undoes what its page set up

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
            pin(webContents, owner.plugin ? originOf(owner.plugin.id) : SWITCHER_ORIGIN);
            if (owner.plugin) views.set(owner.plugin.id, webContents);
            ends.set(id, new Set());
            const end = () => {
                const runs = [...ends.get(id)];
                ends.get(id).clear();
                for (const run of runs) run();
            };
            // A reload or a crashed renderer keeps the webContents and its id, but the page that set things up is gone.
            webContents.on(
                'did-start-navigation',
                (details) => details.isMainFrame && !details.isSameDocument && end()
            );
            webContents.on('render-process-gone', end);
            webContents.once('destroyed', () => {
                end();
                ends.delete(id);
                owners.delete(id);
                if (owner.plugin && views.get(owner.plugin.id) === webContents) views.delete(owner.plugin.id);
            });
        }

        // What a page set up lasts as long as the page: `run` undoes it once, when the page navigates away, crashes or
        // is gone. Calling what this returns drops `run` unrun.
        function whenPageEnds(webContents, run) {
            const runs = ends.get(webContents.id);
            runs.add(run);
            return () => runs.delete(run);
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
        // A navigation keeps the webContents, so a view that left its origin would still be known as its plugin
        // while it ran another's page with that one's storage. Only main's own loadURL passes without these events.
        function pin(webContents, origin) {
            const leaves = (details) => details.isMainFrame && originFrom(details.url) !== origin;
            webContents.on('will-frame-navigate', (details) => leaves(details) && details.preventDefault());
            webContents.on('will-redirect', (details) => leaves(details) && details.preventDefault());
        }

        // Node's URL gives a scheme it does not know the origin `null`, so the origin is put together here.
        function originFrom(url) {
            try {
                const parsed = new URL(url);
                return `${parsed.protocol}//${parsed.host}`;
            } catch {
                return '';
            }
        }

        return { SWITCHER_ORIGIN, originOf, add, whenPageEnds, pluginOf, pluginFrom, isSwitcher, viewOf };
    }
);
