import * as LISTENER from '../listener/index.js';

// Which page is which mod's, or which runs none, and what a person just did in a page. `pages` is the environment's
// (environment/: MAIN.pages); a page is its token, kept and compared, never read.
export function createIdentity({ pages: PAGES }) {
    // MARK: - Property
    // As long as Chromium lets a page act on a person's click or key.
    const ACTIVATION_MS = 5000;
    const owners = new Map(); // page -> { mod }, or { page }, the name of a page that runs no mod
    const pages = new Map(); // mod id -> its page
    const ends = new Map(); // page -> Set of what undoes what its page set up
    const activated = new WeakMap(); // page -> when a person last pressed a key or the mouse in it
    const held = new WeakSet(); // pages with the mouse held down in them
    const pointed = new WeakMap(); // page -> when a person last pressed or let go of the mouse in it

    // MARK: - Initializer
    // MARK: - Public
    // Only main makes the pages a mod runs in and the pages that run none, so who sent a message is known by which
    // page it came from, and never by what the message says. A key is counted before what watches the page's input
    // after it may take it. A page is held to the address it loads, so it is known as its owner for as long as it is.
    function add(page, owner) {
        owners.set(page, owner);
        PAGES.pin(page);
        watchPresses(page);
        if (owner.mod) pages.set(owner.mod.id, page);
        ends.set(page, new Set());
        // Each undo runs whatever another throws, told how the document ended.
        const end = (undos, ending) => {
            const due = [...undos];
            undos.clear();
            for (const undo of due) LISTENER.wrap(undo, 'what a page set up')(ending);
        };
        // A reload or a crashed renderer keeps the page, but the document that set things up is gone. A navigation
        // ends it only once it commits: one the environment refuses never does.
        PAGES.watch(page, {
            ended: () => end(ends.get(page), { replaced: true }),
            gone: (why) => end(ends.get(page), { gone: why }),
            destroyed: () => {
                end(ends.get(page), { destroyed: true });
                ends.delete(page);
                owners.delete(page);
                if (owner.mod && pages.get(owner.mod.id) === page) pages.delete(owner.mod.id);
            },
        });
    }

    // What a page set up lasts as long as the page: `undo(ending)` is called once, when the page navigates away, its
    // process ends or it is destroyed, `ending` saying which: `{ replaced: true }`, `{ gone: why }` or
    // `{ destroyed: true }`. Calling what this returns drops `undo` uncalled.
    function whenPageEnds(page, undo) {
        const undos = ends.get(page);
        if (!undos) throw new Error("whenEnds takes a page of deck's: a mod's, or one that runs none");
        undos.add(undo);
        return () => undos.delete(undo);
    }

    // A person's presses in a page, read by what follows: every page of deck's is watched, and another, as a web page
    // a mod shows, is watched once it is handed here.
    function watchPresses(page) {
        PAGES.watchInput(page, ({ type }) => {
            // A drag tells what it did as it is let go, however long it was held: the release is a press too.
            if (type === 'keydown') {
                activated.set(page, Date.now());
            } else if (type === 'mousedown') {
                activated.set(page, Date.now());
                pointed.set(page, Date.now());
                held.add(page);
            } else if (type === 'mouseup') {
                activated.set(page, Date.now());
                pointed.set(page, Date.now());
                held.delete(page);
            }
        });
    }

    // Whether a person just pressed a key or the mouse in this page, used up by the answer: one press, one act.
    // Main sees the input itself, so a page cannot claim it.
    function consumeUserActivation(page) {
        const fresh = Date.now() - (activated.get(page) || 0) < ACTIVATION_MS;
        activated.delete(page);
        return fresh;
    }

    // Whether a person is pressing in this page now, or just pressed: what the page tells main comes of their act
    // and not of the page's own code, and the press is not used up, so a drag tells as it goes.
    function isPressing(page) {
        return held.has(page) || Date.now() - (activated.get(page) || 0) < ACTIVATION_MS;
    }

    // The same, of the mouse alone: what a person points at in the page, not what they type into it.
    function isPointing(page) {
        return held.has(page) || Date.now() - (pointed.get(page) || 0) < ACTIVATION_MS;
    }

    // A press elsewhere that acts in this page, as a command picked in another page runs in the mod's.
    function passUserActivation(page) {
        activated.set(page, Date.now());
    }

    // The mod a page runs, or null for one that is not a mod's.
    function modOf(page) {
        return owners.get(page)?.mod || null;
    }

    // The mod that sent this, held to holding `permission` when one is named.
    function modFrom(page, permission = null) {
        const mod = modOf(page);
        if (!mod) throw Object.assign(new Error('only a mod asks this'), { kind: 'REFUSED' });
        if (permission && !mod.permissions.some(({ id }) => id === permission)) {
            throw Object.assign(new Error(`${mod.id} does not have the ${permission} permission`), {
                kind: 'REFUSED',
            });
        }
        return mod;
    }

    // The name of the page that runs no mod, or null.
    function pageNameOf(page) {
        return owners.get(page)?.page || null;
    }

    function pageOf(modId) {
        return pages.get(modId) || null;
    }

    // MARK: - Private

    return {
        add,
        whenPageEnds,
        watchPresses,
        consumeUserActivation,
        isPressing,
        isPointing,
        passUserActivation,
        modOf,
        modFrom,
        pageNameOf,
        pageOf,
    };
}
