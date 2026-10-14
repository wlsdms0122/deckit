DeckitModule.define(
    'deckit/web/main',
    {
        uses: [
            'deckit/window',
            'deck/log/main',
            'deckit/keymap/main',
            'deck/identity',
            'deckit/web/session',
            'deckit/web/registry',
            'deckit/web/model/partition',
            'deckit/web/agent',
            'deckit/web/site-permission',
            'deckit/web/certificate',
            'deckit/web/script',
            'deckit/web/protocol',
            'deckit/web/model/permission',
        ],
        provides: ['start', 'host', 'hostOf', 'pageFor', 'holdsKeyboard', 'windowOptions'],
    },
    (
        WINDOW,
        LOG,
        KEYMAP,
        IDENTITY,
        SESSION,
        REGISTRY,
        PARTITION,
        AGENT,
        SITE_PERMISSION,
        CERTIFICATE,
        SCRIPT,
        PROTOCOL,
        WEB_PERMISSION
    ) => {
        // MARK: - Property
        const KEPT_PREFERENCES = new Set(['partition', 'zoomFactor', 'disablePopups', 'plugins', 'javascript']);
        const icons = new Map(); // page id -> the icon it last announced
        const WINDOW_SIZE = { width: 520, height: 700 };
        const windows = new Map(); // window page id -> { window, host }

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            SITE_PERMISSION.start();
            CERTIFICATE.start();
            SCRIPT.start();
            listen();
        }

        // A mod's page that shows web pages. Only that mod's sessions attach there, and only the web, or a
        // file for a mod with system.files, loads in them.
        function host(modPage) {
            const mod = IDENTITY.modOf(modPage);
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
                const named = [params.partition, preferences.partition].filter(Boolean).map(PARTITION.read);
                if (!named.length || named.some((session) => session?.mod !== mod.id)) {
                    event.preventDefault();
                    return;
                }
                SESSION.of(mod.id, named[0].name);
                const source = String(params.src || '');
                if (source !== 'about:blank' && !mayShow(modPage, source, { inPage: true })) params.src = 'about:blank';
            });
            LOG.guard(modPage, 'did-attach-webview', (_event, page) => adopt(modPage, page, { inPage: true }));
            // A window page answers to the document that asked for it; a new document has no delegate for it.
            const closeWindows = () => {
                for (const entry of windows.values()) if (entry.host === modPage) entry.window.close();
            };
            LOG.guard(modPage, 'did-navigate', closeWindows);
            modPage.once('destroyed', closeWindows);
        }

        // The mod's page a web page shown in it answers to, so a keystroke in the web page is the mod page's.
        function hostOf(page) {
            const entry = REGISTRY.get(page.id);
            return entry?.inPage && entry.tab === page.id ? entry.host : null;
        }

        // The deckit page a webContents answers to: a mod's or one the shell made, or the mod page that shows it as a
        // web page.
        function pageFor(webContents) {
            if (IDENTITY.modOf(webContents) || IDENTITY.pageNameOf(webContents)) return webContents;
            return hostOf(webContents);
        }

        function holdsKeyboard(modPage) {
            return [modPage, ...REGISTRY.pagesIn(modPage)].some(
                (contents) => !contents.isDestroyed() && contents.isFocused()
            );
        }

        // What a page's window.open asked for, in the words a mod's delegate reads.
        function windowOptions({ disposition, frameName } = {}) {
            return { activates: disposition !== 'background-tab', target: String(frameName || '') };
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.window.handle(({ name, url, title }, sender) =>
                openWindow(sender, IDENTITY.modFrom(sender), name, url, title)
            );
            PROTOCOL.fetchText.handle(({ name, url }, sender) =>
                SESSION.fetchText(IDENTITY.modFrom(sender, WEB_PERMISSION.NETWORK).id, name, url)
            );
            PROTOCOL.clear.handle(({ name }, sender) => SESSION.clear(IDENTITY.modFrom(sender).id, name));
            PROTOCOL.trust.handle(({ name, entries }, sender) =>
                CERTIFICATE.trust(partitionFor(sender, WEB_PERMISSION.CERTIFICATES, name), entries)
            );
            PROTOCOL.allow.handle(({ name, entries }, sender) =>
                SITE_PERMISSION.allow(partitionFor(sender, WEB_PERMISSION.SITE_PERMISSIONS, name), entries)
            );
            PROTOCOL.revoke.handle(({ name, entries }, sender) =>
                SITE_PERMISSION.revoke(partitionFor(sender, WEB_PERMISSION.SITE_PERMISSIONS, name), entries)
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
            return PARTITION.spell(IDENTITY.modFrom(sender, permission).id, name);
        }

        // A page the sender holds: one of its tabs, never another mod's.
        function pageOf(sender, id) {
            const entry = REGISTRY.get(id);
            if (!entry || entry.host !== sender || !REGISTRY.isTab(id)) return null;
            const page = require('electron').webContents.fromId(id);
            return page && !page.isDestroyed() ? page : null;
        }

        // The web anywhere. A file only in the mod's own page, and only for a mod with system.files, asked at
        // each load so a mod updated without the permission loses it at once.
        function mayShow(modPage, url, { inPage }) {
            if (/^https?:\/\//i.test(url)) return true;
            if (!inPage || !/^file:\/\//i.test(url)) return false;
            return !!IDENTITY.modOf(modPage)?.permissions.some(({ id }) => id === WEB_PERMISSION.FILES);
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

        function report(modPage, page) {
            if (!page.isDestroyed()) PROTOCOL.changed.send(modPage, { id: page.id, state: stateOf(page) });
        }

        function adopt(modPage, page, { inPage }) {
            const id = page.id;
            REGISTRY.add(page, { host: modPage, mod: IDENTITY.modOf(modPage).id, tab: id, inPage });
            // A page is a webContents of its own: its keystrokes reach the key map only when it is listened to.
            KEYMAP.listen(page);
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
            const load = page.loadURL.bind(page);
            page.loadURL = (url, options) => {
                const to = String(url || '');
                if (leavesFile(page, to)) {
                    PROTOCOL.leaving.send(modPage, { id, url: to });
                    return Promise.resolve();
                }
                return mayShow(modPage, to, { inPage }) ? load(url, options) : Promise.resolve();
            };
            LOG.guard(page, 'will-navigate', (event, url) => {
                if (!leavesFile(page, url)) return;
                event.preventDefault();
                PROTOCOL.leaving.send(modPage, { id, url: String(url) });
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
                PROTOCOL.found.send(modPage, {
                    id,
                    matches: result.matches,
                    active: result.activeMatchOrdinal,
                    final: result.finalUpdate,
                })
            );
            SCRIPT.attach(modPage, page, changed);
            holdWindowOpen(modPage, page, { inPage });
        }

        // In a window, every page opened is a window: a consent step's popup posts its answer back to its opener,
        // which a tab could not do. A popup keeps the page Chromium made for it, where the opener link is, and it is
        // not a child window, which macOS fastens to its parent. A file page's window would share its session, so
        // it is asked of the delegate instead.
        function holdWindowOpen(modPage, page, { inPage }) {
            page.setWindowOpenHandler(({ url, disposition, frameName }) => {
                // An app's address opened as a window is the same question as one navigated to.
                if (!/^https?:\/\//i.test(url)) {
                    const at = REGISTRY.tabOf(page);
                    if (at)
                        SITE_PERMISSION.mayOpenApp(modPage, at.tab, url, page).then(
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
                        createWindow: (options) => openPopup(modPage, page, options),
                    };
                }
                PROTOCOL.opening.send(modPage, {
                    id: REGISTRY.get(page.id)?.tab ?? page.id,
                    url,
                    ...windowOptions({ disposition, frameName }),
                });
                return { action: 'deny' };
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
            REGISTRY.add(page, { host: modPage, mod: IDENTITY.modOf(modPage).id, tab });
            KEYMAP.listen(page);
            holdWindowOpen(modPage, page, { inPage: false });
            const size = options.width && options.height ? { width: options.width, height: options.height } : null;
            showInWindow(pageView, { size: size || WINDOW_SIZE });
            return page;
        }

        function openWindow(modPage, mod, name, url, title) {
            if (!mayShow(modPage, url, { inPage: false })) return 0;
            const { WebContentsView } = require('electron');
            const pageView = new WebContentsView({
                webPreferences: {
                    session: SESSION.of(mod.id, name),
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });
            const page = pageView.webContents;
            const id = page.id;
            const window = showInWindow(pageView, { title, size: WINDOW_SIZE });
            windows.set(id, { window, host: modPage });
            LOG.guard(window, 'closed', () => {
                windows.delete(id);
                PROTOCOL.closed.send(modPage, { id });
            });
            adopt(modPage, page, { inPage: false });
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

        return { start, host, hostOf, pageFor, holdsKeyboard, windowOptions };
    }
);
