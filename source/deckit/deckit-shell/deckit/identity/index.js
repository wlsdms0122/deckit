import * as LISTENER from '../../../deckit-sdk/deckit/listener/index.js';

// Which page is which mod's, or which runs none. `pages` is the environment's (environment/: MAIN.pages); a page is its
// token, kept and compared, never read.
export function createIdentity({ pages: PAGES }) {
    // MARK: - Property
    const identities = new Map(); // page -> { mod }, or { page }, the name of a page that runs no mod
    const pages = new Map(); // mod id -> its page
    const ends = new Map(); // page -> Set of what undoes what its page set up

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
                identities.delete(page);
                if (identity.mod && pages.get(identity.mod.id) === page) pages.delete(identity.mod.id);
            },
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

    // The mod that sent this, held to being granted `permission` when one is named: refused at call.
    function modFrom(page, permission = null) {
        const mod = modOf(page);
        if (!mod) throw Object.assign(new Error('only a mod asks this'), { stage: 'call', kind: 'REFUSED' });
        if (permission && !mod.granted.includes(permission)) {
            throw Object.assign(new Error(`${mod.id} does not have the ${permission} permission`), {
                stage: 'call',
                kind: 'NOT_PERMITTED',
            });
        }
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

    return {
        add,
        whenPageEnds,
        modOf,
        modFrom,
        pageNameOf,
        pageOf,
    };
}
