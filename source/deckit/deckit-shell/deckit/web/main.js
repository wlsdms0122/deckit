import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as WEB_PERMISSION from './model/permission.js';
import * as SESSION from './model/session.js';
import * as SITE from './model/site.js';
import * as SITE_PERMISSION from './model/site-permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `web` is the environment's: the web pages a mod's page shows, their sessions, and what a site was allowed. `pages`
// and `open` are the environment's too: what it tells of a page, and what opens an address outside the app.
export function createWeb({ LOG, IDENTITY, KEYMAP, STORAGE, web: WEB, pages: PAGES, open: SYSTEM }) {
    // MARK: - Property
    const SESSIONS = 'web-sessions'; // the state's key: mod id -> the names of the web sessions it used
    const TITLE_LIMIT = 200;
    const BODY_LIMIT = 400;
    // Asked per scheme, so a site allowed one app is not allowed every app. These are the web's own, never an app's.
    const NEVER_OUT = new Set([
        'javascript',
        'data',
        'blob',
        'file',
        'filesystem',
        'about',
        'http',
        'https',
        'ws',
        'wss',
    ]);
    const windows = new Map(); // id of a web page in a window a mod asked for -> the mod's page that asked
    const questions = new Map(); // ask id -> { embedder, key, off, waiting: [resolve] }
    const questionFor = new Map(); // web page id|origin|permissions -> ask id
    // mod|session|origin|permission: what a mod let a site have in one of its sessions, until the app quits. The mod
    // hands it back through allow(); a refusal is not kept, so a page refused by mistake can ask again once reloaded.
    const granted = new Set();
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        WEB.listen({
            loading,
            attaching,
            windowOpen,
            adopted,
            changed: (embedder, id, state) => PROTOCOL.changed.send(embedder, { id, state }),
            found: (embedder, id, { matches, active, final }) =>
                PROTOCOL.found.send(embedder, { id, matches, active, final }),
            closed: (embedder, id) => {
                windows.delete(id);
                PROTOCOL.closed.send(embedder, { id });
            },
            refused: (embedder, id, certificate) => PROTOCOL.refused.send(embedder, { id, certificate }),
            notified,
            permits,
            permitted,
            request,
            requestApp: (embedder, id, { url, origin }) => mayOpenApp(embedder, id, url, origin),
        });
        listen();
    }

    // A mod's page that shows web pages: only that mod's sessions attach there, and only the web, or a file for a mod
    // with system.files, loads in them. A window it asked for answers to the document that asked for it, and a new
    // document has no delegate for it, so it closes.
    function prepare(modPage) {
        WEB.embed(modPage);
        const closeWindows = () => {
            for (const [id, embedder] of windows) {
                const page = embedder === modPage && WEB.pageOf(id);
                if (page) WEB.close(page);
            }
        };
        PAGES.watch(modPage, { ended: closeWindows, destroyed: closeWindows });
    }

    // The page of deck's a page answers to: a mod's or one the shell made, or the mod's page that shows it as a web
    // page, so a keystroke in the web page is the mod page's.
    function pageFor(page) {
        if (IDENTITY.modOf(page) || IDENTITY.pageNameOf(page)) return page;
        const held = WEB.holderOf(page);
        return held?.inPage && held.tab === held.id ? held.embedder : null;
    }

    function holdsKeyboard(modPage) {
        return WEB.holdsKeyboard(modPage);
    }

    // What a mod kept in the web sessions it used. The record is read again once they are cleared, so what another mod
    // used meanwhile stays.
    async function clearSessions(modId) {
        for (const name of STORAGE.state.read(SESSIONS, {})[modId] || []) await WEB.clear(modId, name);
        const sessions = STORAGE.state.read(SESSIONS, {});
        delete sessions[modId];
        STORAGE.state.write(SESSIONS, sessions);
        LOG.info(`forgot the web sessions of ${modId}`);
    }

    // MARK: - Private
    function listen() {
        PROTOCOL.window.handle(({ name, url, title }, sender) =>
            openWindow(sender, IDENTITY.modFrom(sender), name, url, title)
        );
        PROTOCOL.fetchText.handle(({ name, url }, sender) =>
            fetchText(IDENTITY.modFrom(sender, WEB_PERMISSION.NETWORK), name, url)
        );
        PROTOCOL.clear.handle(({ name }, sender) => clear(IDENTITY.modFrom(sender), name));
        PROTOCOL.trust.handle(({ name, entries }, sender) =>
            WEB.trust(IDENTITY.modFrom(sender, WEB_PERMISSION.CERTIFICATES).id, SESSION.nameOf(name), entries)
        );
        PROTOCOL.allow.handle(({ name, entries }, sender) =>
            change(IDENTITY.modFrom(sender, WEB_PERMISSION.SITE_PERMISSIONS).id, SESSION.nameOf(name), entries, (key) =>
                granted.add(key)
            )
        );
        // A page already holding a stream keeps it, and one told "granted" keeps believing it: the mod reloads its
        // pages of that origin.
        PROTOCOL.revoke.handle(({ name, entries }, sender) =>
            change(IDENTITY.modFrom(sender, WEB_PERMISSION.SITE_PERMISSIONS).id, SESSION.nameOf(name), entries, (key) =>
                granted.delete(key)
            )
        );
        PROTOCOL.permit.on(({ ask: id, allow }, sender) => {
            if (questions.get(id)?.embedder === sender) settle(id, allow);
        });

        PROTOCOL.load.on(({ id, url }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.load(page, url);
        });
        PROTOCOL.navigate.on(({ id, to }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.navigate(page, to);
        });
        PROTOCOL.state.on(({ id }, sender) => {
            const page = guestOf(sender, id);
            if (page) report(sender, id, page);
        });
        PROTOCOL.mute.on(({ id, on }, sender) => {
            const page = guestOf(sender, id);
            if (!page) return;
            WEB.setMuted(page, on);
            report(sender, id, page);
        });
        PROTOCOL.find.on(({ id, text, start, back, matchCase }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.find(page, text, { start, back, matchCase });
        });
        PROTOCOL.stopFind.on(({ id, keepSelection }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.stopFind(page, { keepSelection });
        });
        PROTOCOL.close.on(({ id }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.close(page);
        });
        PROTOCOL.clickNotification.on(({ id, notification }, sender) => {
            const page = guestOf(sender, id);
            if (page) WEB.clickNotification(page, notification);
        });
    }

    // A page the sender holds: one of its tabs, never another mod's.
    function guestOf(sender, id) {
        const page = WEB.pageOf(id);
        const held = page && WEB.holderOf(page);
        return held && held.embedder === sender && held.tab === id ? page : null;
    }

    function report(embedder, id, page) {
        const state = WEB.stateOf(page);
        if (state) PROTOCOL.changed.send(embedder, { id, state });
    }

    // A session named is one the mod used, kept so its data goes with the mod.
    function use(modId, name) {
        SESSION.nameOf(name);
        const sessions = STORAGE.state.read(SESSIONS, {});
        if ((sessions[modId] || []).includes(name)) return;
        sessions[modId] = [...(sessions[modId] || []), name];
        STORAGE.state.write(SESSIONS, sessions);
    }

    function openWindow(modPage, mod, name, url, title) {
        if (!mayShow(modPage, url, { inPage: false })) return 0;
        use(mod.id, name);
        const id = WEB.openWindow(modPage, { mod: mod.id, session: name, url, title });
        windows.set(id, modPage);
        return id;
    }

    async function fetchText(mod, name, url) {
        if (!/^https?:\/\//i.test(url)) throw new Error('not a web address: ' + url);
        use(mod.id, name);
        return WEB.fetchText(mod.id, name, url);
    }

    async function clear(mod, name) {
        use(mod.id, name);
        return WEB.clear(mod.id, name);
    }

    // The web anywhere. A file only in the mod's own page, and only for a mod with system.files, asked at each load so
    // a mod updated without the permission loses it at once.
    function mayShow(modPage, url, { inPage }) {
        if (/^https?:\/\//i.test(url)) return true;
        if (!inPage || !/^file:\/\//i.test(url)) return false;
        return !!IDENTITY.modOf(modPage)?.permissions.some(({ id }) => id === WEB_PERMISSION.FILES);
    }

    // What becomes of a web page `page` asked to load `to`, from `from`, where it is: `load`, `refuse`, or `leave`. A
    // file document never becomes a web one in its page, as the session given to show files would keep the web's
    // cookies: the web it asks for goes to whoever shows the page instead, told it is leaving.
    function loading(modPage, page, to, { inPage, from = '', followed = false }) {
        if (/^file:/i.test(String(from)) && /^https?:/i.test(String(to))) {
            PROTOCOL.leaving.send(modPage, { id: WEB.holderOf(page).id, url: String(to) });
            return 'leave';
        }
        // A link the page follows goes where the web takes it: only what is loaded into it is held to what it shows.
        if (followed) return 'load';
        return mayShow(modPage, to, { inPage }) ? 'load' : 'refuse';
    }

    // Only the mod's own sessions attach in its page: `session` is the one the page names, `{ mod, name }`, or null for
    // one that is no mod's.
    function attaching(modPage, session) {
        const mod = IDENTITY.modOf(modPage);
        if (session?.mod !== mod.id) return false;
        use(mod.id, session.name);
        return true;
    }

    // A web page is a page of its own: its keystrokes reach the key map only when it is listened to, and what a person
    // does in it is watched, as a window it opens takes a press.
    function adopted(modPage, page) {
        KEYMAP.listen(page, { page: pageFor(page) });
        IDENTITY.watchPresses(page);
    }

    // What a web page's window.open gets: a window of its own only in a window, or when it asks for one with features,
    // as a consent step's popup posts its answer back to its opener, which a tab could not do. A file page's window
    // would share its session, so it is asked of the delegate instead. Answers whether it is given the window.
    function windowOpen(modPage, page, { url, tab, from, inPage, ownWindow, activates, target }) {
        // A page opens what it opens during a person's click or key, as a browser blocks a popup otherwise.
        if (!IDENTITY.consumeUserActivation(page)) return false;
        // An app's address opened as a window is the same question as one navigated to.
        if (!/^https?:\/\//i.test(url)) {
            mayOpenApp(modPage, tab, url, SITE.originOf(from)).then((ok) => ok && SYSTEM.url(url));
            return false;
        }
        if ((!inPage || ownWindow) && !/^file:/i.test(String(from))) return true;
        PROTOCOL.opening.send(modPage, { id: tab, url, activates, target });
        return false;
    }

    // What a site shows only once it was allowed notifications.
    function notified(embedder, id, { origin, notification, title, body, silent }) {
        const page = WEB.pageOf(id);
        if (!page || !permits(WEB.sessionOf(page), origin, 'notifications')) return;
        PROTOCOL.notified.send(embedder, {
            id,
            notification,
            title: String(title).slice(0, TITLE_LIMIT),
            body: String(body).slice(0, BODY_LIMIT),
            silent: !!silent,
        });
    }

    // Whether a site may have `name` in a session, `{ mod, name }` or null for one that is no mod's: what it is let have
    // without asking, or what the mod let it have when it is asked.
    function permits(session, origin, name) {
        const rule = SITE_PERMISSION.ruleOf(name);
        if (rule !== 'ask') return rule === 'allow' || rule === 'checked';
        return !!session && granted.has(keyOf(session, SITE.originOf(origin), name));
    }

    // The sites that may have `name` in a session.
    function permitted(session, name) {
        if (!session) return [];
        const prefix = `${session.mod}|${session.name}|`;
        return [...granted]
            .filter((key) => key.startsWith(prefix) && key.endsWith('|' + name))
            .map((key) => key.slice(prefix.length, -name.length - 1));
    }

    // What a site asks: refused when it asks for nothing deck names or for something it is never let have, let through
    // when it is all it is let have without asking, and otherwise asked of the mod showing it.
    function request(embedder, id, { origin, permissions }) {
        const rules = permissions.map(SITE_PERMISSION.ruleOf);
        if (!permissions.length || rules.some((rule) => rule === 'refuse' || rule === 'checked'))
            return Promise.resolve(false);
        if (rules.every((rule) => rule === 'allow')) return Promise.resolve(true);
        return ask(embedder, id, origin, permissions);
    }

    function keyOf(session, origin, permission) {
        return `${session.mod}|${session.name}|${origin}|${permission}`;
    }

    // What a mod lets sites have in one of its sessions, changed: answers how many allowances are kept.
    function change(modId, name, entries, apply) {
        for (const entry of entries) {
            const origin = SITE.originOf(entry?.origin);
            if (origin && entry.permission) apply(keyOf({ mod: modId, name }, origin, String(entry.permission)));
        }
        WEB.permissionsChanged();
        return granted.size;
    }

    // One question per web page, site and set of permissions: a page asking again before it is answered joins the
    // question already up. Only a mod holding system.site-permissions is asked; for any other the site is refused.
    function ask(embedder, tabId, origin, permissions, about = {}) {
        return new Promise((resolve) => {
            if (!origin || !permissions.length || !decides(embedder)) return resolve(false);
            const tab = WEB.pageOf(tabId);
            if (!tab) return resolve(false);
            const session = WEB.sessionOf(tab);
            if (session && permissions.every((permission) => granted.has(keyOf(session, origin, permission))))
                return resolve(true);
            const key = [tabId, origin, ...[...permissions].sort()].join('|');
            const up = questions.get(questionFor.get(key));
            if (up) {
                up.waiting.push(resolve);
                return;
            }
            const id = ++sequence;
            const question = { embedder, key, off: null, waiting: [resolve] };
            questions.set(id, question);
            questionFor.set(key, id);
            question.off = PAGES.watch(tab, { destroyed: () => settle(id, false) });
            PROTOCOL.asking.send(embedder, { id: tabId, ask: id, origin, permissions, ...about });
        });
    }

    // Asked of the top document's site whichever frame wants the app: that is the site the person sees.
    function mayOpenApp(embedder, tabId, url, origin) {
        const scheme = SITE.schemeOf(url);
        if (!scheme || NEVER_OUT.has(scheme)) return Promise.resolve(false);
        const name = SYSTEM.appFor(String(url));
        if (!name) return Promise.resolve(false);
        return ask(embedder, tabId, origin, ['open:' + scheme], { app: name, url: String(url) });
    }

    function decides(embedder) {
        const mod = IDENTITY.modOf(embedder);
        return !!mod && mod.permissions.some(({ id }) => id === WEB_PERMISSION.SITE_PERMISSIONS);
    }

    function settle(id, allowed) {
        const question = questions.get(id);
        if (!question) return;
        questions.delete(id);
        questionFor.delete(question.key);
        question.off?.();
        for (const resolve of question.waiting) resolve(!!allowed);
    }

    return { start, prepare, pageFor, holdsKeyboard, clearSessions };
}
