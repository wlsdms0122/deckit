DeckitModule.define(
    'shell/feature/panel/main',
    {
        uses: ['shell/service/reply', 'shell/feature/panel/protocol'],
        provides: ['start', 'control', 'isActive', 'monitor', 'reveal'],
    },
    (REPLY, PROTOCOL) => {
        // MARK: - Property
        const FRAME = 'panel-frame';
        const HISTORY_LIMIT = 50;
        const views = new Map(); // mod id -> the view its page is in, while the mod has something to show
        const icons = new Map(); // mod id -> the icon its latest run that started said it has
        const floating = new Map(); // webContents id of a mod page with something floating -> its end's off
        const history = { list: [], at: -1 };
        let deckit = null;
        let container = null;
        let host = null;
        let current = null;
        let returning = null; // the mod that was on screen while its page runs again
        // The panel is glass: its colour laid at this strength over what is behind it, blurred through.
        const GLASS = 0.68;
        let shown = false;
        let titled = null; // the title the host was last told
        let look = { floating: false, dismissible: false, titleBar: null };
        let frame = { width: 240, collapsed: false, navHeight: null };

        // MARK: - Initializer
        // MARK: - Public
        // The mods that have something to show, in a container the host app places. `deckit` is what connect
        // answered, `host` the app's answers.
        function start({ deckit: given, host: answers }) {
            deckit = given;
            host = answers;
            frame = { ...frame, ...deckit.state.read(FRAME, {}) };
            const { View } = require('electron');
            container = new View();
            container.setBackgroundColor('#00000000');
            container.setVisible(false);
            deckit.log.guard(container, 'bounds-changed', layout);
            listen();
            registerKeys();
            deckit.mods.onChange(reconcile);
            deckit.mods.observe('didLaunch', ({ mod, summary }) => icons.set(mod.id, summary.icon));
            for (const name of deckit.mods.notifications) deckit.mods.observe(name, reconcile);
            reconcile();
        }

        // Whether a deckit page is the panel's in front; whether the panel is what is in front there is the host's.
        function isActive(page) {
            if (!shown || page !== currentContents()) return false;
            return !!host.showsPanel(page);
        }

        // Escape is the page's while something floats in it, and else puts the panel away where the panel floats over
        // something; in its own window Escape is the window's. The page plays it out.
        function monitor(page, input) {
            if (!isEscape(input)) return false;
            const last = dismisses(page);
            if (!floating.has(page.id) && !last) return false;
            PROTOCOL.escape.send(page, { last });
            return true;
        }

        // A mod on screen, asked by the mod itself, the switcher or an address it opened. One with no view in the
        // panel has nothing to show.
        function reveal(modId) {
            if (select(modId)) host.reveal();
        }

        // MARK: - Private
        // Only a mod's page speaks to the panel.
        function listen() {
            const modOf = deckit.mods.modOf;
            PROTOCOL.setup.handle((_payload, sender) => ({
                glass: GLASS,
                look,
                shown: shown && modOf(sender) === current,
                frame,
                state: stateOf(),
            }));
            PROTOCOL.pick.on(({ id }, sender) => modOf(sender) && select(id));
            PROTOCOL.step.on(({ by }, sender) => modOf(sender) && step(by));
            PROTOCOL.reorder.on(({ ids }, sender) => modOf(sender) && deckit.mods.arrange(ids));
            PROTOCOL.layout.on((change, sender) => modOf(sender) && setFrame(change));
            PROTOCOL.show.on((_payload, sender) => modOf(sender) && reveal(modOf(sender)));
            PROTOCOL.hide.on((_payload, sender) => modOf(sender) && modOf(sender) === current && host.dismiss());
            PROTOCOL.floating.on(({ on }, sender) => modOf(sender) && setFloating(sender, on));
        }

        function setFloating(page, on) {
            if (on === floating.has(page.id)) return;
            if (!on) {
                floating.get(page.id)();
                floating.delete(page.id);
                return;
            }
            const id = page.id;
            floating.set(
                id,
                deckit.pages.whenEnds(page, () => floating.delete(id))
            );
        }

        function isEscape(input) {
            return input.code === 'Escape' && !input.meta && !input.control && !input.alt && !input.shift;
        }

        // Escape puts the panel away only where it floats over something.
        function dismisses(page) {
            return isActive(page) && look.dismissible;
        }

        function registerKeys() {
            deckit.keymap.register({
                action: 'toggleSidebar',
                key: 'mod+\\',
                label: 'Toggle sidebar',
                run: () => setFrame({ collapsed: !frame.collapsed }),
            });
            deckit.keymap.register({
                action: 'back',
                key: 'ctrl+mod+[',
                label: 'Back to the previous mod',
                run: () => step(-1),
            });
            deckit.keymap.register({
                action: 'forward',
                key: 'ctrl+mod+]',
                label: 'Forward to the next mod',
                run: () => step(1),
            });
        }

        // The pages of the mods that said they have something to show, as the mods run. A page shown stays while
        // its mod terminates, and while it launches again in that page. The mod on screen whose page is replaced
        // comes back on screen once the new page says it has something to show; until then, and when it has nothing,
        // the panel lands as it does at the start.
        function reconcile() {
            const showing = new Map(
                deckit.mods
                    .runs()
                    .filter(({ run, view }) =>
                        run.state === 'running' ? run.summary.view : views.get(run.mod.id) === view && inTransition(run)
                    )
                    .map(({ run, view }) => [run.mod.id, view])
            );
            for (const [id, view] of views) {
                if (showing.get(id) === view) continue;
                container.removeChildView(view);
                views.delete(id);
                if (current !== id) continue;
                current = null;
                returning = id;
            }
            for (const [id, view] of showing) {
                if (views.has(id)) continue;
                views.set(id, view);
                view.setVisible(false);
                container.addChildView(view);
            }
            layout();
            if (returning && !mayShow(returning)) returning = null;
            if (returning && views.has(returning)) {
                select(returning, { fromHistory: true });
                returning = null;
            }
            if (!current && !returning) select(firstShown());
            broadcast();
        }

        // Not known to have nothing to show.
        function mayShow(id) {
            const run = deckit.mods.runOf(id);
            if (!run) return false;
            return run.state === 'running' ? run.summary.view : inTransition(run);
        }

        // Launching, terminating, or ended to launch again.
        function inTransition(run) {
            return run.state !== 'notRunning' || run.relaunches;
        }

        // In the person's order: the first mod that has something to show, or may have once it has started. One
        // still starting is waited for, so the panel lands where the order says and not on whoever started first.
        function firstShown() {
            return deckit.mods.list().find(({ id }) => mayShow(id))?.id;
        }

        function layout() {
            const { width, height } = container.getBounds();
            for (const view of views.values()) view.setBounds({ x: 0, y: 0, width, height });
        }

        function stateOf() {
            const mods = deckit.mods
                .list()
                .filter(({ id }) => views.has(id))
                .map(({ id, name }) => ({ id, name, icon: icons.get(id) || '' }));
            return {
                mods,
                current,
                canBack: history.at > 0,
                canForward: history.at < history.list.length - 1,
                frame,
            };
        }

        function broadcast() {
            const state = stateOf();
            for (const view of views.values()) PROTOCOL.state.send(view.webContents, state);
            const mod = deckit.mods.list().find(({ id }) => id === current);
            const title = mod?.name || deckit.config.name;
            if (title !== titled) host.panelTitled((titled = title));
        }

        function setFrame(change) {
            frame = {
                ...frame,
                ...Object.fromEntries(
                    Object.entries(change).filter(([, value]) => value !== undefined && value !== null)
                ),
            };
            deckit.state.write(FRAME, frame);
            broadcast();
        }

        // Which mod is on screen. No fade: here it is a swap of views, on the most repeated action in the panel.
        // Answers whether it is on screen now.
        function select(id, { fromHistory = false } = {}) {
            const next = views.get(id);
            if (!next) return false;
            // Another mod put on screen meanwhile is where the panel stays.
            if (id !== returning) returning = null;
            if (current === id) return true;
            if (!fromHistory) {
                history.list.splice(history.at + 1, Infinity, id);
                if (history.list.length > HISTORY_LIMIT) history.list.shift();
                history.at = history.list.length - 1;
            }
            const before = views.get(current);
            current = id;
            next.setVisible(true);
            if (before) {
                before.setVisible(false);
                if (shown) PROTOCOL.visible.send(before.webContents, { open: false, animate: false });
            }
            if (shown) {
                PROTOCOL.visible.send(next.webContents, { open: true, animate: false });
                focus();
            }
            broadcast();
            return true;
        }

        // A mod no longer there, or with nothing to show, is passed over.
        function step(by) {
            let at = history.at + by;
            while (at >= 0 && at < history.list.length && !hasView(history.list[at])) at += by;
            if (at < 0 || at >= history.list.length) return;
            if (!select(history.list[at], { fromHistory: true })) return;
            history.at = at;
            broadcast();
        }

        // A mod that is there and has something to show.
        function hasView(id) {
            return views.has(id);
        }

        // Whether a keystroke or a request in this webContents is the panel's: one of its pages, or a web page in one.
        function contains(webContents) {
            const page = deckit.web.pageFor(webContents);
            return [...views.values()].some((view) => view.webContents === page);
        }

        function currentContents() {
            return views.get(current)?.webContents || null;
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
        // keystrokes, so the host gives it back. Hidden only after the view has played its exit.
        function hide() {
            return new Promise((resolve) => {
                if (!shown) return resolve(false);
                REPLY.cancel(PROTOCOL.played);
                const contents = currentContents();
                const token = REPLY.awaitReply(contents, PROTOCOL.hidden, () => {
                    if (shown) return resolve(false);
                    const held = !!contents && deckit.web.holdsKeyboard(contents);
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
                const token = REPLY.awaitReply(contents, PROTOCOL.played, () => resolve(true), {
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

        // `titleBar`, filling a window that draws its title bar over the panel's top: { height, controlsWidth }, the
        // bar's height and the width the window's buttons take at its start.
        function present(next) {
            look = { floating: !!next?.floating, dismissible: !!next?.dismissible, titleBar: next?.titleBar || null };
            for (const view of views.values()) PROTOCOL.look.send(view.webContents, look);
        }

        return {
            start,
            // What the host drives of it.
            control: {
                glass: GLASS,
                view: () => container,
                contains,
                show,
                hide,
                leave,
                arrive,
                focus,
                present,
                shown: () => shown,
            },
            isActive,
            monitor,
            reveal,
        };
    }
);
