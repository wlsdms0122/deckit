import * as LISTENER from '../../../deckit-sdk/deckit/listener/index.js';

// Which page is which mod's, or which runs none, and which transport connection hosts the run of which principal. `pages` is the environment's (environment/: MAIN.pages); a page is its
// token, kept and compared, never read.
export function createIdentity({ pages: PAGES }) {
    // MARK: - Property
    // page -> { mod }, or { page }, the name of a page that runs no mod; a transport connection -> { mod }
    const identities = new Map();
    const pages = new Map(); // mod id -> what hosts its run, its page or a transport connection
    const ends = new Map(); // what hosts a run -> Set of what undoes what was set up for it

    // MARK: - Initializer
    // MARK: - Public
    // Only main makes the pages a mod runs in and the pages that run none, so who sent a message is known by which
    // page it came from, and never by what the message says. A page is held to the address it loads, so it keeps that
    // identity for as long as it is.
    function add(page, identity) {
        identities.set(page, identity);
        PAGES.pin(page);
        if (identity.mod) pages.set(identity.mod.id, page);
        ends.set(page, new Set());
        // A reload or a crashed renderer keeps the page, but the document that set things up is gone. A navigation
        // ends it only once it commits: one the environment refuses never does.
        PAGES.watch(page, {
            ended: () => end(ends.get(page), { replaced: true }),
            gone: (why) => end(ends.get(page), { gone: why }),
            destroyed: () => {
                end(ends.get(page), { destroyed: true });
                ends.delete(page);
                identities.delete(page);
                if (identity.mod && pages.get(identity.mod.id) === page) pages.delete(identity.mod.id);
            },
        });
    }

    // A transport connection that arrived from outside is known by the principal the core verified it as, from the
    // sandbox the core opened on it until it closes: `whenEnds(listener)` hears once that it closed.
    function addOutside(connection, identity, whenEnds) {
        identities.set(connection, identity);
        pages.set(identity.mod.id, connection);
        ends.set(connection, new Set());
        whenEnds(() => {
            end(ends.get(connection), { gone: 'its transport connection closed' });
            ends.delete(connection);
            identities.delete(connection);
            if (pages.get(identity.mod.id) === connection) pages.delete(identity.mod.id);
        });
    }

    // What a page set up lasts as long as the page: `undo(ending)` is called once, when the page navigates away, its
    // process ends or it is destroyed, `ending` saying which: `{ replaced: true }`, `{ gone: why }` or
    // `{ destroyed: true }`. Calling what this returns drops `undo` uncalled.
    function whenPageEnds(page, undo) {
        const undos = ends.get(page);
        if (!undos) throw new Error("whenEnds takes a page of deckit's: a mod's, or one that runs none");
        undos.add(undo);
        return () => undos.delete(undo);
    }

    // The mod a page runs, or null for one that is not a mod's.
    function modOf(page) {
        return identities.get(page)?.mod || null;
    }

    // The mod that sent this: refused at call for a page that runs none.
    function modFrom(page) {
        const mod = modOf(page);
        if (!mod) throw Object.assign(new Error('only a mod asks this'), { stage: 'call', kind: 'REFUSED' });
        return mod;
    }

    // The name of the page that runs no mod, or null.
    function pageNameOf(page) {
        return identities.get(page)?.page || null;
    }

    function pageOf(modId) {
        return pages.get(modId) || null;
    }

    // MARK: - Private
    // Each undo runs whatever another throws, told how the document ended.
    function end(undos, ending) {
        const due = [...undos];
        undos.clear();
        for (const undo of due) LISTENER.wrap(undo, 'what a page set up')(ending);
    }

    return {
        add,
        addOutside,
        whenPageEnds,
        modOf,
        modFrom,
        pageNameOf,
        pageOf,
    };
}
