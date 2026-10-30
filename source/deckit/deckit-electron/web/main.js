import * as ENVIRONMENT from '../../deckit-shell/environment/index.js';
import * as SITE from '../../deckit-shell/deckit/web/model/site.js';
import { createPartition } from './model/partition.js';
import { createRegistry } from './registry.js';
import { createCertificate } from './certificate.js';
import { createScript } from './script.js';
import { createWebKit } from './webkit.js';
import * as PROTOCOL from './protocol.js';

// The web pages a mod's page shows, as the Electron environment shows them (deckit-shell/environment: MAIN.web), on
// WebKit: over the element that holds a page's place in the mod's page, or over a view in a window of the app's, each
// in a session of the mod's, kept in a data store of its own. `webkit` is the module that makes them, and
// `viewOf(page)` the view a page of deckit's is in.
export function createWeb({ CONFIG, LOG, WINDOW, webkit, viewOf }) {
    // MARK: - Property
    const windows = new Map(); // window page id -> { window, embedder }
    const PARTITION = createPartition({ CONFIG });
    const REGISTRY = createRegistry();
    const WEBKIT = createWebKit({ path: webkit, LOG });
    const embedders = new WeakSet(); // the mods' pages that show web pages
    const pages = new Map(); // id -> a web page deck holds
    const layouts = new Map(); // id -> where its mod's page last said it shows, { frame, visible }
    const following = new WeakSet(); // the mods' pages whose view their web pages follow
    let deck = null; // what deck answers and is told (listen)
    const told =
        (name) =>
        (...args) =>
            deck[name](...args);
    const sessionOf = (page) => PARTITION.read(page.partition);
    const CERTIFICATE = createCertificate({ refused: told('refused') });
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
        LOG.guard(modPage, 'did-navigate', closeShown);
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
        const partition = PARTITION.spell(mod, session);
        const page = WEBKIT.make({ partition, cookieLifetime: deck.cookieLifetime, delegate: delegateOf(modPage) });
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
        return WEBKIT.fetchText(PARTITION.spell(mod, session), url, deck.fetchLimit);
    }

    function clear(mod, session) {
        return WEBKIT.clear(PARTITION.spell(mod, session));
    }

    // MARK: - Private
    // What a mod's page asks and tells of the web pages it shows, each from that page alone.
    function hear() {
        const { ipcMain } = require('electron');
        const ownPage = (event, id) => {
            const page = pageOf(id);
            return page && REGISTRY.get(id)?.embedder === event.sender ? page : null;
        };
        ipcMain.handle(PROTOCOL.show, (event, { partition, url }) => show(event.sender, { partition, url }));
        LOG.guard(ipcMain, PROTOCOL.place, (event, layout) => {
            const page = ownPage(event, layout.id);
            if (!page) return;
            layouts.set(page.id, layout);
            place(event.sender, page);
        });
        LOG.guard(ipcMain, PROTOCOL.focus, (event, { id }) => ownPage(event, id)?.focus());
        LOG.guard(ipcMain, PROTOCOL.unfocus, (event) => event.sender.focus());
        // A page that goes with the keyboard hands it to its mod's page, which would otherwise have nowhere to go.
        LOG.guard(ipcMain, PROTOCOL.remove, (event, { id }) => {
            const page = ownPage(event, id);
            if (!page) return;
            const focused = page.isFocused();
            page.close();
            if (focused) event.sender.focus();
        });
    }

    // A web page an element of `modPage` shows, in the session `partition` spells, loaded at `url` as deck lets it:
    // its id, or null when it is not shown.
    function show(modPage, { partition, url }) {
        try {
            if (!embedders.has(modPage)) throw new Error('the page shows no web pages');
            const session = PARTITION.read(partition);
            if (!session || !deck.attaching(modPage, session)) throw new Error("its session is not the mod's");
            const page = WEBKIT.make({
                partition: PARTITION.spell(session.mod, session.name),
                cookieLifetime: deck.cookieLifetime,
                delegate: delegateOf(modPage),
            });
            pages.set(page.id, page);
            adopt(modPage, page, { inPage: true, tab: page.id });
            follow(modPage);
            if (url && url !== 'about:blank') page.loadURL(url);
            return page.id;
        } catch (error) {
            LOG.warn('a web page was not shown', error?.message || '');
            return null;
        }
    }

    // What a page asks, put to deck: a link it follows, a window it opens, what it asks to have, a certificate the Mac
    // does not trust, and an app's address. `page` is the page asking, known once it is adopted.
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
        for (const event of ['state-changed', 'did-start-loading', 'did-stop-loading', 'did-fail-load', 'did-navigate'])
            LOG.guard(page, event, changed);
        if (inPage) {
            LOG.guard(page, 'focus', () => modPage.send(PROTOCOL.told, { id, event: 'focus' }));
            LOG.guard(page, 'close', () => modPage.send(PROTOCOL.told, { id, event: 'close' }));
            LOG.guard(page, 'input-event', (_event, { type }) => {
                if (type === 'mouseDown') modPage.send(PROTOCOL.told, { id, event: 'press' });
            });
        }
        page.once('destroyed', () => {
            pages.delete(id);
            layouts.delete(id);
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
            partition: opener.partition,
            delegate,
            opened: (page) => {
                pages.set(page.id, page);
                adopt(modPage, page, { inPage: false, tab });
                const size = width && height ? { width, height } : deck.windowSize;
                const window = showInWindow(modPage, page, { size });
                const closeWithOpener = () => !window.isDestroyed() && window.close();
                opener.once('destroyed', closeWithOpener);
                page.once('destroyed', () => opener.removeListener('destroyed', closeWithOpener));
            },
        });
    }

    // A page in a window of the app's, the two going together: the page closes with the window, and a page that
    // closes itself takes its window. The window holds a view of its own, which the page covers.
    function showInWindow(modPage, page, { title = '', size }) {
        const { View } = require('electron');
        const view = new View();
        view.setBackgroundColor('#ffffff');
        let closing = false;
        const window = WINDOW.open({
            view,
            title,
            size,
            onClose: () => {
                closing = true;
                page.close();
            },
        });
        windows.set(page.id, { window, embedder: modPage });
        const cover = () => {
            const laid = laidIn(window, view);
            if (laid) page.place({ ...laid, frame: { x: 0, y: 0, width: laid.page.width, height: laid.page.height } });
        };
        LOG.guard(window, 'resize', () => setImmediate(cover));
        setImmediate(cover);
        LOG.guard(page, 'close', () => !closing && !window.isDestroyed() && window.close());
        LOG.guard(window, 'closed', () => {
            windows.delete(page.id);
            deck.closed(modPage, page.id);
        });
        return window;
    }

    // A mod's page moved or shown elsewhere moves its web pages with it. The stage shows a view after it sizes it, in
    // the same turn, so they move at the next.
    function follow(modPage) {
        const view = viewOf(modPage);
        if (!view || following.has(modPage)) return;
        following.add(modPage);
        const placeAll = () => {
            for (const page of pages.values())
                if (REGISTRY.get(page.id)?.embedder === modPage && layouts.has(page.id)) place(modPage, page);
        };
        LOG.guard(view, 'bounds-changed', () => setImmediate(placeAll));
    }

    // Where a web page shows: `frame`, the element's rect in the mod's page. One not shown hands the keyboard to its
    // mod's page.
    function place(modPage, page) {
        const { frame, visible } = layouts.get(page.id) || {};
        const view = viewOf(modPage);
        const laid = visible && frame && view && laidOf(view);
        if (!laid) {
            if (page.isFocused()) modPage.focus();
            return page.place({ visible: false });
        }
        const zoom = modPage.getZoomFactor();
        const scaled = (rect) => ({
            ...rect,
            x: rect.x * zoom,
            y: rect.y * zoom,
            width: rect.width * zoom,
            height: rect.height * zoom,
        });
        page.place({ ...laid, frame: scaled(frame), visible: true });
    }

    // Where a view of deckit's is shown: the window, its rect in the window's content, and how many shown pages are
    // laid over it at the same rect, which WebKit's module tells it from by that. None while it is not shown.
    function laidOf(view) {
        const { BaseWindow } = require('electron');
        for (const window of BaseWindow.getAllWindows()) {
            const laid = laidIn(window, view);
            if (laid) return laid;
        }
        return null;
    }

    function laidIn(window, view) {
        if (window.isDestroyed()) return null;
        const path = pathTo(window.contentView, view);
        if (!path || path.some((node) => !node.getVisible())) return null;
        const rect = rectOf(path);
        const same = (other) => ['x', 'y', 'width', 'height'].every((key) => Math.abs(other[key] - rect[key]) < 1);
        const shown = shownIn(window.contentView);
        const above = shown.slice(shown.findIndex((laid) => laid.view === view) + 1).filter((laid) => same(laid.rect));
        return { window: window.getNativeWindowHandle(), page: rect, above: above.length };
    }

    function pathTo(from, view) {
        if (from === view) return [from];
        for (const child of from.children || []) {
            const path = pathTo(child, view);
            if (path) return [from, ...path];
        }
        return null;
    }

    // The rect of the last of `path`, a line of views from a window's content down, in the window's content.
    function rectOf(path) {
        return path.slice(1).reduce(
            (at, node) => {
                const bounds = node.getBounds();
                return { x: at.x + bounds.x, y: at.y + bounds.y, width: bounds.width, height: bounds.height };
            },
            { x: 0, y: 0, width: 0, height: 0 }
        );
    }

    // The pages shown under `root`, bottom to top, each with its view and its rect in the window's content.
    function shownIn(root, path = [root]) {
        if (!root.getVisible()) return [];
        const own = root.webContents && path.length > 1 ? [{ view: root, rect: rectOf(path) }] : [];
        return [...own, ...(root.children || []).flatMap((child) => shownIn(child, [...path, child]))];
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
        trust: (mod, session, entries) => CERTIFICATE.trust(PARTITION.spell(mod, session), entries),
        sessionsOf: (mod) => PARTITION.prefixOf(mod),
    };
}

// What a page's window.open asked for, in the words a mod's delegate reads: whether what opens comes forward, and the
// name it targets.
export function windowOptions({ disposition, frameName } = {}) {
    return { activates: disposition !== 'background-tab', target: String(frameName || '') };
}
