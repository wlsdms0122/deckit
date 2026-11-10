import * as ENVIRONMENT from '../../deckit-shell/environment/index.js';
import * as SITE from '../../deckit-shell/web/engine/model/site.js';
import { createPartition } from './model/partition.js';
import { createRegistry } from './registry.js';
import { createCertificate } from './certificate.js';
import { createDownload } from './download.js';
import { createScript } from './script.js';
import { storeOf } from '../webkit/index.js';
import { CHANNEL } from '../messages/main.js';

// The web pages a mod's page shows, as the Electron environment shows them (deckit-shell/environment: WEB), on WebKit:
// laid just over the document the element that holds a web page's place is in, the mod's page or a surface it opened,
// or alone in a window of the app's, each in a session of the mod's, kept in a data store of its own. `MESSAGES`
// carries what the mod's page says of them, `relayOf(page)` lays a page's web pages again where it is shown,
// `WINDOWS.openForStage` asks the host app for a window, and `surfaceOf(page, name)` is the surface a page opened by
// that name.
export function createWeb({ CONFIG, LOG, WEBKIT, MESSAGES, STAGES, WINDOWS, surfaceOf }) {
    // MARK: - Property
    const windows = new Map(); // window page id -> { window, embedder }
    const PARTITION = createPartition({ CONFIG });
    const REGISTRY = createRegistry();
    const embedders = new WeakSet(); // the mods' pages that show web pages
    const pages = new Map(); // id -> a web page shown, in a mod's page or in a window
    // id -> where its mod's page last said it shows, { frame, visible, over }, `over` the page its element is in: the
    // mod's page, a surface it opened, or null for a surface no longer open
    const layouts = new Map();
    // The windows web pages opened that are handed to their mod's page, until it shows them as elements.
    const handed = new Map(); // id -> the mod's page
    let client = null; // what the web engine answers and is told (listen)
    const told =
        (name) =>
        (...args) =>
            client[name](...args);
    const sessionOf = (page) => PARTITION.read(page.partition);
    const CERTIFICATE = createCertificate({ refused: told('refused') });
    const DOWNLOAD = createDownload({ folder: () => require('electron').app.getPath('downloads') });
    const SCRIPT = createScript({
        LOG,
        sessionOf,
        permits: told('permits'),
        permitted: told('permitted'),
        notified: told('notified'),
        request: told('request'),
    });

    // MARK: - Initializer
    // MARK: - Public
    function listen(given) {
        if (client) throw new Error('[deckit] the web is listened to once');
        client = ENVIRONMENT.checked(given, ENVIRONMENT.WEB_CLIENT, 'what the web engine hands the web');
        hear();
    }

    // A replaced document takes the web pages it showed with it, as it takes its elements.
    function embed(modPage) {
        embedders.add(modPage);
        const closeShown = () => {
            for (const page of [...pages.values()]) {
                const entry = REGISTRY.get(page.id);
                if (entry?.embedder === modPage && entry.inPage) page.close();
            }
        };
        LOG.guard(modPage, 'committed', closeShown);
        LOG.guard(modPage, 'destroyed', closeShown, { once: true });
    }

    // A web page shown, while it is there.
    function pageOf(id) {
        const page = pages.get(id);
        return page && !page.isDestroyed() ? page : null;
    }

    function holderOf(page) {
        const entry = REGISTRY.get(page.id);
        return entry ? { embedder: entry.embedder, id: page.id, tab: entry.tab, inPage: entry.inPage } : null;
    }

    // The page the element of web page `page` is in, or null for one shown in no element.
    function containerOf(page) {
        return layouts.get(page.id)?.over ?? null;
    }

    // Whether `page` has the keyboard, or a web page it shows, or one laid over it, its element in that page.
    function holdsKeyboard(page) {
        const over = [...layouts].flatMap(([id, layout]) => (layout.over === page ? [pageOf(id)] : []));
        return [page, ...REGISTRY.pagesIn(page), ...over].some((one) => one && !one.isDestroyed() && one.isFocused());
    }

    function openWindow(modPage, { mod, session, url, title }) {
        const page = makePage(PARTITION.spell(mod, session), modPage);
        pages.set(page.id, page);
        adopt(modPage, page, { inPage: false, tab: page.id });
        showInWindow(modPage, page, { title, size: client.windowSize });
        if (!SITE.isBlank(url)) page.loadURL(url);
        return page.id;
    }

    function load(page, url) {
        page.loadURL(url);
    }

    function navigate(page, to) {
        const history = page.navigationHistory;
        if (to === 'back' && history.canGoBack()) history.goBack();
        else if (to === 'forward' && history.canGoForward()) history.goForward();
        else if (to === 'reload') page.reload();
        else if (to === 'stop') page.stop();
    }

    function setMuted(page, on) {
        SCRIPT.setMuted(page, on);
    }

    // A new search starts at the first match; the next goes on from the last, around the page. WebKit finds and
    // shows a match but does not count them, so deckit's script in the page counts.
    function find(page, text, { start, back, matchCase }) {
        if (!text) return;
        const entry = REGISTRY.get(page.id);
        if (!entry) return;
        Promise.all([
            SCRIPT.count(page, text, matchCase),
            page.find(text, { backwards: back, caseSensitive: matchCase }),
        ])
            .then(([matches, found]) => {
                // A search from no match going back starts past the first, at the last.
                const last = start || !entry.found ? (back ? 1 : 0) : entry.found;
                const active =
                    !found || !matches ? 0 : back ? ((last - 2 + matches) % matches) + 1 : (last % matches) + 1;
                entry.found = active;
                client.found(entry.embedder, page.id, { matches: found ? matches : 0, active, final: true });
            })
            .catch((error) => LOG.error('a find in a web page failed', error));
    }

    function stopFind(page, { keepSelection }) {
        const entry = REGISTRY.get(page.id);
        if (entry) entry.found = 0;
        if (!keepSelection) page.evaluate('getSelection()?.removeAllRanges()', 'deckit').catch(() => {});
    }

    function close(page) {
        windows.get(page.id)?.window.close();
    }

    function stateOf(page) {
        if (page.isDestroyed()) return null;
        const history = page.navigationHistory;
        const { icon, audible, muted } = SCRIPT.stateOf(page);
        return {
            url: page.getURL(),
            title: page.getTitle(),
            icon,
            loading: page.isLoading(),
            canGoBack: history.canGoBack(),
            canGoForward: history.canGoForward(),
            blank: page.isBlank(),
            audible,
            muted,
            capture: page.capture(),
        };
    }

    // An answer past `fetchLimit` bytes is refused QUOTA_EXCEEDED. The module refuses it with its message alone,
    // `response too large`.
    function fetch(mod, session, request) {
        return WEBKIT.fetch(storeOf(PARTITION.spell(mod, session)), request, {
            limit: client.fetchLimit,
            cookieLifetime: client.cookieLifetime,
        }).catch((error) => {
            if (!/^response too large\b/.test(error?.message)) throw error;
            throw Object.assign(new Error(error.message), { kind: 'QUOTA_EXCEEDED' });
        });
    }

    function clear(mod, session) {
        return WEBKIT.clear(storeOf(PARTITION.spell(mod, session)));
    }

    // MARK: - Private
    // What a mod's page asks and tells of the web pages it shows, each from that page alone.
    function hear() {
        const ownPage = (sender, id) => {
            const page = pageOf(id);
            return page && REGISTRY.get(id)?.embedder === sender ? page : null;
        };
        // The page the element of web page `id` is in, which has the keyboard back from it.
        const holding = (sender, id) => layouts.get(id)?.over || sender;
        MESSAGES.on(CHANNEL.webShow, (sender, { partition, url, page }) => show(sender, { partition, url, page }));
        // One not shown hands the keyboard to the page its element is in.
        MESSAGES.on(CHANNEL.webPlace, (sender, { id, frame, visible, surface }) => {
            const page = ownPage(sender, id);
            if (!page) return;
            const was = layouts.get(id)?.over;
            const over = surface === undefined ? sender : surfaceOf(sender, String(surface));
            layouts.set(id, { frame, visible, over });
            if (!visible && page.isFocused()) holding(sender, id).focus();
            if (was && was !== over) STAGES.relayOf(was);
            if (over) STAGES.relayOf(over);
        });
        MESSAGES.on(CHANNEL.webFocus, (sender, { id }) => ownPage(sender, id)?.focus());
        MESSAGES.on(CHANNEL.webUnfocus, (sender, { id }) => holding(sender, id).focus());
        // A page that goes with the keyboard hands it to the page its element was in, which would otherwise have
        // nowhere to go.
        MESSAGES.on(CHANNEL.webRemove, (sender, { id }) => {
            const page = ownPage(sender, id);
            if (!page) return;
            const focused = page.isFocused();
            const held = holding(sender, id);
            page.close();
            if (focused) held.focus();
        });
    }

    // A web page an element of `modPage` shows, in the session `partition` spells, loaded at `url` as the web engine
    // lets it, or the window of id `page` a web page opened, handed to it: its id, or null when it is not shown.
    function show(modPage, { partition, url, page: handedId }) {
        try {
            if (!embedders.has(modPage)) throw new Error('the page shows no web pages');
            if (handedId !== undefined) {
                if (handed.get(handedId) !== modPage) throw new Error('the window was not handed to it');
                handed.delete(handedId);
                return handedId;
            }
            const session = PARTITION.read(partition);
            if (!session || !client.attaching(modPage, session)) throw new Error("its session is not the mod's");
            const page = makePage(PARTITION.spell(session.mod, session.name), modPage);
            pages.set(page.id, page);
            adopt(modPage, page, { inPage: true, tab: page.id });
            if (url && !SITE.isBlank(url)) page.loadURL(url);
            return page.id;
        } catch (error) {
            LOG.warn('a web page was not shown', error?.message || '');
            return null;
        }
    }

    // What a page asks, put to the web engine: a link it follows, a window it opens, what it asks to have, a
    // certificate that is not trusted, and an app's address, which the web engine opens. A download it starts is
    // written to the Downloads folder, and the web engine is told of it for the mod showing the page. `page` is the
    // page asking, known once it is adopted.
    function delegateOf(modPage) {
        let page = null;
        let hear = () => {};
        const tabOf = () => REGISTRY.get(page.id)?.tab ?? page.id;
        return {
            adopted: (made, heard) => {
                page = made;
                hear = heard;
            },
            message: (body) => hear(body),
            navigate: (url) => {
                const inPage = !!REGISTRY.get(page.id)?.inPage;
                return client.loading(modPage, page, String(url), { inPage, from: page.getURL(), followed: true });
            },
            open: ({ url, ownWindow, background, width, height }) => {
                const inPage = !!REGISTRY.get(page.id)?.inPage;
                const asked = {
                    url,
                    tab: tabOf(),
                    from: page.getURL(),
                    inPage,
                    ownWindow,
                    activates: !background,
                };
                const where = client.windowOpen(modPage, page, asked);
                if (where === 'window') return openPopup(modPage, page, { width, height });
                if (where === 'page') return openHanded(modPage, page, { url, activates: asked.activates });
                return null;
            },
            permission: ({ origin, permissions }) => {
                const at = REGISTRY.tabOf(page);
                return at ? client.request(at.embedder, at.tab.id, { origin, permissions }) : Promise.resolve(false);
            },
            certificate: (info) => CERTIFICATE.decide(page, REGISTRY.tabOf(page), page.partition, info),
            download: ({ url }) => {
                const at = REGISTRY.tabOf(page);
                if (!at) return null;
                return DOWNLOAD.listenerFor(
                    url,
                    (download) => client.downloaded(at.embedder, download),
                    (asked) => client.shouldDownload(at.embedder, at.tab.id, asked)
                );
            },
            external: (url) => {
                const at = REGISTRY.tabOf(page);
                if (!at) return;
                client
                    .requestApp(at.embedder, at.tab.id, { url, origin: SITE.originOf(page.getURL()) })
                    .catch((error) => LOG.error("an app's address was not opened", error));
            },
        };
    }

    // A page asks the web engine before its own loads, and tells it of each change. `tab` is the page whose delegate
    // answers for it, itself or the page that opened it.
    function adopt(modPage, page, { inPage, tab }) {
        const id = page.id;
        REGISTRY.add(page, { embedder: modPage, tab, inPage });
        const changed = () => {
            const state = stateOf(page);
            if (state) client.changed(modPage, id, state);
        };
        for (const event of ['changed', 'started', 'stopped', 'failed', 'committed']) LOG.guard(page, event, changed);
        if (inPage) {
            const tell = (event) => MESSAGES.tell(modPage, CHANNEL.webTold, { id, event });
            LOG.guard(page, 'focus', () => tell('focus'));
            LOG.guard(page, 'close', () => tell('close'));
            LOG.guard(page, 'mouse', (type) => type === 'mouseDown' && tell('press'));
        }
        page.once('destroyed', () => {
            pages.delete(id);
            const over = layouts.get(id)?.over;
            if (layouts.delete(id) && over) STAGES.relayOf(over);
        });
        const loadURL = page.loadURL;
        page.loadURL = (url) => {
            const verdict = client.loading(modPage, page, String(url || ''), { inPage, from: page.getURL() });
            return verdict === 'load' ? loadURL(url) : Promise.resolve();
        };
        page.delegate.adopted(page, SCRIPT.attach(modPage, page, changed));
        client.adopted(modPage, page);
    }

    // The listener of the page WebKit makes for a window `opener` opened, in its session, answering to its tab.
    function openPopup(modPage, opener, { width, height }) {
        const tab = REGISTRY.get(opener.id)?.tab ?? opener.id;
        const delegate = delegateOf(modPage);
        return WEBKIT.listenerFor({
            fields: { partition: opener.partition },
            delegate,
            opened: (page) => {
                pages.set(page.id, page);
                adopt(modPage, page, { inPage: false, tab });
                const size = width && height ? { width, height } : client.windowSize;
                const window = showInWindow(modPage, page, { size });
                const closeWithOpener = () => window.close();
                opener.once('destroyed', closeWithOpener);
                page.once('destroyed', () => opener.removeListener('destroyed', closeWithOpener));
            },
        });
    }

    // The listener of the page WebKit makes for a window `opener` opened, handed to `modPage` to show as an element,
    // and closed with `modPage` if it never shows it.
    function openHanded(modPage, opener, { url, activates }) {
        const tab = REGISTRY.get(opener.id)?.tab ?? opener.id;
        return WEBKIT.listenerFor({
            fields: { partition: opener.partition },
            delegate: delegateOf(modPage),
            opened: (page) => {
                pages.set(page.id, page);
                handed.set(page.id, modPage);
                page.once('destroyed', () => handed.delete(page.id));
                adopt(modPage, page, { inPage: true, tab: page.id });
                client.opened(modPage, tab, page.id, { url, activates });
            },
        });
    }

    // A page in a window of the app's, the two going together: the page closes with the window, and a page that
    // closes itself takes its window. The window is titled by the page, and a site's page says which site it is, so a
    // page cannot pass for another. The page fills the stage once the host app places it, which a host that lays the
    // page itself never does.
    function showInWindow(modPage, page, { title = '', size }) {
        let closing = false;
        const stage = STAGES.stage();
        stage.whenResized(() => stage.lay([{ page, rect: { x: 0, y: 0, ...stage.size() } }]));
        const window = WINDOWS.openForStage({ title, size, page, stage, focus: () => page.focus() });
        windows.set(page.id, { window, embedder: modPage });
        LOG.guard(page, 'changed', () => window.setTitle(labelOf(page)));
        LOG.guard(page, 'close', () => !closing && window.close());
        window.on('close', () => {
            closing = true;
            stage.close();
            page.close();
            windows.delete(page.id);
            client.closed(modPage, page.id);
        });
        return window;
    }

    // A page of a mod's session, in its data store, answering to `modPage`, which hands it the keyboard: a site does
    // not take it from what has it by focusing an element of its own.
    function makePage(partition, modPage) {
        return WEBKIT.make({
            store: storeOf(partition),
            cookieLifetime: client.cookieLifetime,
            clearWhileBlank: true,
            takesKeyboard: false,
            delegate: delegateOf(modPage),
            fields: { partition },
        });
    }

    // The web pages shown over `page`, a mod's page or a surface it opened: each whose element is in it, at its rect
    // there.
    function webPagesIn(page) {
        return [...layouts].flatMap(([id, { frame, visible, over }]) => {
            const shown = over === page && visible && frame && pageOf(id);
            return shown ? [{ page: shown, frame }] : [];
        });
    }

    return {
        listen,
        embed,
        pageOf,
        holderOf,
        containerOf,
        holdsKeyboard,
        openWindow,
        load,
        navigate,
        setMuted,
        find,
        stopFind,
        close,
        stateOf,
        clickNotification: (page, notification) => SCRIPT.clickNotification(page, notification),
        sessionOf,
        permissionsChanged: () => SCRIPT.permissionsChanged(),
        fetch,
        clear,
        cancelDownload: (id) => WEBKIT.cancelDownload(id),
        trust: (mod, session, entries) => CERTIFICATE.trust(PARTITION.spell(mod, session), entries),
        trusts: (mod) => CERTIFICATE.trusts(PARTITION.prefixOf(mod)),
        distrust: (mod) => CERTIFICATE.distrust(PARTITION.prefixOf(mod)),
        sessionsOf: (mod) => PARTITION.prefixOf(mod),
        webPagesIn,
    };
}

function labelOf(page) {
    const title = page.getTitle();
    let site = '';
    try {
        const url = new URL(page.getURL());
        if (url.protocol === 'http:' || url.protocol === 'https:') site = url.host;
    } catch {}
    return site && title !== site ? `${title} (${site})` : title;
}
