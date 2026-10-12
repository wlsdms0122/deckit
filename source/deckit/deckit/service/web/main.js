DeckitModule.define(
    'deckit/service/web/main',
    {
        uses: [
            'deckit/service/window',
            'deckit/service/log/main',
            'deckit/service/keymap/main',
            'deckit/service/plugin/identity',
            'deckit/service/web/session',
            'deckit/service/web/registry',
            'deckit/service/web/model/partition',
            'deckit/service/web/agent',
            'deckit/service/web/permission',
            'deckit/service/web/certificate',
            'deckit/service/web/script',
            'deckit/service/web/protocol',
        ],
        provides: ['start', 'host', 'hostOf', 'holdsKeyboard', 'windowOptions'],
    },
    (WINDOW, LOG, KEYMAP, IDENTITY, SESSION, REGISTRY, PARTITION, AGENT, PERMISSION, CERTIFICATE, SCRIPT, PROTOCOL) => {
        // MARK: - Property
        const KEPT_PREFERENCES = new Set(['partition', 'zoomFactor', 'disablePopups', 'plugins', 'javascript']);
        const icons = new Map(); // page id -> the icon it last announced
        const WINDOW_SIZE = { width: 520, height: 700 };
        const windows = new Map(); // window page id -> { window, host }

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PERMISSION.start();
            CERTIFICATE.start();
            SCRIPT.start();
            listen();
        }

        // A plugin's view that shows web pages. Only that plugin's sessions attach there, and only the web, or a
        // file for a plugin with system.files, loads in them.
        function host(view) {
            const plugin = IDENTITY.pluginOf(view);
            LOG.guard(view, 'will-attach-webview', (event, preferences, params) => {
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
                const named = [params.partition, preferences.partition].filter(Boolean).map(PARTITION.read);
                if (!named.length || named.some((session) => session?.plugin !== plugin.id)) {
                    event.preventDefault();
                    return;
                }
                SESSION.of(plugin.id, named[0].name);
                const source = String(params.src || '');
                if (source !== 'about:blank' && !mayShow(view, source, { inPage: true })) params.src = 'about:blank';
            });
            LOG.guard(view, 'did-attach-webview', (_event, page) => adopt(view, page, { inPage: true }));
            // A window page answers to the document that asked for it; a new document has no delegate for it.
            const closeWindows = () => {
                for (const entry of windows.values()) if (entry.host === view) entry.window.close();
            };
            LOG.guard(view, 'did-navigate', closeWindows);
            view.once('destroyed', closeWindows);
        }

        // The plugin's view a page shown in it answers to, so a keystroke in the page is the view's.
        function hostOf(page) {
            const entry = REGISTRY.get(page.id);
            return entry?.inPage && entry.tab === page.id ? entry.host : null;
        }

        function holdsKeyboard(view) {
            return [view, ...REGISTRY.pagesIn(view)].some(
                (contents) => !contents.isDestroyed() && contents.isFocused()
            );
        }

        // What a page's window.open asked for, in the words a plugin's delegate reads.
        function windowOptions({ disposition, frameName } = {}) {
            return { activates: disposition !== 'background-tab', target: String(frameName || '') };
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.window.handle(({ name, url, title }, sender) =>
                openWindow(sender, IDENTITY.pluginFrom(sender), name, url, title)
            );
            PROTOCOL.fetchText.handle(({ name, url }, sender) =>
                SESSION.fetchText(IDENTITY.pluginFrom(sender, 'system.network').id, name, url)
            );
            PROTOCOL.clear.handle(({ name }, sender) => SESSION.clear(IDENTITY.pluginFrom(sender).id, name));
            PROTOCOL.trust.handle(({ name, entries }, sender) =>
                CERTIFICATE.trust(partitionFor(sender, 'system.certificates', name), entries)
            );
            PROTOCOL.allow.handle(({ name, entries }, sender) =>
                PERMISSION.allow(partitionFor(sender, 'system.site-permissions', name), entries)
            );
            PROTOCOL.revoke.handle(({ name, entries }, sender) =>
                PERMISSION.revoke(partitionFor(sender, 'system.site-permissions', name), entries)
            );

            PROTOCOL.load.on(({ id, url }, sender) =>
                pageOf(sender, id)
                    ?.loadURL(url)
                    .catch(() => {})
            );
            PROTOCOL.navigate.on(({ id, to }, sender) => {
                const page = pageOf(sender, id);
                if (!page) return;
                const history = page.navigationHistory;
                if (to === 'back' && history.canGoBack()) history.goBack();
                else if (to === 'forward' && history.canGoForward()) history.goForward();
                else if (to === 'reload') page.reload();
                else if (to === 'stop') page.stop();
            });
            PROTOCOL.state.on(({ id }, sender) => {
                const page = pageOf(sender, id);
                if (page) report(sender, page);
            });
            PROTOCOL.mute.on(({ id, on }, sender) => {
                const page = pageOf(sender, id);
                if (!page) return;
                page.setAudioMuted(on);
                report(sender, page);
            });
            // Electron's findNext is true for a new search, false to move to the next match.
            PROTOCOL.find.on(({ id, text, start, back, matchCase }, sender) => {
                if (text) pageOf(sender, id)?.findInPage(text, { forward: !back, findNext: start, matchCase });
            });
            PROTOCOL.stopFind.on(({ id, keepSelection }, sender) => {
                pageOf(sender, id)?.stopFindInPage(keepSelection ? 'keepSelection' : 'clearSelection');
            });
            PROTOCOL.close.on(({ id }, sender) => {
                if (pageOf(sender, id)) windows.get(id)?.window.close();
            });
            PROTOCOL.clickNotification.on(({ id, notification }, sender) => {
                const page = pageOf(sender, id);
                if (page) SCRIPT.clickNotification(page, notification);
            });
        }

        function partitionFor(sender, permission, name) {
            return PARTITION.spell(IDENTITY.pluginFrom(sender, permission).id, name);
        }

        // A page the sender holds: one of its tabs, never another plugin's.
        function pageOf(sender, id) {
            const entry = REGISTRY.get(id);
            if (!entry || entry.host !== sender || !REGISTRY.isTab(id)) return null;
            const page = require('electron').webContents.fromId(id);
            return page && !page.isDestroyed() ? page : null;
        }

        // The web anywhere. A file only in the plugin's own view, and only for a plugin with system.files, asked at
        // each load so a plugin updated without the permission loses it at once.
        function mayShow(view, url, { inPage }) {
            if (/^https?:\/\//i.test(url)) return true;
            if (!inPage || !/^file:\/\//i.test(url)) return false;
            return !!IDENTITY.pluginOf(view)?.permissions.some(({ id }) => id === 'system.files');
        }

        // A file document never becomes a web one in its page: the session given to show files would keep the web's
        // cookies. The web it asks for goes to whoever shows the page instead.
        function leavesFile(page, url) {
            return /^file:/i.test(page.getURL()) && /^https?:/i.test(String(url));
        }

        function stateOf(page) {
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

        function report(view, page) {
            if (!page.isDestroyed()) PROTOCOL.changed.send(view, { id: page.id, state: stateOf(page) });
        }

        function adopt(view, page, { inPage }) {
            const id = page.id;
            REGISTRY.add(page, { host: view, plugin: IDENTITY.pluginOf(view).id, tab: id, inPage });
            // A page is a webContents of its own: its keystrokes reach the key map only when it is listened to.
            KEYMAP.listen(page);
            AGENT.presentAsBrowser(page);
            page.once('destroyed', () => icons.delete(id));
            const changed = () => report(view, page);
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
            // straight to loadURL. The page is deckit's own, made by its view. A link followed inside is will-navigate.
            const load = page.loadURL.bind(page);
            page.loadURL = (url, options) => {
                const to = String(url || '');
                if (leavesFile(page, to)) {
                    PROTOCOL.leaving.send(view, { id, url: to });
                    return Promise.resolve();
                }
                return mayShow(view, to, { inPage }) ? load(url, options) : Promise.resolve();
            };
            LOG.guard(page, 'will-navigate', (event, url) => {
                if (!leavesFile(page, url)) return;
                event.preventDefault();
                PROTOCOL.leaving.send(view, { id, url: String(url) });
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
                PROTOCOL.found.send(view, {
                    id,
                    matches: result.matches,
                    active: result.activeMatchOrdinal,
                    final: result.finalUpdate,
                })
            );
            SCRIPT.attach(view, page, changed);
            holdWindowOpen(view, page, { inPage });
        }

        // In a window, every page opened is a window: a consent step's popup posts its answer back to its opener,
        // which a tab could not do. A popup keeps the page Chromium made for it, where the opener link is, and it is
        // not a child window, which macOS fastens to its parent. A file page's window would share its session, so
        // it is asked of the delegate instead.
        function holdWindowOpen(view, page, { inPage }) {
            page.setWindowOpenHandler(({ url, disposition, frameName }) => {
                // An app's address opened as a window is the same question as one navigated to.
                if (!/^https?:\/\//i.test(url)) {
                    const at = REGISTRY.tabOf(page);
                    if (at)
                        PERMISSION.mayOpenApp(view, at.tab, url, page).then(
                            (ok) => ok && require('electron').shell.openExternal(url)
                        );
                    return { action: 'deny' };
                }
                if ((!inPage || disposition === 'new-window') && !/^file:/i.test(page.getURL())) {
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
                        createWindow: (options) => openPopup(view, page, options),
                    };
                }
                PROTOCOL.opening.send(view, {
                    id: REGISTRY.get(page.id)?.tab ?? page.id,
                    url,
                    ...windowOptions({ disposition, frameName }),
                });
                return { action: 'deny' };
            });
        }

        // A window a page opened answers to that page's tab, as do the windows it opens in turn.
        function openPopup(view, opener, options) {
            const { WebContentsView } = require('electron');
            const pageView = new WebContentsView({
                webContents: options.webContents,
                webPreferences: options.webPreferences,
            });
            const page = pageView.webContents;
            const tab = REGISTRY.get(opener.id)?.tab ?? opener.id;
            REGISTRY.add(page, { host: view, plugin: IDENTITY.pluginOf(view).id, tab });
            KEYMAP.listen(page);
            holdWindowOpen(view, page, { inPage: false });
            const size = options.width && options.height ? { width: options.width, height: options.height } : null;
            showInWindow(pageView, { size: size || WINDOW_SIZE });
            return page;
        }

        function openWindow(view, plugin, name, url, title) {
            if (!mayShow(view, url, { inPage: false })) return 0;
            const { WebContentsView } = require('electron');
            const pageView = new WebContentsView({
                webPreferences: {
                    session: SESSION.of(plugin.id, name),
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });
            const page = pageView.webContents;
            const id = page.id;
            const window = showInWindow(pageView, { title, size: WINDOW_SIZE });
            windows.set(id, { window, host: view });
            LOG.guard(window, 'closed', () => {
                windows.delete(id);
                PROTOCOL.closed.send(view, { id });
            });
            adopt(view, page, { inPage: false });
            page.loadURL(url).catch(() => {});
            return id;
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

        return { start, host, hostOf, holdsKeyboard, windowOptions };
    }
);
