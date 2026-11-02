import * as ENVIRONMENT from '../../deckit-shell/environment/index.js';
import * as SITE from '../../deckit-shell/deckit/web/model/site.js';
import { createPartition } from './model/partition.js';
import { createRegistry } from './registry.js';
import { createCertificate } from './certificate.js';
import { createDownload } from './download.js';
import { createScript } from './script.js';
import { storeOf } from '../webkit/index.js';
import { CHANNEL } from '../messages/main.js';

// The web pages a mod's page shows, as the Electron environment shows them (deckit-shell/environment: MAIN.web), on
// WebKit: laid just over the mod's page, over the element that holds a web page's place in it, or alone in a window of
// the app's, each in a session of the mod's, kept in a data store of its own. `MESSAGES` carries what the mod's page
// says of them, `relayOf(page)` lays a page's web pages again where it is shown, and `WINDOWS.openForStage` asks the
// host app for a window.
export function createWeb({ CONFIG, LOG, WEBKIT, MESSAGES, STAGES, WINDOWS }) {
    // MARK: - Property
    const windows = new Map(); // window page id -> { window, embedder }
    const PARTITION = createPartition({ CONFIG });
    const REGISTRY = createRegistry();
    const embedders = new WeakSet(); // the mods' pages that show web pages
    const pages = new Map(); // id -> a web page deck holds
    const layouts = new Map(); // id -> where its mod's page last said it shows, { frame, visible }
    let deck = null; // what deck answers and is told (listen)
    const told =
        (name) =>
        (...args) =>
            deck[name](...args);
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
        if (deck) throw new Error('[deckit] the web is listened to once');
        deck = ENVIRONMENT.checked(given, ENVIRONMENT.WEB_DECK, 'what deck hands the web');
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

    // A web page deck holds, while it is there.
    function pageOf(id) {
        const page = pages.get(id);
        return page && !page.isDestroyed() ? page : null;
    }

    function holderOf(page) {
        const entry = REGISTRY.get(page.id);
        return entry ? { embedder: entry.embedder, id: page.id, tab: entry.tab, inPage: entry.inPage } : null;
    }

    function holdsKeyboard(modPage) {
        return [modPage, ...REGISTRY.pagesIn(modPage)].some((page) => !page.isDestroyed() && page.isFocused());
    }

    function openWindow(modPage, { mod, session, url, title }) {
        const page = makePage(PARTITION.spell(mod, session), modPage);
        pages.set(page.id, page);
        adopt(modPage, page, { inPage: false, tab: page.id });
        showInWindow(modPage, page, { title, size: deck.windowSize });
        page.loadURL(url);
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
                deck.found(entry.embedder, page.id, { matches: found ? matches : 0, active, final: true });
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
            audible,
            muted,
            capture: page.capture(),
        };
    }

    function fetchText(mod, session, url) {
        return WEBKIT.fetchText(storeOf(PARTITION.spell(mod, session)), url, deck.fetchLimit);
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
        MESSAGES.on(CHANNEL.webShow, (sender, { partition, url }) => show(sender, { partition, url }));
        // One not shown hands the keyboard to its mod's page.
        MESSAGES.on(CHANNEL.webPlace, (sender, layout) => {
            const page = ownPage(sender, layout.id);
            if (!page) return;
            layouts.set(page.id, layout);
            if (!layout.visible && page.isFocused()) sender.focus();
            STAGES.relayOf(sender);
        });
        MESSAGES.on(CHANNEL.webFocus, (sender, { id }) => ownPage(sender, id)?.focus());
        MESSAGES.on(CHANNEL.webUnfocus, (sender) => sender.focus());
        // A page that goes with the keyboard hands it to its mod's page, which would otherwise have nowhere to go.
        MESSAGES.on(CHANNEL.webRemove, (sender, { id }) => {
            const page = ownPage(sender, id);
            if (!page) return;
            const focused = page.isFocused();
            page.close();
            if (focused) sender.focus();
        });
    }

    // A web page an element of `modPage` shows, in the session `partition` spells, loaded at `url` as deck lets it:
    // its id, or null when it is not shown.
    function show(modPage, { partition, url }) {
        try {
            if (!embedders.has(modPage)) throw new Error('the page shows no web pages');
            const session = PARTITION.read(partition);
            if (!session || !deck.attaching(modPage, session)) throw new Error("its session is not the mod's");
            const page = makePage(PARTITION.spell(session.mod, session.name), modPage);
            pages.set(page.id, page);
            adopt(modPage, page, { inPage: true, tab: page.id });
            if (url && url !== 'about:blank') page.loadURL(url);
            return page.id;
        } catch (error) {
            LOG.warn('a web page was not shown', error?.message || '');
            return null;
        }
    }

    // What a page asks, put to deck: a link it follows, a window it opens, what it asks to have, a certificate the Mac
    // does not trust, and an app's address. A download it starts is written to the Downloads folder, and deck is told
    // of it for the mod showing the page. `page` is the page asking, known once it is adopted.
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
                return deck.loading(modPage, page, String(url), { inPage, from: page.getURL(), followed: true });
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
                    target: '',
                };
                if (!deck.windowOpen(modPage, page, asked)) return null;
                return openPopup(modPage, page, { width, height });
            },
            permission: ({ origin, permissions }) => {
                const at = REGISTRY.tabOf(page);
                return at ? deck.request(at.embedder, at.tab.id, { origin, permissions }) : Promise.resolve(false);
            },
            certificate: (info) => CERTIFICATE.decide(page, REGISTRY.tabOf(page), page.partition, info),
            download: ({ url }) => {
                const at = REGISTRY.tabOf(page);
                if (!at) return null;
                return DOWNLOAD.listenerFor(
                    url,
                    (download) => deck.downloaded(at.embedder, download),
                    (asked) => deck.shouldDownload(at.embedder, at.tab.id, asked)
                );
            },
            external: (url) => {
                const at = REGISTRY.tabOf(page);
                if (!at) return;
                deck.requestApp(at.embedder, at.tab.id, { url, origin: SITE.originOf(page.getURL()) }).then(
                    (ok) => ok && require('electron').shell.openExternal(url),
                    (error) => LOG.error("an app's address was not opened", error)
                );
            },
        };
    }

    // A page asks deck before its own loads, and tells it of each change. `tab` is the page whose delegate answers for
    // it, itself or the page that opened it.
    function adopt(modPage, page, { inPage, tab }) {
        const id = page.id;
        REGISTRY.add(page, { embedder: modPage, tab, inPage });
        const changed = () => {
            const state = stateOf(page);
            if (state) deck.changed(modPage, id, state);
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
            if (layouts.delete(id)) STAGES.relayOf(modPage);
        });
        const loadURL = page.loadURL;
        page.loadURL = (url) => {
            const verdict = deck.loading(modPage, page, String(url || ''), { inPage, from: page.getURL() });
            return verdict === 'load' ? loadURL(url) : Promise.resolve();
        };
        page.delegate.adopted(page, SCRIPT.attach(modPage, page, changed));
        deck.adopted(modPage, page);
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
                const size = width && height ? { width, height } : deck.windowSize;
                const window = showInWindow(modPage, page, { size });
                const closeWithOpener = () => window.close();
                opener.once('destroyed', closeWithOpener);
                page.once('destroyed', () => opener.removeListener('destroyed', closeWithOpener));
            },
        });
    }

    // A page in a window of the app's, the two going together: the page closes with the window, and a page that
    // closes itself takes its window. The window is titled by the page, and a site's page says which site it is, so a
    // page cannot pass for another.
    function showInWindow(modPage, page, { title = '', size }) {
        let closing = false;
        const stage = STAGES.stage();
        const fill = () => stage.lay([{ page, rect: { x: 0, y: 0, ...stage.size() } }]);
        stage.whenResized(fill);
        const window = WINDOWS.openForStage({
            title,
            size,
            stage,
            focus: () => page.focus(),
            onClose: () => {
                closing = true;
                stage.close();
                page.close();
            },
        });
        fill();
        windows.set(page.id, { window, embedder: modPage });
        LOG.guard(page, 'changed', () => window.setTitle(labelOf(page)));
        LOG.guard(page, 'close', () => !closing && window.close());
        window.on('close', () => {
            windows.delete(page.id);
            deck.closed(modPage, page.id);
        });
        return window;
    }

    // A page of a mod's session, in its data store, answering to `modPage`.
    function makePage(partition, modPage) {
        return WEBKIT.make({
            store: storeOf(partition),
            cookieLifetime: deck.cookieLifetime,
            delegate: delegateOf(modPage),
            fields: { partition },
        });
    }

    // Where a mod's page shows its web pages: each shown one, at its element's rect in the page.
    function webPagesIn(modPage) {
        return REGISTRY.pagesIn(modPage).flatMap((page) => {
            const { frame, visible } = layouts.get(page.id) || {};
            return visible && frame ? [{ page, frame }] : [];
        });
    }

    return {
        listen,
        embed,
        pageOf,
        holderOf,
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
        fetchText,
        clear,
        cancelDownload: (id) => WEBKIT.cancelDownload(id),
        trust: (mod, session, entries) => CERTIFICATE.trust(PARTITION.spell(mod, session), entries),
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
