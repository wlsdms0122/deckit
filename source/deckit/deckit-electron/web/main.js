import * as ENVIRONMENT from '../../deckit-shell/environment/index.js';
import { createPartition } from './model/partition.js';
import { createSession } from './session.js';
import { createRegistry } from './registry.js';
import { createDebugger } from './debugger.js';
import { createAgent } from './agent.js';
import { createSitePermission } from './site-permission.js';
import { createCertificate } from './certificate.js';
import { createScript } from './script.js';

// The web pages a mod's page shows, as Electron shows them (deckit-shell/environment: MAIN.web): a <webview> in the
// mod's page, or a page in a window of the app's, each in a session of the mod's, its web page id its webContents id.
export function createWeb({ CONFIG, LOG, WINDOW }) {
    // MARK: - Property
    const KEPT_PREFERENCES = new Set(['partition', 'zoomFactor', 'disablePopups', 'plugins', 'javascript']);
    const icons = new Map(); // page id -> the icon it last announced
    const WINDOW_SIZE = { width: 520, height: 700 };
    const windows = new Map(); // window page id -> { window, embedder }
    const PARTITION = createPartition({ CONFIG });
    const SESSION = createSession({ PARTITION });
    const REGISTRY = createRegistry();
    const DEBUGGER = createDebugger({ LOG });
    const AGENT = createAgent({ CONFIG, DEBUGGER, LOG });
    let deck = null; // what deck answers and is told (listen)
    const told =
        (name) =>
        (...args) =>
            deck[name](...args);
    const sessionOfPage = (page) => PARTITION.read(SESSION.partitionOf(page));
    const SITE_PERMISSION = createSitePermission({
        SESSION,
        REGISTRY,
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
    }

    function embed(modPage) {
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
        const pageView = new WebContentsView({
            webPreferences: {
                session: SESSION.of(mod, session),
                sandbox: true,
                contextIsolation: true,
                nodeIntegration: false,
            },
        });
        const page = pageView.webContents;
        const id = page.id;
        const window = showInWindow(pageView, { title, size: WINDOW_SIZE });
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
            capture: SCRIPT.captureOf(page.id),
        };
    }

    // MARK: - Private
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

    // A popup keeps the page Chromium made for it, where the opener link is, and it is not a child window, which macOS
    // fastens to its parent.
    function holdWindowOpen(modPage, page, { inPage }) {
        page.setWindowOpenHandler(({ url, disposition, frameName }) => {
            const asked = {
                url,
                tab: REGISTRY.get(page.id)?.tab ?? page.id,
                from: page.getURL(),
                inPage,
                ownWindow: disposition === 'new-window',
                ...windowOptions({ disposition, frameName }),
            };
            if (!deck.windowOpen(modPage, page, asked)) return { action: 'deny' };
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
                createWindow: (options) => openPopup(modPage, page, options),
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
        holdWindowOpen(modPage, page, { inPage: false });
        const size = options.width && options.height ? { width: options.width, height: options.height } : null;
        showInWindow(pageView, { size: size || WINDOW_SIZE });
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
