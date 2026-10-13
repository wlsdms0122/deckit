DeckitModule.define(
    'deckit/service/deck/identity',
    {
        uses: ['deckit/service/deck/model/origin'],
        provides: [
            'add',
            'whenPageEnds',
            'consumeUserActivation',
            'passUserActivation',
            'pluginOf',
            'pluginFrom',
            'isSwitcher',
            'pageOf',
        ],
        runs: 'main',
    },
    (ORIGIN) => {
        // MARK: - Property
        // As long as Chromium lets a page act on a person's click or key.
        const ACTIVATION_MS = 5000;
        const owners = new Map(); // webContents id -> { plugin } or { switcher: true }
        const pages = new Map(); // plugin id -> its page's webContents
        const ends = new Map(); // webContents id -> Set of what undoes what its page set up
        const activated = new Map(); // webContents id -> when a person last pressed a key or the mouse in it

        // MARK: - Initializer
        // MARK: - Public
        // Only main makes the pages a plugin or the switcher runs in, so who sent a message is known by which
        // webContents it came from, and never by what the message says.
        function add(webContents, owner) {
            const id = webContents.id;
            owners.set(id, owner);
            pin(webContents, owner.plugin ? ORIGIN.originOf(owner.plugin.id) : ORIGIN.SWITCHER_ORIGIN);
            // A key the key map takes never reaches the page, so keys are counted before it; a click after it.
            webContents.on(
                'before-input-event',
                (_event, input) => input.type === 'keyDown' && activated.set(id, Date.now())
            );
            webContents.on(
                'input-event',
                (_event, input) => input.type === 'mouseDown' && activated.set(id, Date.now())
            );
            if (owner.plugin) pages.set(owner.plugin.id, webContents);
            ends.set(id, new Set());
            const end = () => {
                const undos = [...ends.get(id)];
                ends.get(id).clear();
                for (const undo of undos) undo();
            };
            // A reload or a crashed renderer keeps the webContents and its id, but the page that set things up is gone.
            // A navigation ends it only once it commits: one that pin refuses never does.
            webContents.on('did-navigate', end);
            webContents.on('render-process-gone', end);
            webContents.once('destroyed', () => {
                end();
                ends.delete(id);
                activated.delete(id);
                owners.delete(id);
                if (owner.plugin && pages.get(owner.plugin.id) === webContents) pages.delete(owner.plugin.id);
            });
        }

        // What a page set up lasts as long as the page: `undo` is called once, when the page navigates away, crashes
        // or is gone. Calling what this returns drops `undo` uncalled.
        function whenPageEnds(webContents, undo) {
            const undos = ends.get(webContents.id);
            undos.add(undo);
            return () => undos.delete(undo);
        }

        // Whether a person just pressed a key or the mouse in this page, used up by the answer: one press, one act.
        // Main sees the input itself, so a page cannot claim it.
        function consumeUserActivation(webContents) {
            const fresh = Date.now() - (activated.get(webContents.id) || 0) < ACTIVATION_MS;
            activated.delete(webContents.id);
            return fresh;
        }

        // A press elsewhere that acts in this page: a pick in the switcher runs the plugin's command.
        function passUserActivation(webContents) {
            activated.set(webContents.id, Date.now());
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

        function pageOf(pluginId) {
            return pages.get(pluginId) || null;
        }

        // MARK: - Private
        // A navigation keeps the webContents, so a page that left its origin would still be known as its plugin while
        // it ran another's page with that one's storage, and one that went to another path of its own origin would
        // start the plugin again beside the run still going. So a deckit page stays at its one address. Only main's
        // own loadURL and reload pass without these events.
        function pin(webContents, origin) {
            const address = ORIGIN.addressOf(origin);
            const leaves = (details) => details.isMainFrame && withoutFragment(details.url) !== address;
            webContents.on('will-frame-navigate', (details) => leaves(details) && details.preventDefault());
            webContents.on('will-redirect', (details) => leaves(details) && details.preventDefault());
        }

        function withoutFragment(url) {
            return String(url).split('#')[0];
        }

        return {
            add,
            whenPageEnds,
            consumeUserActivation,
            passUserActivation,
            pluginOf,
            pluginFrom,
            isSwitcher,
            pageOf,
        };
    }
);
