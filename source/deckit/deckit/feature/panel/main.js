DeckitModule.define(
    'deckit/feature/panel/main',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/plugin/identity',
            'deckit/service/plugin/host',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/open/main',
            'deckit/feature/panel/protocol',
        ],
        provides: ['start', 'deck', 'viewFor', 'reveal', 'awaitReply'],
    },
    (CONFIG, STORAGE, LOG, WINDOW, IDENTITY, HOST, WEB, KEYMAP, OPEN, PROTOCOL) => {
        // MARK: - Property
        const FRAME = 'panel-frame';
        const HISTORY_LIMIT = 50;
        // Main waits on a view only for an exit before it moves and a fade before it goes off screen; this guards a
        // view that is gone or stuck.
        const REPLY_TIMEOUT = 400;
        const views = new Map(); // plugin id -> { view, entry, screen: { content, icon } | null }
        const waiting = new Map(); // reply -> the wait in progress for it
        const heard = new Set(); // replies listened to
        const history = { list: [], at: -1 };
        let container = null;
        let makeView = null;
        let shell = null;
        let current = null;
        let shown = false;
        let theme = null;
        let look = { floating: false, dismissible: false };
        let frame = { width: 240, collapsed: false, navHeight: null };
        let replies = 0;

        // MARK: - Initializer
        // MARK: - Public
        // `makeView(origin, options)` makes a view of deckit's pages; `shell` is the app's.
        function start({ makeView: make, shell: answers }) {
            makeView = make;
            shell = answers;
            frame = { ...frame, ...STORAGE.state.read(FRAME, {}) };
            const { View } = require('electron');
            container = new View();
            container.setBackgroundColor('#00000000');
            container.setVisible(false);
            LOG.guard(container, 'bounds-changed', layout);
            listen();
            registerKeys();
            KEYMAP.connect({ viewOf: viewFor, showsPanel, dismisses });
            HOST.onChange(reconcile);
            reconcile(HOST.plugins());
            const { app } = require('electron');
            // On activation Electron gives the keyboard to the window's own document, not the panel inside it, so it
            // is handed back a tick after, where the panel is what is on screen.
            LOG.guard(app, 'browser-window-focus', (_event, window) => {
                const view = views.get(current)?.view;
                if (!view || !shown || !showsPanel(view.webContents)) return;
                setImmediate(() => !window.isDestroyed() && window.isFocused() && focus());
            });
        }

        // The deckit view a keystroke or a request in this webContents belongs to: a plugin's, also for a web page
        // shown in it.
        function viewFor(webContents) {
            if (IDENTITY.pluginOf(webContents) || IDENTITY.isSwitcher(webContents)) return webContents;
            return WEB.hostOf(webContents);
        }

        // A plugin on screen, asked by the plugin itself, the switcher or an address it opened.
        function reveal(pluginId) {
            select(pluginId);
            shell.reveal();
        }

        // Waits for a view's reply that carries this wait's token; a newer wait on the same reply runs `superseded`.
        function awaitReply(webContents, reply, next, { superseded = null } = {}) {
            waiting.get(reply)?.drop();
            if (!webContents || webContents.isDestroyed()) {
                next();
                return null;
            }
            if (!heard.has(reply)) {
                heard.add(reply);
                reply.on(({ token }, sender) => waiting.get(reply)?.answer(sender, token));
            }
            const token = ++replies;
            let done = false;
            const finish = (run) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (waiting.get(reply) === wait) waiting.delete(reply);
                run?.();
            };
            const timer = setTimeout(() => finish(next), REPLY_TIMEOUT);
            const wait = {
                drop: () => finish(superseded),
                answer: (sender, answered) => sender === webContents && answered === token && finish(next),
            };
            waiting.set(reply, wait);
            return token;
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.setup.handle((_payload, sender) => ({
                role: IDENTITY.isSwitcher(sender) ? 'switcher' : 'plugin',
                theme,
                look,
                shown: shown && IDENTITY.pluginOf(sender)?.id === current,
                frame,
                state: stateOf(),
            }));
            PROTOCOL.screen.on(({ content, icon }, sender) => {
                const entry = views.get(IDENTITY.pluginFrom(sender).id);
                entry.screen = { content, icon };
                // A plugin with nothing to show gives its place on screen to the next one that has.
                if (!content && current === entry.entry.id) {
                    current = null;
                    entry.view.setVisible(false);
                    select(firstShown());
                }
                broadcast();
            });
            PROTOCOL.pick.on(({ id }, sender) => IDENTITY.pluginFrom(sender) && select(id));
            PROTOCOL.step.on(({ by }, sender) => IDENTITY.pluginFrom(sender) && step(by));
            PROTOCOL.reorder.on(({ ids }, sender) => IDENTITY.pluginFrom(sender) && HOST.arrange(ids));
            PROTOCOL.layout.on((change, sender) => {
                IDENTITY.pluginFrom(sender);
                setFrame(change);
            });
            PROTOCOL.show.on((_payload, sender) => reveal(IDENTITY.pluginFrom(sender).id));
            PROTOCOL.hide.on((_payload, sender) => IDENTITY.pluginFrom(sender).id === current && shell.dismiss());
        }

        function registerKeys() {
            KEYMAP.register({
                action: 'toggleSidebar',
                key: 'mod+\\',
                label: 'Toggle sidebar',
                run: () => setFrame({ collapsed: !frame.collapsed }),
            });
            KEYMAP.register({
                action: 'back',
                key: 'ctrl+mod+[',
                label: 'Back to the previous plugin',
                run: () => step(-1),
            });
            KEYMAP.register({
                action: 'forward',
                key: 'ctrl+mod+]',
                label: 'Forward to the next plugin',
                run: () => step(1),
            });
        }

        // A plugin gets a view as it arrives, loses it as it goes, and one whose folder changed is loaded again.
        function reconcile(plugins) {
            const ids = new Set(plugins.map(({ id }) => id));
            for (const [id, { view }] of views) {
                if (ids.has(id)) continue;
                container.removeChildView(view);
                view.webContents.close();
                views.delete(id);
                if (current === id) current = null;
            }
            for (const entry of plugins) {
                const known = views.get(entry.id);
                if (known && sameFolder(known.entry, entry)) continue;
                if (known) {
                    container.removeChildView(known.view);
                    known.view.webContents.close();
                }
                create(entry);
                // The plugin on screen stays on screen in its new view.
                if (current === entry.id) {
                    current = null;
                    select(entry.id, { fromHistory: true });
                }
            }
            if (!current) select(firstShown());
            broadcast();
        }

        // In the person's order: the first plugin that is not known to have nothing to show.
        function firstShown() {
            return HOST.plugins().find(({ id }) => views.get(id)?.screen?.content !== false)?.id;
        }

        function sameFolder(before, after) {
            return (
                before.folder === after.folder &&
                before.version === after.version &&
                before.installs === after.installs &&
                JSON.stringify(before.permissions) === JSON.stringify(after.permissions)
            );
        }

        function create(entry) {
            HOST.prepare(entry);
            const view = makeView(IDENTITY.originOf(entry.id), { webview: true });
            const contents = view.webContents;
            IDENTITY.add(contents, { plugin: entry });
            WEB.host(contents, windowStyle);
            KEYMAP.listen(contents);
            // Every scheme: which ones open, and how, is Open With's to say.
            contents.setWindowOpenHandler((details) => {
                OPEN.open(details.url, WEB.windowOptions(details));
                return { action: 'deny' };
            });
            // Identity holds the view to its origin, and a link that leaves it opens through Open With.
            LOG.guard(contents, 'will-frame-navigate', (details) => {
                if (details.isMainFrame && !details.url.startsWith(IDENTITY.originOf(entry.id) + '/'))
                    OPEN.open(details.url, {});
            });
            LOG.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && LOG.error(`${entry.id}: ${message}`)
            );
            container.addChildView(view);
            views.set(entry.id, { view, entry, screen: null });
            layout();
            contents.loadURL(IDENTITY.originOf(entry.id) + '/');
        }

        function layout() {
            const { width, height } = container.getBounds();
            for (const { view } of views.values()) view.setBounds({ x: 0, y: 0, width, height });
        }

        function stateOf() {
            const plugins = HOST.plugins()
                .filter(({ id }) => views.get(id)?.screen?.content !== false)
                .map(({ id, name }) => ({ id, name, icon: views.get(id)?.screen?.icon || '' }));
            return {
                plugins,
                current,
                canBack: history.at > 0,
                canForward: history.at < history.list.length - 1,
                frame,
            };
        }

        function broadcast() {
            const state = stateOf();
            for (const { view } of views.values()) PROTOCOL.state.send(view.webContents, state);
            const name = HOST.plugins().find(({ id }) => id === current);
            const window = container && WINDOW.windowOf(container);
            if (window) WINDOW.titlebarOf(window)?.name(name?.name || CONFIG.name);
        }

        function setFrame(change) {
            frame = {
                ...frame,
                ...Object.fromEntries(
                    Object.entries(change).filter(([, value]) => value !== undefined && value !== null)
                ),
            };
            STORAGE.state.write(FRAME, frame);
            broadcast();
        }

        // Which plugin is on screen. No fade: here it is a swap of views, on the most repeated action in the panel.
        // Answers whether it is on screen now.
        function select(id, { fromHistory = false } = {}) {
            const next = views.get(id);
            if (!next || next.screen?.content === false) return false;
            if (current === id) return true;
            if (!fromHistory) {
                history.list.splice(history.at + 1, Infinity, id);
                if (history.list.length > HISTORY_LIMIT) history.list.shift();
                history.at = history.list.length - 1;
            }
            const before = views.get(current);
            current = id;
            next.view.setVisible(true);
            if (before) {
                before.view.setVisible(false);
                if (shown) PROTOCOL.visible.send(before.view.webContents, { open: false, animate: false });
            }
            if (shown) {
                PROTOCOL.visible.send(next.view.webContents, { open: true, animate: false });
                focus();
            }
            broadcast();
            return true;
        }

        // A plugin no longer there, or with nothing to show, is passed over.
        function step(by) {
            let at = history.at + by;
            while (at >= 0 && at < history.list.length && !isShown(history.list[at])) at += by;
            if (at < 0 || at >= history.list.length) return;
            if (!select(history.list[at], { fromHistory: true })) return;
            history.at = at;
            broadcast();
        }

        // A plugin that is there and has something to show.
        function isShown(id) {
            return views.has(id) && views.get(id).screen?.content !== false;
        }

        function currentContents() {
            return views.get(current)?.view.webContents || null;
        }

        // A web page a plugin shows counts as its view; whether the view is what is on screen there is the shell's.
        function showsPanel(webContents) {
            const view = viewFor(webContents);
            if (!view || !shown || view !== currentContents()) return false;
            return !!shell.showsPanel(view);
        }

        // Escape puts the panel away only where it floats over something; in a window of its own Escape is the window's.
        function dismisses(webContents) {
            return showsPanel(webContents) && look.dismissible;
        }

        // The view's own idea of whether it is up (didAppear, its keys, its entrance and exit) never parts from this.
        function setShown(on, token) {
            shown = on;
            const contents = currentContents();
            if (contents) PROTOCOL.visible.send(contents, { open: on, token: token ?? null, animate: true });
        }

        // Showing over an app does not move focus off the app's document, so the app's keys would still answer
        // under the panel. Only on the way in: a later click into the app is the person's.
        function show() {
            container.setVisible(true);
            if (shown) return;
            setShown(true);
            focus();
        }

        // Resolves whether the panel had the keyboard as it went: a hidden view keeps its focus and goes on taking
        // keystrokes, so the shell gives it back. Hidden only after the view has played its exit.
        function hide() {
            return new Promise((resolve) => {
                if (!shown) return resolve(false);
                waiting.get(PROTOCOL.played)?.drop();
                const contents = currentContents();
                const token = awaitReply(contents, PROTOCOL.hidden, () => {
                    if (shown) return resolve(false);
                    const held = !!contents && WEB.holdsKeyboard(contents);
                    container.setVisible(false);
                    resolve(held);
                });
                setShown(false, token);
            });
        }

        function focus() {
            currentContents()?.focus();
        }

        // A move keeps the panel up the whole way, its exit played as it leaves and its entrance as it arrives.
        // Resolves false when it was put away on the way, or a newer move replaced it.
        function leave() {
            return new Promise((resolve) => {
                const contents = currentContents();
                if (!shown || !contents) return resolve(true);
                const token = awaitReply(contents, PROTOCOL.played, () => resolve(true), {
                    superseded: () => resolve(false),
                });
                PROTOCOL.play.send(contents, { direction: 'out', token });
            });
        }

        function arrive() {
            show();
            const contents = currentContents();
            if (contents) PROTOCOL.play.send(contents, { direction: 'in' });
        }

        function present(next) {
            look = { floating: !!next?.floating, dismissible: !!next?.dismissible };
            for (const { view } of views.values()) PROTOCOL.look.send(view.webContents, look);
        }

        // A new theme reloads every view, which draws in it from the start.
        function setTheme(next) {
            if (JSON.stringify(next) === JSON.stringify(theme)) return;
            theme = next;
            for (const { view } of views.values()) view.webContents.reload();
        }

        // One answer, so the panel's window bar and the windows its pages open cannot drift apart.
        function windowStyle() {
            if (!theme) return {};
            return {
                background: theme.sidebarBg || theme.contentBg,
                color: theme.sidebarColor,
                font: theme.font,
            };
        }

        // The panel in a deckit window of its own. Three facts hold between the two and both are deckit's: the bar's
        // reach over the panel is told to its views, the window is glass because the panel is, and the panel is out
        // of the window before the window goes. `onClose` runs once it is out.
        async function presentInWindow({ key, title, boundsKey, onClose } = {}) {
            const there = WINDOW.get(key);
            if (there) {
                WINDOW.raise(there);
                return there;
            }
            if (!(await leave())) return null;
            const window = WINDOW.open({
                key,
                title,
                boundsKey,
                view: container,
                glass: true,
                style: windowStyle(),
                onShown: (inset) => {
                    for (const { view } of views.values()) PROTOCOL.bar.send(view.webContents, { inset });
                },
                onClose,
            });
            present({ floating: false, dismissible: false });
            arrive();
            broadcast();
            return window;
        }

        return {
            start,
            deck: {
                view: () => container,
                contains: (webContents) => !!viewFor(webContents) && !IDENTITY.isSwitcher(viewFor(webContents)),
                show,
                hide,
                leave,
                arrive,
                focus,
                present,
                setTheme,
                shown: () => shown,
                presentInWindow,
            },
            viewFor,
            reveal,
            awaitReply,
        };
    }
);
