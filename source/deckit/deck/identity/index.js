DeckitModule.define(
    'deck/identity',
    {
        uses: ['deck/sandbox/model/origin'],
        provides: [
            'add',
            'whenPageEnds',
            'consumeUserActivation',
            'passUserActivation',
            'modOf',
            'modFrom',
            'pageNameOf',
            'pageOf',
        ],
        runs: 'main',
    },
    (ORIGIN) => {
        // MARK: - Property
        // As long as Chromium lets a page act on a person's click or key.
        const ACTIVATION_MS = 5000;
        const owners = new Map(); // webContents id -> { mod }, or { page }, the name of a page that runs no mod
        const pages = new Map(); // mod id -> its page's webContents
        const ends = new Map(); // webContents id -> Set of what undoes what its page set up
        const activated = new Map(); // webContents id -> when a person last pressed a key or the mouse in it

        // MARK: - Initializer
        // MARK: - Public
        // Only main makes the pages a mod runs in and the pages that run none, so who sent a message is known by
        // which webContents it came from, and never by what the message says.
        function add(webContents, owner) {
            const id = webContents.id;
            owners.set(id, owner);
            pin(webContents, owner.mod ? ORIGIN.originOf(owner.mod.id) : ORIGIN.pageOriginOf(owner.page));
            // A key main takes never reaches the page, so keys are counted before it is taken; a click after it.
            webContents.on(
                'before-input-event',
                (_event, input) => input.type === 'keyDown' && activated.set(id, Date.now())
            );
            webContents.on(
                'input-event',
                (_event, input) => input.type === 'mouseDown' && activated.set(id, Date.now())
            );
            if (owner.mod) pages.set(owner.mod.id, webContents);
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
                if (owner.mod && pages.get(owner.mod.id) === webContents) pages.delete(owner.mod.id);
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

        // A press elsewhere that acts in this page, as a command picked in another page runs in the mod's.
        function passUserActivation(webContents) {
            activated.set(webContents.id, Date.now());
        }

        // The mod a renderer runs, or null for one that is not a mod's.
        function modOf(webContents) {
            return owners.get(webContents.id)?.mod || null;
        }

        // The mod that sent this, held to holding `permission` when one is named.
        function modFrom(webContents, permission = null) {
            const mod = modOf(webContents);
            if (!mod) throw Object.assign(new Error('only a mod asks this'), { kind: 'REFUSED' });
            if (permission && !mod.permissions.some(({ id }) => id === permission)) {
                throw Object.assign(new Error(`${mod.id} does not have the ${permission} permission`), {
                    kind: 'REFUSED',
                });
            }
            return mod;
        }

        // The name of the page a renderer is that runs no mod, or null.
        function pageNameOf(webContents) {
            return owners.get(webContents.id)?.page || null;
        }

        function pageOf(modId) {
            return pages.get(modId) || null;
        }

        // MARK: - Private
        // A navigation keeps the webContents, so a page that left its origin would still be known as its mod while
        // it ran another's page with that one's storage, and one that went to another path of its own origin would
        // start the mod again beside the run still going. So a page stays at its one address. Only main's
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
            modOf,
            modFrom,
            pageNameOf,
            pageOf,
        };
    }
);
