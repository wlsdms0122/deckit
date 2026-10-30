import * as ENVIRONMENT from '../../deckit-shell/environment/index.js';
import { createPartition } from './model/partition.js';
import { createSession } from './session.js';
import { createRegistry } from './registry.js';
import { createDebugger } from './debugger.js';
import { createAgent } from './agent.js';
import { createSitePermission } from './site-permission.js';
import { createCertificate } from './certificate.js';
import { createScript } from './script.js';
import { createWebKit } from './webkit.js';
import * as PROTOCOL from './protocol.js';

// The web pages a mod's page shows, as the Electron environment shows them (deckit-shell/environment: MAIN.web):
// WebKit's, over the element holding its place in the mod's page, or a page in a window of the app's, each in a
// session of the mod's. `webkit` is the module WebKit's pages are made by and `viewOf(page)` the view a page of
// deckit's is in.
// `made(make)` makes a webContents as deckit's, and `claim()` claims what Electron makes until it is released, so each
// is known as deckit's as Electron tells of it, and `hold(target, setter, handler)` sets a handler on one of them and
// keeps it.
export function createWeb({ CONFIG, LOG, WINDOW, made, claim, hold, webkit, viewOf }) {
    // MARK: - Property
    const KEPT_PREFERENCES = new Set(['partition', 'zoomFactor', 'disablePopups', 'plugins', 'javascript']);
    const icons = new Map(); // page id -> the icon it last announced
    const windows = new Map(); // window page id -> { window, embedder }
    const PARTITION = createPartition({ CONFIG });
    const DEBUGGER = createDebugger({ LOG });
    const AGENT = createAgent({ CONFIG, DEBUGGER, LOG });
    const SESSION = createSession({ PARTITION, deck: () => deck });
    const REGISTRY = createRegistry();
    const WEBKIT = createWebKit({ path: webkit, LOG });
    const embedders = new WeakSet(); // the mods' pages that show web pages
    const shown = new Map(); // id -> a WebKit page an element shows
    const layouts = new Map(); // id -> where its mod's page last said it shows, { frame, visible, holes }
    const following = new WeakSet(); // the mods' pages whose view a WebKit page follows
    let deck = null; // what deck answers and is told (listen)
    const told =
        (name) =>
        (...args) =>
            deck[name](...args);
    const sessionOfPage = (page) => PARTITION.read(SESSION.partitionOf(page));
    const SITE_PERMISSION = createSitePermission({
        SESSION,
        REGISTRY,
        hold,
        sessionOf: sessionOfPage,
        permits: told('permits'),
        request: told('request'),
        requestApp: told('requestApp'),
    });
    const CERTIFICATE = createCertificate({ LOG, SESSION, REGISTRY, refused: told('refused') });
    const SCRIPT = createScript({
        LOG,
        DEBUGGER,
        sessionOf: sessionOfPage,
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
        SITE_PERMISSION.start();
        CERTIFICATE.start();
        hear();
    }

    function embed(modPage) {
        embedders.add(modPage);
        // A replaced document takes the web pages it showed with it, as it takes its elements.
        const closeShown = () => {
            for (const page of [...shown.values()]) if (REGISTRY.get(page.id)?.embedder === modPage) page.close();
        };
        LOG.guard(modPage, 'did-navigate', closeShown);
        LOG.guard(modPage, 'destroyed', closeShown, { once: true });
        LOG.guard(modPage, 'will-attach-webview', (event, preferences, params) => {
            // A page keeps only what an element may choose; the rules between sites and the sandbox are deckit's.
            for (const key of Object.keys(preferences)) if (!KEPT_PREFERENCES.has(key)) delete preferences[key];
            Object.assign(preferences, {
                nodeIntegration: false,
                contextIsolation: true,
                sandbox: true,
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: false,
            });
            // Whatever fails on the way, the web page is not shown.
            const source = String(params.src || '');
            let shows = false;
            try {
                const session = sessionOf([params.partition, preferences.partition].filter(Boolean));
                if (!deck.attaching(modPage, session)) throw new Error("its session is not the mod's");
                SESSION.of(session.mod, session.name);
                shows = source === 'about:blank' || deck.loading(modPage, null, source, { inPage: true }) === 'load';
            } catch (error) {
                LOG.warn('a web page was not shown', error?.message || '');
                event.preventDefault();
                return;
            }
            if (!shows) params.src = 'about:blank';
        });
        LOG.guard(modPage, 'did-attach-webview', (_event, page) => adopt(modPage, page, { inPage: true }));
    }

    // A web page deck holds, while it is there.
    function pageOf(id) {
        if (!REGISTRY.get(id)) return null;
        if (shown.has(id)) return shown.get(id);
        const page = require('electron').webContents.fromId(id);
        return page && !page.isDestroyed() ? page : null;
    }

    function holderOf(page) {
        const entry = REGISTRY.get(page.id);
        return entry ? { embedder: entry.embedder, id: page.id, tab: entry.tab, inPage: entry.inPage } : null;
    }

    function holdsKeyboard(modPage) {
        return [modPage, ...REGISTRY.pagesIn(modPage)].some(
            (contents) => !contents.isDestroyed() && contents.isFocused()
        );
    }

    function openWindow(modPage, { mod, session, url, title }) {
        const { WebContentsView } = require('electron');
        const pageView = made(
            () =>
                new WebContentsView({
                    webPreferences: {
                        session: SESSION.of(mod, session),
                        sandbox: true,
                        contextIsolation: true,
                        nodeIntegration: false,
                    },
                })
        );
        const page = pageView.webContents;
        const id = page.id;
        const window = showInWindow(pageView, { title, size: deck.windowSize });
        windows.set(id, { window, embedder: modPage });
        LOG.guard(window, 'closed', () => {
            windows.delete(id);
            deck.closed(modPage, id);
        });
        adopt(modPage, page, { inPage: false });
        page.loadURL(url).catch(() => {});
        return id;
    }

    function load(page, url) {
        page.loadURL(url).catch(() => {});
    }

    function navigate(page, to) {
        const history = page.navigationHistory;
        if (to === 'back' && history.canGoBack()) history.goBack();
        else if (to === 'forward' && history.canGoForward()) history.goForward();
        else if (to === 'reload') page.reload();
        else if (to === 'stop') page.stop();
    }

    function setMuted(page, on) {
        page.setAudioMuted(on);
    }

    // Electron's findNext is true for a new search, false to move to the next match.
    function find(page, text, { start, back, matchCase }) {
        if (text) page.findInPage(text, { forward: !back, findNext: start, matchCase });
    }

    function stopFind(page, { keepSelection }) {
        page.stopFindInPage(keepSelection ? 'keepSelection' : 'clearSelection');
    }

    function close(page) {
        windows.get(page.id)?.window.close();
    }

    function stateOf(page) {
        if (page.isDestroyed()) return null;
        const history = page.navigationHistory;
        return {
            url: page.getURL(),
            title: page.getTitle(),
            icon: icons.get(page.id) || '',
            loading: page.isLoading(),
            canGoBack: history.canGoBack(),
            canGoForward: history.canGoForward(),
            audible: page.isCurrentlyAudible(),
            muted: page.isAudioMuted(),
            capture: page.isWebKit ? page.capture() : SCRIPT.captureOf(page.id),
        };
    }

    // MARK: - Private
    // What a mod's page asks and tells of the web pages it shows on WebKit, each from that page alone.
    function hear() {
        const { ipcMain } = require('electron');
        const ownPage = (event, id) => {
            const page = shown.get(id);
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
        LOG.guard(ipcMain, PROTOCOL.remove, (event, { id }) => ownPage(event, id)?.close());
    }

    // A web page an element of `modPage` shows, in the session `partition` spells, loaded at `url` as deck lets it:
    // its id, or null when it is not shown.
    function show(modPage, { partition, url }) {
        try {
            if (!embedders.has(modPage)) throw new Error('the page shows no web pages');
            const session = sessionOf([partition]);
            if (!deck.attaching(modPage, session)) throw new Error("its session is not the mod's");
            SESSION.of(session.mod, session.name);
            const delegate = delegateOf(modPage);
            const page = WEBKIT.make({ partition: PARTITION.spell(session.mod, session.name), delegate });
            delegate.adopt(page);
            shown.set(page.id, page);
            page.once('destroyed', () => {
                shown.delete(page.id);
                layouts.delete(page.id);
            });
            follow(modPage);
            adopt(modPage, page, { inPage: true });
            if (url && url !== 'about:blank') page.loadURL(url);
            return page.id;
        } catch (error) {
            LOG.warn('a web page was not shown', error?.message || '');
            return null;
        }
    }

    // What a WebKit page asks, put to deck: a link it follows, a window it opens, and what it asks to have.
    function delegateOf(modPage) {
        let page = null;
        const delegate = {
            navigate: (url) =>
                deck.loading(modPage, page, String(url), { inPage: true, from: page.getURL(), followed: true }),
            open: ({ url, ownWindow, background }) => {
                const asked = {
                    url,
                    tab: REGISTRY.get(page.id)?.tab ?? page.id,
                    from: page.getURL(),
                    inPage: true,
                    ownWindow,
                    activates: !background,
                    target: '',
                };
                if (deck.windowOpen(modPage, page, asked))
                    LOG.warn('a web page on WebKit has no window of its own yet');
            },
            permission: ({ origin, permissions }) => {
                const at = REGISTRY.tabOf(page);
                return at ? deck.request(at.embedder, at.tab.id, { origin, permissions }) : Promise.resolve(false);
            },
        };
        return Object.assign(delegate, { adopt: (made) => (page = made) });
    }

    // A mod's page moved or shown elsewhere moves its web pages with it. The stage shows a view after it sizes it, in
    // the same turn, so they move at the next.
    function follow(modPage) {
        const view = viewOf(modPage);
        if (!view || following.has(modPage)) return;
        following.add(modPage);
        const placeAll = () => {
            for (const page of shown.values()) if (REGISTRY.get(page.id)?.embedder === modPage) place(modPage, page);
        };
        LOG.guard(view, 'bounds-changed', () => setImmediate(placeAll));
    }

    // Where a web page shows: `frame`, the element's rect in the mod's page, which is laid at `page` in its window.
    function place(modPage, page) {
        const { frame, visible, holes } = layouts.get(page.id) || {};
        const laid = frame && laidOf(modPage);
        if (!laid) return page.place({ visible: false });
        const zoom = modPage.getZoomFactor();
        const scaled = (rect) => ({
            x: rect.x * zoom,
            y: rect.y * zoom,
            width: rect.width * zoom,
            height: rect.height * zoom,
        });
        page.place({
            window: laid.window.getNativeWindowHandle(),
            page: laid.rect,
            above: laid.above,
            frame: scaled(frame),
            visible,
            holes: holes.map(scaled),
        });
    }

    // The window a page of deckit's is shown in, its rect in the window's content, and how many shown pages are laid
    // over it at the same rect, which WebKit's module tells it from by that: none while it is not shown.
    function laidOf(modPage) {
        const view = viewOf(modPage);
        if (!view) return null;
        const { BaseWindow } = require('electron');
        for (const window of BaseWindow.getAllWindows()) {
            const path = pathTo(window.contentView, view);
            if (!path) continue;
            if (path.some((node) => !node.getVisible())) return null;
            const rect = rectOf(path);
            const same = (other) => ['x', 'y', 'width', 'height'].every((key) => Math.abs(other[key] - rect[key]) < 1);
            const shown = pagesIn(window.contentView);
            const above = shown
                .slice(shown.findIndex((laid) => laid.view === view) + 1)
                .filter((laid) => same(laid.rect));
            return { window, rect, above: above.length };
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
    function pagesIn(root, path = [root]) {
        if (!root.getVisible()) return [];
        const own = root.webContents && path.length > 1 ? [{ view: root, rect: rectOf(path) }] : [];
        return [...own, ...(root.children || []).flatMap((child) => pagesIn(child, [...path, child]))];
    }

    function pathTo(from, view) {
        if (from === view) return [from];
        for (const child of from.children || []) {
            const path = pathTo(child, view);
            if (path) return [from, ...path];
        }
        return null;
    }

    // The session the partitions an element names spell, one and the same, as `{ mod, name }`, or null.
    function sessionOf(partitions) {
        const named = partitions.map(PARTITION.read);
        const [first] = named;
        return first && named.every((session) => session?.mod === first.mod && session.name === first.name)
            ? first
            : null;
    }

    function report(modPage, page) {
        const state = stateOf(page);
        if (state) deck.changed(modPage, page.id, state);
    }

    function adopt(modPage, page, { inPage }) {
        if (page.isWebKit) return adoptWebKit(modPage, page);
        const id = page.id;
        REGISTRY.add(page, { embedder: modPage, tab: id, inPage });
        deck.adopted(modPage, page);
        AGENT.presentAsBrowser(page);
        page.once('destroyed', () => icons.delete(id));
        const changed = () => report(modPage, page);
        for (const event of [
            'did-start-loading',
            'did-stop-loading',
            'did-navigate-in-page',
            'page-title-updated',
            'did-fail-load',
            'audio-state-changed',
        ]) {
            LOG.guard(page, event, changed);
        }
        // Every load passes here, whoever starts it: a load asked over IPC, or the element's src, which goes
        // straight to loadURL. The page is deckit's own, made by its mod's page. A link followed inside is
        // will-navigate.
        const loadURL = page.loadURL.bind(page);
        page.loadURL = (url, options) => {
            const verdict = deck.loading(modPage, page, String(url || ''), { inPage, from: page.getURL() });
            return verdict === 'load' ? loadURL(url, options) : Promise.resolve();
        };
        LOG.guard(page, 'will-navigate', (event, url) => {
            const verdict = deck.loading(modPage, page, String(url), { inPage, from: page.getURL(), followed: true });
            if (verdict !== 'load') event.preventDefault();
        });
        // A new document starts without the last one's icon or streams; it announces its own.
        LOG.guard(page, 'did-navigate', () => {
            icons.delete(id);
            SCRIPT.forget(id);
            changed();
        });
        LOG.guard(page, 'page-favicon-updated', (_event, list) => {
            icons.set(id, list[0] || '');
            changed();
        });
        LOG.guard(page, 'found-in-page', (_event, result) =>
            deck.found(modPage, id, {
                matches: result.matches,
                active: result.activeMatchOrdinal,
                final: result.finalUpdate,
            })
        );
        SCRIPT.attach(modPage, page, changed);
        holdWindowOpen(modPage, page, { inPage });
    }

    // A WebKit page asks deck before its own loads, and tells it of each change. What it is shown as, it shows.
    function adoptWebKit(modPage, page) {
        const id = page.id;
        REGISTRY.add(page, { embedder: modPage, tab: id, inPage: true });
        const changed = () => report(modPage, page);
        for (const event of ['state-changed', 'did-start-loading', 'did-stop-loading', 'did-fail-load']) {
            LOG.guard(page, event, changed);
        }
        LOG.guard(page, 'did-navigate', () => {
            icons.delete(id);
            changed();
        });
        LOG.guard(page, 'focus', () => modPage.send(PROTOCOL.told, { id, event: 'focus' }));
        LOG.guard(page, 'close', () => modPage.send(PROTOCOL.told, { id, event: 'close' }));
        page.once('destroyed', () => icons.delete(id));
        const loadURL = page.loadURL;
        page.loadURL = (url) => {
            const verdict = deck.loading(modPage, page, String(url || ''), { inPage: true, from: page.getURL() });
            return verdict === 'load' ? loadURL(url) : Promise.resolve();
        };
        deck.adopted(modPage, page);
    }

    // A popup keeps the page Chromium made for it, where the opener link is, and it is not a child window, which macOS
    // fastens to its parent.
    function holdWindowOpen(modPage, page, { inPage }) {
        hold(page, 'setWindowOpenHandler', ({ url, disposition, frameName }) => {
            const asked = {
                url,
                tab: REGISTRY.get(page.id)?.tab ?? page.id,
                from: page.getURL(),
                inPage,
                ownWindow: disposition === 'new-window',
                ...windowOptions({ disposition, frameName }),
            };
            if (!deck.windowOpen(modPage, page, asked)) return { action: 'deny' };
            // Electron makes the popup before it calls createWindow, in this same turn; one it does not make is let go
            // at the next.
            const release = claim();
            setImmediate(release);
            return {
                action: 'allow',
                overrideBrowserWindowOptions: {
                    webPreferences: {
                        session: page.session,
                        sandbox: true,
                        contextIsolation: true,
                        nodeIntegration: false,
                    },
                },
                createWindow: (options) => {
                    release();
                    return openPopup(modPage, page, options);
                },
            };
        });
    }

    // A window a page opened answers to that page's tab, as do the windows it opens in turn.
    function openPopup(modPage, opener, options) {
        const { WebContentsView } = require('electron');
        const pageView = new WebContentsView({
            webContents: options.webContents,
            webPreferences: options.webPreferences,
        });
        const page = pageView.webContents;
        const tab = REGISTRY.get(opener.id)?.tab ?? opener.id;
        REGISTRY.add(page, { embedder: modPage, tab });
        deck.adopted(modPage, page);
        AGENT.presentAsBrowser(page);
        holdWindowOpen(modPage, page, { inPage: false });
        const size = options.width && options.height ? { width: options.width, height: options.height } : null;
        const window = showInWindow(pageView, { size: size || deck.windowSize });
        const closeWithOpener = LOG.guard(opener, 'destroyed', () => !window.isDestroyed() && window.close());
        page.once('destroyed', () => !opener.isDestroyed() && opener.removeListener('destroyed', closeWithOpener));
        return page;
    }

    // A page in a window of the app's, the two going together: the page closes with the window, and a page that
    // closes itself takes its window.
    function showInWindow(pageView, { title = '', size }) {
        const page = pageView.webContents;
        let closing = false;
        const window = WINDOW.open({
            view: pageView,
            title,
            size,
            onClose: () => {
                closing = true;
                if (!page.isDestroyed()) page.close();
            },
        });
        page.once('destroyed', () => !closing && !window.isDestroyed() && window.close());
        return window;
    }

    // Whether a page is a web page a mod shows, or one such a page opened.
    function has(page) {
        return REGISTRY.get(page.id) !== null;
    }

    return {
        has,
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
        sessionOf: sessionOfPage,
        permissionsChanged: () => SCRIPT.permissionsChanged(),
        fetchText: (mod, session, url) => SESSION.fetchText(mod, session, url),
        clear: (mod, session) => SESSION.clear(mod, session),
        trust: (mod, session, entries) => CERTIFICATE.trust(PARTITION.spell(mod, session), entries),
        sessionsOf: (mod) => PARTITION.prefixOf(mod),
    };
}

// What a page's window.open asked for, in the words a mod's delegate reads: whether what opens comes forward, and the
// name it targets.
export function windowOptions({ disposition, frameName } = {}) {
    return { activates: disposition !== 'background-tab', target: String(frameName || '') };
}
