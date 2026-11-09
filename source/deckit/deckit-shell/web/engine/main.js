import * as CHANNEL from '../../deckit/channel/index.js';
import * as LISTENER from '../../deckit/listener/index.js';
import * as DECLARED from './protocol.js';
import * as WEB_PERMISSION from './model/permission.js';
import * as SESSION from './model/session.js';
import * as SITE from './model/site.js';
import * as SITE_PERMISSION from './model/site-permission.js';
import { createDownload } from './download.js';

// The web engine in main, on `deckit`, what connect answered, its channels bound with `deckit.channels`. `state` is its
// own state. `web` is the environment's: the web pages a mod's page shows, their sessions, and what a site was allowed.
// `pages` and `open` are the environment's too: what it tells of a page, and what opens an address outside the app
// (environment: WEB).
export function createWeb({ deckit, state: STATE, web: WEB, pages: PAGES, open: SYSTEM }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const SESSIONS = 'web-sessions'; // the state's key: mod id -> the names of the web sessions it used
    const TITLE_LIMIT = 200;
    const BODY_LIMIT = 400;
    // A cookie with no expiry would sign the person out of every site at each launch; a browser restoring its session
    // keeps them, so here it is given a lifetime.
    const COOKIE_LIFETIME = 60 * 60 * 24 * 14;
    // `fetch` reads in the app's process, and a huge answer would be held whole there.
    const FETCH_LIMIT = 4 * 1024 * 1024;
    const WINDOW_SIZE = Object.freeze({ width: 520, height: 700 });
    // How long after a key or mouse press in a web page its window.open is taken as coming of that press, as a browser
    // keeps a page's transient user activation.
    const ACTIVATION_MS = 5000;
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
    const activated = new WeakMap(); // a web page -> when a key or the mouse was last pressed in it
    const adopting = new Set(); // what is told of each web page as it is adopted
    let sequence = 0;
    const DOWNLOAD = createDownload({ deckit, state: STATE, PROTOCOL, web: WEB, pages: PAGES });

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        WEB.listen({
            loading,
            attaching,
            windowOpen,
            adopted,
            opened: (embedder, tab, page, { url, activates }) =>
                PROTOCOL.opening.send(embedder, { id: tab, page, url, activates }),
            changed: (embedder, id, state) => PROTOCOL.changed.send(embedder, { id, state }),
            found: (embedder, id, { matches, active, final }) =>
                PROTOCOL.found.send(embedder, { id, matches, active, final }),
            closed: (embedder, id) => {
                windows.delete(id);
                PROTOCOL.closed.send(embedder, { id });
            },
            refused: (embedder, id, certificate) => PROTOCOL.refused.send(embedder, { id, certificate }),
            notified,
            downloaded: DOWNLOAD.downloaded,
            shouldDownload: DOWNLOAD.shouldDownload,
            permits,
            permitted,
            request,
            requestApp: (embedder, id, { url, origin }) => mayOpenApp(embedder, id, url, origin),
            cookieLifetime: COOKIE_LIFETIME,
            fetchLimit: FETCH_LIMIT,
            windowSize: WINDOW_SIZE,
        });
        listen();
        DOWNLOAD.start();
        deckit.pages.onSandbox(prepare);
        deckit.mods.onErase(erase);
    }

    // The page of deckit's a page answers to: a mod's or one that runs no mod, or the mod's page that shows it as a
    // web page, in the page or in a window, so a keystroke in the web page is the mod page's.
    function pageFor(page) {
        if (deckit.mods.modOf(page) || deckit.pages.nameOf(page)) return page;
        return WEB.holderOf(page)?.embedder ?? null;
    }

    function holdsKeyboard(modPage) {
        return WEB.holdsKeyboard(modPage);
    }

    // `listener(page)` is told of each web page as it is adopted, before its input is watched. Answers its off.
    function onPage(listener) {
        const told = LISTENER.wrap(listener, 'a web page listener');
        adopting.add(told);
        return () => adopting.delete(told);
    }

    // MARK: - Private
    // What a mod kept of the web: its downloads, and what the sessions it used stored. The record of its sessions is
    // read again once they are cleared, so what another mod used meanwhile stays.
    async function erase(modId) {
        DOWNLOAD.forget(modId);
        for (const name of STATE.read(SESSIONS, {})[modId] || []) await WEB.clear(modId, name);
        const sessions = STATE.read(SESSIONS, {});
        delete sessions[modId];
        STATE.write(SESSIONS, sessions);
        deckit.log.info(`forgot the web sessions of ${modId}`);
    }

    // A mod's page that shows web pages: only that mod's sessions attach there, and only the web, or a file for a mod
    // with system.files, loads in them. A window it asked for answers to the document that asked for it, and a new
    // document has no delegate for it, so it closes. What the page asks to open outside itself, a window or an address
    // its document leaves for, is opened for the mod `modId` as its own openExternal opens it.
    function prepare(modPage, modId) {
        WEB.embed(modPage);
        const closeWindows = () => {
            for (const [id, embedder] of windows) {
                const page = embedder === modPage && WEB.pageOf(id);
                if (page) WEB.close(page);
            }
        };
        const openFrom = (url, { activates } = {}) =>
            deckit.mods
                .openExternal(modId, url, { activates })
                .catch((error) => deckit.log.warn(`${modId}: ${url} did not open`, error));
        PAGES.watch(modPage, {
            ended: closeWindows,
            destroyed: closeWindows,
            opens: (url, options) => openFrom(url, options),
            leaves: (url) => openFrom(url),
        });
    }

    // Whether the mod in the page holds `permission`, never so for a page that runs no mod.
    function holds(page, permission) {
        try {
            deckit.mods.modFrom(page, permission);
            return true;
        } catch {
            return false;
        }
    }

    function listen() {
        PROTOCOL.window.handle(({ name, url, title }, sender) =>
            openWindow(sender, deckit.mods.modFrom(sender), name, url, title)
        );
        PROTOCOL.fetch.handle(({ name, ...request }, sender) =>
            fetch(deckit.mods.modFrom(sender, WEB_PERMISSION.NETWORK), name, request)
        );
        PROTOCOL.clear.handle(({ name }, sender) => clear(deckit.mods.modFrom(sender), name));
        PROTOCOL.trust.handle(({ name, entries }, sender) =>
            WEB.trust(deckit.mods.modFrom(sender, WEB_PERMISSION.CERTIFICATES), SESSION.nameOf(name), entries)
        );
        PROTOCOL.allow.handle(({ name, entries }, sender) =>
            change(deckit.mods.modFrom(sender, WEB_PERMISSION.SITE_PERMISSIONS), SESSION.nameOf(name), entries, (key) =>
                granted.add(key)
            )
        );
        // A page already holding a stream keeps it, and one told "granted" keeps believing it: the mod reloads its
        // pages of that origin.
        PROTOCOL.revoke.handle(({ name, entries }, sender) =>
            change(deckit.mods.modFrom(sender, WEB_PERMISSION.SITE_PERMISSIONS), SESSION.nameOf(name), entries, (key) =>
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
        const sessions = STATE.read(SESSIONS, {});
        if ((sessions[modId] || []).includes(name)) return;
        sessions[modId] = [...(sessions[modId] || []), name];
        STATE.write(SESSIONS, sessions);
    }

    function openWindow(modPage, modId, name, url, title) {
        if (!mayShow(modPage, url, { inPage: false })) return 0;
        use(modId, name);
        const id = WEB.openWindow(modPage, { mod: modId, session: name, url, title });
        windows.set(id, modPage);
        return id;
    }

    async function fetch(modId, name, request) {
        if (!/^https?:\/\//i.test(request.url)) throw new Error('not a web address: ' + request.url);
        use(modId, name);
        return WEB.fetch(modId, name, request);
    }

    async function clear(modId, name) {
        use(modId, name);
        return WEB.clear(modId, name);
    }

    // The web anywhere. A file only in the mod's own page, and only for a mod with system.files, asked at each load so
    // a mod updated without the permission loses it at once.
    function mayShow(modPage, url, { inPage }) {
        if (/^https?:\/\//i.test(url)) return true;
        if (!inPage || !/^file:\/\//i.test(url)) return false;
        return holds(modPage, WEB_PERMISSION.FILES);
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
        const modId = deckit.mods.modOf(modPage);
        if (session?.mod !== modId) return false;
        use(modId, session.name);
        return true;
    }

    // A web page is a page of its own: what listens on it is told of it, and then the key and mouse presses in it are
    // watched, as a window it opens takes a press. Main sees the input itself, so a page cannot claim it.
    function adopted(modPage, page) {
        for (const listener of [...adopting]) listener(page);
        PAGES.watchInput(page, ({ type }) => {
            if (type === 'keydown' || type === 'mousedown' || type === 'mouseup') activated.set(page, Date.now());
        });
    }

    // Whether a key or the mouse was just pressed in this web page, used up by the answer: one press, one act.
    function consumeActivation(page) {
        const fresh = Date.now() - (activated.get(page) || 0) < ACTIVATION_MS;
        activated.delete(page);
        return fresh;
    }

    // What a web page's window.open gets: a window of its own only in a window, or when it asks for one with features,
    // as a consent step's popup posts its answer back to its opener, which a tab could not do. A file page's window
    // would share its session, so it is asked of the delegate instead. Answers whether it is given the window.
    // A window a page asked for is a window of the app's when it asked for one or is in one; a tab's is handed to its
    // mod's page, which shows it. A file page's window to the web is no window of its session: its address is opened.
    function windowOpen(modPage, page, { url, tab, from, inPage, ownWindow, activates }) {
        // A page opens what it opens just after a key or mouse press in it, as a browser blocks a popup otherwise.
        if (!consumeActivation(page)) return '';
        // An app's address opened as a window is the same question as one navigated to.
        if (!/^https?:\/\//i.test(url)) {
            mayOpenApp(modPage, tab, url, SITE.originOf(from)).then((ok) => ok && SYSTEM.url(url));
            return '';
        }
        if (/^file:/i.test(String(from))) {
            PROTOCOL.opening.send(modPage, { id: tab, url, activates });
            return '';
        }
        return !inPage || ownWindow ? 'window' : 'page';
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

    // Whether a site may have `name` in a session, `{ mod, name }` or null for one that is no mod's: what it is let
    // have without asking, or what the mod let it have when it is asked.
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

    // What a site asks: refused when it asks for nothing the web engine names or for something it is never let have,
    // let through when it is all it is let have without asking, and otherwise asked of the mod showing it.
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
        return holds(embedder, WEB_PERMISSION.SITE_PERMISSIONS);
    }

    function settle(id, allowed) {
        const question = questions.get(id);
        if (!question) return;
        questions.delete(id);
        questionFor.delete(question.key);
        question.off?.();
        for (const resolve of question.waiting) resolve(!!allowed);
    }

    return { start, pageFor, holdsKeyboard, onPage };
}
