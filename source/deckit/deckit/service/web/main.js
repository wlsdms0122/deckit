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
            'deckit/service/web/model/protocol',
        ],
        provides: ['start', 'host', 'hostOf', 'holdsKeyboard', 'windowOptions'],
    },
    (WINDOW, LOG, KEYMAP, IDENTITY, SESSION, REGISTRY, PARTITION, AGENT, PERMISSION, CERTIFICATE, SCRIPT, PROTOCOL) => {
        // MARK: - Property
        const KEPT_PREFERENCES = new Set(['partition', 'zoomFactor', 'disablePopups', 'plugins', 'javascript']);
        const icons = new Map(); // page id -> the icon it last announced
        const windows = new Map(); // window page id -> { window, host }
        const styles = new Map(); // a plugin's view -> how its windows look now: the panel changes theme

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
        function host(view, style) {
            const plugin = IDENTITY.pluginOf(view);
            styles.set(view, style);
            view.once('destroyed', () => styles.delete(view));
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
                if (source !== 'about:blank' && !mayShow(view, source, { inPanel: true })) params.src = 'about:blank';
            });
            LOG.guard(view, 'did-attach-webview', (_event, page) => adopt(view, style, page, { inPanel: true }));
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
            return entry?.inPanel && entry.tab === page.id ? entry.host : null;
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
        function mayShow(view, url, { inPanel }) {
            if (/^https?:\/\//i.test(url)) return true;
            if (!inPanel || !/^file:\/\//i.test(url)) return false;
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

        function adopt(view, style, page, { inPanel }) {
            const id = page.id;
            REGISTRY.add(page, { host: view, plugin: IDENTITY.pluginOf(view).id, tab: id, inPanel });
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
                return mayShow(view, to, { inPanel }) ? load(url, options) : Promise.resolve();
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
            holdWindowOpen(view, style, page, { inPanel });
            watchWindows(view, style, page, id);
        }

        // A window a page opened answers to that page's tab, as do the windows it opens in turn.
        function watchWindows(view, style, page, tab) {
            LOG.guard(page, 'did-create-window', (child) => {
                REGISTRY.add(child.webContents, { host: view, plugin: IDENTITY.pluginOf(view).id, tab });
                KEYMAP.listen(child.webContents);
                WINDOW.dress(child, style());
                holdWindowOpen(view, style, child.webContents, { inPanel: false });
                watchWindows(view, style, child.webContents, tab);
            });
        }

        // In a window, every page opened is a window: a consent step's popup posts its answer back to its opener,
        // which a tab could not do. A popup keeps Chromium's own window, where the opener link is made, and it is
        // not a child window, which macOS fastens to its parent. A file page's window would share its session, so
        // it is asked of the delegate instead.
        function holdWindowOpen(view, style, page, { inPanel }) {
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
                if ((!inPanel || disposition === 'new-window') && !/^file:/i.test(page.getURL())) {
                    return {
                        action: 'allow',
                        overrideBrowserWindowOptions: {
                            ...WINDOW.optionsFor(style()),
                            webPreferences: {
                                session: page.session,
                                sandbox: true,
                                contextIsolation: true,
                                nodeIntegration: false,
                            },
                        },
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

        // Over the focused window, since asking was a click there.
        function openWindow(view, plugin, name, url, title) {
            if (!mayShow(view, url, { inPanel: false })) return 0;
            const { BrowserWindow } = require('electron');
            const opener = BrowserWindow.getFocusedWindow();
            const size = { width: 520, height: 700 };
            const at = opener?.getBounds();
            const window = new BrowserWindow({
                ...size,
                title,
                ...(at
                    ? {
                          x: Math.round(at.x + (at.width - size.width) / 2),
                          y: Math.round(at.y + Math.max(0, (at.height - size.height) / 2)),
                      }
                    : {}),
                ...WINDOW.optionsFor(styles.get(view)()),
                webPreferences: {
                    session: SESSION.of(plugin.id, name),
                    sandbox: true,
                    contextIsolation: true,
                    nodeIntegration: false,
                },
            });
            const page = window.webContents;
            const id = page.id;
            windows.set(id, { window, host: view });
            window.on('closed', () => {
                windows.delete(id);
                PROTOCOL.closed.send(view, { id });
            });
            adopt(view, styles.get(view), page, { inPanel: false });
            WINDOW.dress(window, styles.get(view)());
            page.loadURL(url).catch(() => {});
            return id;
        }

        return { start, host, hostOf, holdsKeyboard, windowOptions };
    }
);
