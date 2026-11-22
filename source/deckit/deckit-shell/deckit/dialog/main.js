import * as LISTENER from '../../../deckit-sdk/deckit/listener/index.js';

// What a page asks and waits on, its dialog (`alert`, `confirm`, `prompt`, `leave`), as deckit keeps it: answered
// through the environment's one answer (`pages.dialogs`, MAIN.pages), one a page at a time, and refused at once for a
// mod's own page and a page that runs no mod, which ask nothing of a seat. One up is withdrawn and refused as its page
// closes, loads another document, or its process ends. `IDENTITY` knows which page is whose, `CATALOG` a mod's name,
// and `pages` is the environment's.
export function createDialog({ IDENTITY, CATALOG, pages }) {
    // MARK: - Property
    const up = new Map(); // ask -> { page, settle(reply), off() }
    const asking = new Map(); // a page -> the ask of its dialog up
    let served = null; // { whose, asked, withdrawn }, once served
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // Before any page loads: every page's dialog comes here.
    function start() {
        pages.dialogs(heard);
    }

    // serve({ whose, asked, withdrawn }), once: what shows the dialogs. `whose(page) -> { mod, web } | null` names the
    // mod whose window content or web page a page is, `web` whether it is a web page, or null for none. `asked(dialog)`
    // is told each dialog up, `{ ask, page, kind, message, value, from }`, `ask` its number and `from` who asks as a
    // person reads it, the site's origin of a web page and the mod's name of any other; `withdrawn(ask)` is told as it
    // is no longer up, answered, refused or withdrawn. Answers `{ answer(ask, value), refuse(ask) }`: the first
    // answer is the page's, `value` what it is replied (a boolean for `confirm` and `leave`, the text or null for
    // `prompt`), and a later one, or one for no dialog up, does nothing. Until it is served, every dialog is refused.
    function serve({ whose, asked, withdrawn }) {
        if (served) throw new Error('[deckit] the dialogs are served once');
        served = {
            whose: LISTENER.wrap(whose, 'what names whose a page is'),
            asked: LISTENER.wrap(asked, 'a dialog listener'),
            withdrawn: LISTENER.wrap(withdrawn, 'a dialog listener'),
        };
        return Object.freeze({
            answer: (ask, value) => settle(ask, kept(up.get(ask), value)),
            refuse: (ask) => settle(ask, undefined),
        });
    }

    // MARK: - Private
    // A dialog the environment hands, `{ kind, message, value, origin }`: a promise of its reply, undefined for the
    // refusal.
    function heard(page, { kind, message, value, origin }) {
        if (!served || asking.has(page) || IDENTITY.modOf(page) || IDENTITY.pageNameOf(page)) return undefined;
        const owner = served.whose(page);
        const name = owner && CATALOG.mods().find((mod) => mod.id === owner.mod)?.manifest.name;
        if (!name) return undefined;
        const ask = ++sequence;
        const from = owner.web ? String(origin) : String(name);
        return new Promise((resolve) => {
            const withdraw = () => settle(ask, undefined);
            const off = pages.watch(page, { destroyed: withdraw, ended: withdraw, gone: withdraw });
            up.set(ask, { page, kind, settle: resolve, off });
            asking.set(page, ask);
            served.asked(Object.freeze({ ask, page, kind, message: String(message), value: String(value), from }));
        });
    }

    // The reply to a dialog of its kind: a boolean for `confirm` and `leave`, a string or null for `prompt`, and
    // anything else the refusal.
    function kept(held, value) {
        if (!held) return undefined;
        if (held.kind === 'confirm' || held.kind === 'leave') return typeof value === 'boolean' ? value : undefined;
        if (held.kind === 'prompt') return typeof value === 'string' || value === null ? value : undefined;
        return undefined;
    }

    // The dialog `ask` is replied `reply` and is up no more, told once.
    function settle(ask, reply) {
        const held = up.get(ask);
        if (!held) return;
        up.delete(ask);
        asking.delete(held.page);
        held.off();
        held.settle(reply);
        served.withdrawn(ask);
    }

    return { start, serve };
}
