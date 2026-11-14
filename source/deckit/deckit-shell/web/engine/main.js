import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';
import * as LISTENER from '../../../deckit-sdk/deckit/listener/index.js';
import * as DECLARED from '../../../deckit-sdk/web/engine/protocol.js';
import * as WEB_PERMISSION from '../../../deckit-sdk/web/engine/model/permission.js';
import * as SESSION from '../../../deckit-sdk/web/engine/model/session.js';
import * as SITE from './model/site.js';
import * as SITE_PERMISSION from './model/site-permission.js';
import { createDownload } from './download.js';

// The web engine in main, on `deckit`, what connect answered, its channels bound with `deckit.channels`. `state` is its
// own state. `web` is the environment's: the web pages a mod's page shows, their sessions, and what a site was allowed.
// `pages`, `open` and `clipboard` are the environment's too: what it tells of a page, what opens an address outside the
// app, and the clipboard a site reads and writes as the mod's handle does (environment: WEB).
export function createWeb({ deckit, state: STATE, web: WEB, pages: PAGES, open: OPEN, clipboard: CLIPBOARD }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const SESSIONS = 'web-sessions'; // the state's key: mod id -> the names of the web sessions it used
    // A cookie with no expiry would sign the person out of every site at each launch; a browser restoring its session
    // keeps them, so here it is given a lifetime.
    const COOKIE_LIFETIME = 60 * 60 * 24 * 14;
    // `fetch` reads in the app's process, and a huge answer would be held whole there.
    const FETCH_LIMIT = 4 * 1024 * 1024;
    // How long after a key or mouse press in a web page its window.open is taken as coming of that press, as a browser
    // keeps a page's transient user activation.
    const ACTIVATION_MS = 5000;
    const windows = new Map(); // id of a web page in a window a mod asked for -> the mod's page that asked
    const questions = new Map(); // ask id -> { embedder, key, off, waiting: [resolve] }
    const questionFor = new Map(); // web page id|origin|permissions -> ask id
    // mod|session|origin|permission: what a mod let a site have in one of its sessions, until the app quits or the mod
    // is erased. The mod hands it back through allow(); a refusal is not kept, so a page refused by mistake can ask
    // again once reloaded.
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
            opened: (embedder, opener, page, { url, activates }) =>
                PROTOCOL.opening.send(embedder, { id: opener, page, url, activates }),
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
            readClipboard,
            writeClipboard,
            requestApp: (embedder, id, { url, origin }) => openApp(embedder, id, url, origin),
            cookieLifetime: COOKIE_LIFETIME,
            fetchLimit: FETCH_LIMIT,
        });
        listen();
        DOWNLOAD.start();
        deckit.pages.onSandbox(prepare);
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

    // Whether the web engine keeps anything of the mod `modId`: a web session it used, a download, what it let a site
    // have, or a certificate it trusted.
    function kept(modId) {
        return (
            Boolean(STATE.read(SESSIONS, {})[modId]?.length) ||
            DOWNLOAD.holds(modId) ||
            allowedOf(modId).length > 0 ||
            WEB.trusts(modId)
        );
    }

    // What a mod kept of the web: its downloads, what it let sites have, the certificates it trusted, and what the
    // sessions it used stored. The record of its sessions is read again once they are cleared, so what another mod used
    // meanwhile stays. Answers once the state is written.
    async function erase(modId) {
        const forgotten = DOWNLOAD.forget(modId);
        const allowed = allowedOf(modId);
        for (const key of allowed) granted.delete(key);
        if (allowed.length) WEB.permissionsChanged();
        WEB.distrust(modId);
        for (const name of STATE.read(SESSIONS, {})[modId] || []) await WEB.clear(modId, name);
        const sessions = STATE.read(SESSIONS, {});
        delete sessions[modId];
        await Promise.all([forgotten, STATE.write(SESSIONS, sessions)]);
        deckit.log.info(`forgot the web sessions of ${modId}`);
    }

    // MARK: - Private
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
        return !!deckit.mods.grantedOf(deckit.mods.modOf(page))?.includes(permission);
    }

    function listen() {
        PROTOCOL.window.handle(({ name, url, title }, sender) =>
            openWindow(sender, deckit.mods.modOf(sender), name, url, title)
        );
        PROTOCOL.fetch.handle(({ name, ...request }, sender) => fetch(deckit.mods.modOf(sender), name, request));
        PROTOCOL.clear.handle(({ name }, sender) => clear(deckit.mods.modOf(sender), name));
        PROTOCOL.trust.handle(({ name, entries }, sender) => trust(deckit.mods.modOf(sender), name, entries));
        PROTOCOL.allow.handle(({ name, entries }, sender) =>
            change('allow', deckit.mods.modOf(sender), name, entries, (key) => granted.add(key))
        );
        // A page already holding a stream keeps it, and one told "granted" keeps believing it: the mod reloads its
        // pages of that origin.
        PROTOCOL.revoke.handle(({ name, entries }, sender) =>
            change('revoke', deckit.mods.modOf(sender), name, entries, (key) => granted.delete(key))
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

    // A web page the sender shows, never another mod's.
    function guestOf(sender, id) {
        const page = WEB.pageOf(id);
        const held = page && WEB.holderOf(page);
        return held && held.embedder === sender ? page : null;
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

    // A window at no address, or at about:blank, is a blank page, and one at an address it may not show stays one, as
    // its load is refused as any is.
    function openWindow(modPage, modId, name, url, title) {
        use(modId, name);
        const id = WEB.openWindow(modPage, { mod: modId, session: name, url, title });
        windows.set(id, modPage);
        return id;
    }

    // A request that is not answered is refused with the kind the environment gave, or REFUSED where it gave none.
    async function fetch(modId, name, request) {
        SESSION.nameOf(name);
        if (!SITE.isWebAddress(request.url)) throw invalid(`web.session.fetch: ${request.url} is no web address`);
        use(modId, name);
        try {
            return await WEB.fetch(modId, name, request);
        } catch (error) {
            throw REQUEST.refusal('call', error?.kind || 'REFUSED', String(error?.message ?? error));
        }
    }

    // A session the mod never used holds nothing, and is not recorded by being cleared.
    async function clear(modId, name) {
        SESSION.nameOf(name);
        if (!(STATE.read(SESSIONS, {})[modId] || []).includes(name)) return;
        await WEB.clear(modId, name);
    }

    // Certificates the mod trusts in one of its sessions, each `{ host, fingerprint }`: none is trusted where one is
    // not of that shape.
    function trust(modId, name, entries) {
        SESSION.nameOf(name);
        const problem = entriesProblem(entries, (entry) =>
            typeof entry.host !== 'string' || typeof entry.fingerprint !== 'string'
                ? 'is { host, fingerprint }, each a string'
                : ''
        );
        if (problem) throw invalid(`web.session.trust: ${problem}`);
        WEB.trust(
            modId,
            name,
            entries.map(({ host, fingerprint }) => ({ host, fingerprint }))
        );
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

    // Whether a web page's window.open is given a page, one handed to its mod's page (told with `opened`), whichever
    // page opens it, in the mod's page or apart: the web engine names no window, and the layer over it shows the page.
    // A file page's popup would share its session, so it is none, and its address is passed on to be opened. A popup at
    // no address, or at about:blank, is a blank page given as one to the web is, and a file page's is nothing, as a
    // blank page is never opened outside the app.
    function windowOpen(modPage, page, { url, from, origin, activates }) {
        // A page opens what it opens just after a key or mouse press in it, as a browser blocks a popup otherwise.
        if (!consumeActivation(page)) return false;
        const id = WEB.holderOf(page).id;
        const blank = SITE.isBlank(url);
        // An app's address opened as a window is the same question as one navigated to, asked as the opening frame's.
        if (!blank && !/^https?:\/\//i.test(url)) {
            openApp(modPage, id, url, SITE.originOf(origin));
            return false;
        }
        if (/^file:/i.test(String(from))) {
            if (!blank) PROTOCOL.opening.send(modPage, { id, url, activates });
            return false;
        }
        return true;
    }

    // What a site shows only once it was allowed notifications, its title and body whole: whether it was told the
    // mod's page. A site tells whatever it tells, so one whose title or body is no string, or whose `silent` is no
    // boolean, is dropped.
    function notified(embedder, id, { origin, notification, title, body, silent }) {
        if (typeof title !== 'string' || typeof body !== 'string' || typeof silent !== 'boolean') return false;
        const page = WEB.pageOf(id);
        if (!page || !permits(WEB.sessionOf(page), origin, 'notifications')) return false;
        PROTOCOL.notified.send(embedder, { id, notification, title, body, silent });
        return true;
    }

    // Whether a site may have `name` in a session, `{ mod, name }` or null for one that is no mod's: what it is let
    // have without asking, or what the mod let it have when it is asked, each only while the mod is granted the
    // permission of the system's that guards it, where one does.
    function permits(session, origin, name) {
        const rule = SITE_PERMISSION.ruleOf(name);
        if (rule === 'refuse' || !reaches(session?.mod ?? null, name)) return false;
        if (rule !== 'ask') return true;
        return !!session && granted.has(keyOf(session, SITE.originOf(origin), name));
    }

    // The sites that may have `name` in a session.
    function permitted(session, name) {
        if (!session || !reaches(session.mod, name)) return [];
        const prefix = `${session.mod}|${session.name}|`;
        return [...granted]
            .filter((key) => key.startsWith(prefix) && key.endsWith('|' + name))
            .map((key) => key.slice(prefix.length, -name.length - 1));
    }

    // What a site asks: refused when it asks for nothing the web engine names, for something it is never let have, or
    // for something the mod showing it is not granted the permission of the system's that guards it, let through when
    // it is all it is let have without asking, and otherwise asked of the mod showing it.
    function request(embedder, id, { origin, permissions }) {
        const rules = permissions.map(SITE_PERMISSION.ruleOf);
        if (!permissions.length || rules.some((rule) => rule === 'refuse' || rule === 'checked'))
            return Promise.resolve(false);
        const modId = deckit.mods.modOf(embedder);
        if (!permissions.every((name) => reaches(modId, name))) return Promise.resolve(false);
        if (rules.every((rule) => rule === 'allow')) return Promise.resolve(true);
        return ask(embedder, id, origin, permissions);
    }

    // The clipboard's text a site in the web page `id` reads, once it may have `clipboard-read`, or null where not.
    async function readClipboard(embedder, id, { origin }) {
        if (!(await request(embedder, id, { origin, permissions: ['clipboard-read'] }))) return null;
        return CLIPBOARD.readText();
    }

    // Whether a site in the web page `id` replaced the clipboard's text with `text`, as it may with `clipboard-write`.
    // A site tells whatever it tells, so `text` that is no string writes nothing.
    async function writeClipboard(embedder, id, { origin, text }) {
        if (typeof text !== 'string') return false;
        if (!(await request(embedder, id, { origin, permissions: ['clipboard-write'] }))) return false;
        await CLIPBOARD.writeText(text);
        return true;
    }

    // Whether a site of the mod `modId`, or of no mod's for null, may have `name` as the system guards it: always where
    // no permission of the system's guards it, else only while the mod is granted that permission.
    function reaches(modId, name) {
        const guard = SITE_PERMISSION.guardOf(name);
        return !guard || !!deckit.mods.grantedOf(modId)?.includes(guard);
    }

    function keyOf(session, origin, permission) {
        return `${session.mod}|${session.name}|${origin}|${permission}`;
    }

    // What the mod `modId` let sites have, in any of its sessions, by key. A mod's id holds no `|`.
    function allowedOf(modId) {
        return [...granted].filter((key) => key.startsWith(`${modId}|`));
    }

    // What a mod lets sites have in one of its sessions, changed by `member`, each entry `{ origin, permission }`:
    // `origin` a web origin, and `permission` one a site is asked for (SITE_PERMISSION.isAsked). Nothing changes where
    // one entry is not of that shape.
    function change(member, modId, name, entries, apply) {
        SESSION.nameOf(name);
        const problem = entriesProblem(entries, ({ origin, permission }) => {
            if (typeof origin !== 'string' || typeof permission !== 'string')
                return 'is { origin, permission }, each a string';
            if (SITE.originOf(origin) !== origin) return `has ${origin}, no web origin`;
            return SITE_PERMISSION.isAsked(permission) ? '' : `has ${permission}, no permission a site is asked for`;
        });
        if (problem) throw invalid(`web.session.${member}: ${problem}`);
        for (const { origin, permission } of entries) apply(keyOf({ mod: modId, name }, origin, permission));
        WEB.permissionsChanged();
    }

    // Why `entries` is not an array of tables each of which `problemOf` answers '' of, or ''.
    function entriesProblem(entries, problemOf) {
        if (!Array.isArray(entries)) return 'entries is no array';
        for (const [index, entry] of entries.entries()) {
            if (CHANNEL.kindOf(entry) !== 'object') return `entries[${index}] is no table`;
            const problem = problemOf(entry);
            if (problem) return `entries[${index}] ${problem}`;
        }
        return '';
    }

    function invalid(message) {
        return REQUEST.refusal('call', 'INVALID_ARGUMENT', message);
    }

    // One question per web page, site and set of permissions: a page asking again before it is answered joins the
    // question already up. Only a mod holding system.site-permissions is asked; for any other the site is refused.
    function ask(embedder, pageId, origin, permissions, about = {}) {
        return new Promise((resolve) => {
            if (!origin || !permissions.length || !decides(embedder)) return resolve(false);
            const tab = WEB.pageOf(pageId);
            if (!tab) return resolve(false);
            const session = WEB.sessionOf(tab);
            if (session && permissions.every((permission) => granted.has(keyOf(session, origin, permission))))
                return resolve(true);
            const key = [pageId, origin, ...[...permissions].sort()].join('|');
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
            PROTOCOL.asking.send(embedder, { id: pageId, ask: id, origin, permissions, ...about });
        });
    }

    // An app's address a site in the web page `pageId` goes to, by a link or window.open, opened outside the app by
    // `open` once the mod lets the site have that app. Answers whether it was opened; one that did not open is logged.
    function openApp(embedder, pageId, url, origin) {
        return mayOpenApp(embedder, pageId, url, origin)
            .then(async (ok) => {
                if (!ok) return false;
                await OPEN.url(String(url));
                return true;
            })
            .catch((error) => {
                deckit.log.warn(`${url} did not open in its app`, error);
                return false;
            });
    }

    // Asked as `origin`, the site of the frame that goes to the app, as every ask of a site is.
    function mayOpenApp(embedder, pageId, url, origin) {
        const scheme = SITE.schemeOf(url);
        if (!SITE_PERMISSION.opensOut(scheme)) return Promise.resolve(false);
        const name = OPEN.appFor(String(url));
        if (!name) return Promise.resolve(false);
        return ask(embedder, pageId, origin, ['open:' + scheme], { app: name, url: String(url) });
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

    return { start, pageFor, holdsKeyboard, onPage, keeps: Object.freeze({ kept, erase }) };
}
