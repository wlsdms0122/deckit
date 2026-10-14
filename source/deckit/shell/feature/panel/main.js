DeckitModule.define(
    'shell/feature/panel/main',
    {
        uses: ['shell/service/reply', 'shell/feature/panel/protocol'],
        provides: ['start', 'control', 'isActive', 'monitor', 'bringToFront'],
    },
    (REPLY, PROTOCOL) => {
        // MARK: - Property
        const FRAME = 'panel-frame';
        const LISTED = 'panel-listed';
        const HISTORY_LIMIT = 50;
        const views = new Map(); // mod id -> the view its page is in, while the mod has something to show
        const icons = new Map(); // mod id -> the icon its latest run that started said it has
        const floating = new Map(); // webContents id of a mod page with something floating -> its end's off
        // `${webContents id}:${number}` -> { parent, rect, child }: a place in a mod's page that shows a child's view
        const regions = new Map();
        const told = { onScreen: new Set(), looks: new WeakMap(), children: new WeakMap() }; // what pages last heard
        let laidOver = new Set(); // the children laid over their regions now
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
        let chosen = new Set(); // the children the person put in the panel's list

        // MARK: - Initializer
        // MARK: - Public
        // The mods that have something to show, in a container the host app places. A mod whose view names a parent is
        // that one's child: its view is shown where a region of the parent's shows it, and in the panel only once the
        // person lists it there. `deckit` is what connect answered, `host` the app's answers.
        function start({ deckit: given, host: answers }) {
            deckit = given;
            host = answers;
            frame = { ...frame, ...deckit.state.read(FRAME, {}) };
            chosen = new Set(deckit.state.read(LISTED, []));
            const { View } = require('electron');
            container = new View();
            container.setBackgroundColor('#00000000');
            container.setVisible(false);
            deckit.log.guard(container, 'bounds-changed', update);
            listen();
            registerKeys();
            deckit.mods.onChange(reconcile);
            deckit.mods.observe('didLaunch', ({ mod, summary }) => icons.set(mod.id, summary.icon));
            for (const name of deckit.mods.notifications) deckit.mods.observe(name, reconcile);
            reconcile();
        }

        // Whether a deckit page is the panel's in front; whether the panel is what is in front there is the host's.
        function isActive(page) {
            if (!shown || !onScreen().includes(page)) return false;
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
        // panel has nothing to show. A child not in the list brings its parent, whose regions show what they show.
        function bringToFront(modId) {
            const parent = parentOf(modId);
            if (select(parent && !listed(modId) ? parent : modId)) host.show();
        }

        // MARK: - Private
        // Only a mod's page speaks to the panel.
        function listen() {
            const modOf = deckit.mods.modOf;
            PROTOCOL.setup.handle((_payload, sender) => ({
                glass: GLASS,
                look: lookOf(sender),
                shown: told.onScreen.has(sender),
                frame,
                state: stateOf(),
            }));
            PROTOCOL.pick.on(({ id }, sender) => modOf(sender) && select(id));
            PROTOCOL.step.on(({ by }, sender) => modOf(sender) && step(by));
            PROTOCOL.reorder.on(({ ids }, sender) => modOf(sender) && deckit.mods.arrange(ids));
            PROTOCOL.layout.on((change, sender) => modOf(sender) && setFrame(change));
            PROTOCOL.show.on((_payload, sender) => modOf(sender) && bringToFront(modOf(sender)));
            PROTOCOL.hide.on((_payload, sender) => modOf(sender) && onScreen().includes(sender) && host.dismiss());
            PROTOCOL.floating.on(({ on }, sender) => modOf(sender) && setFloating(sender, on));
            PROTOCOL.children.handle((_payload, sender) => (modOf(sender) ? childrenOf(modOf(sender)) : []));
            PROTOCOL.regionPlace.on(
                ({ region, ...rect }, sender) => modOf(sender) && placeRegion(sender, region, rect)
            );
            PROTOCOL.regionShow.handle(({ region, id }, sender) => showInRegion(sender, region, id ?? null));
            PROTOCOL.listed.handle((_payload, sender) => deckit.mods.managerOf(sender) && [...chosen]);
            PROTOCOL.setListed.handle(
                ({ id, listed: on }, sender) => deckit.mods.managerOf(sender) && setListed(id, on)
            );
        }

        // A child taken out of the list while on screen leaves it for its parent.
        function setListed(id, on) {
            if (on === chosen.has(id)) return;
            if (on) chosen.add(id);
            else chosen.delete(id);
            deckit.state.write(LISTED, [...chosen]);
            if (!on && current === id) {
                current = null;
                select(parentOf(id)) || select(firstShown());
            }
            broadcast();
        }

        // A region is its page's: it ends as the page does, run by run.
        function placeRegion(page, number, rect) {
            const key = page.id + ':' + number;
            if (!regions.has(key)) {
                regions.set(key, { parent: deckit.mods.modOf(page), rect: null, child: null });
                deckit.pages.whenEnds(page, () => {
                    regions.delete(key);
                    update();
                });
            }
            regions.get(key).rect = rect;
            update();
        }

        // A child is in one region at a time: shown in another, it leaves the one it was in.
        function showInRegion(page, number, id) {
            const parent = deckit.mods.modOf(page);
            if (!parent) throw new Error('only a mod has regions');
            if (id !== null && parentOf(id) !== parent) throw new Error(`${id} is not a child of ${parent}`);
            const key = page.id + ':' + number;
            if (!regions.has(key)) placeRegion(page, number, { x: 0, y: 0, width: 0, height: 0 });
            for (const region of regions.values()) if (id !== null && region.child === id) region.child = null;
            regions.get(key).child = id;
            update();
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
            update();
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
            return deckit.mods.list().find(({ id }) => mayShow(id) && listed(id))?.id;
        }

        // The mod whose regions its view is shown in, as its run said, or null.
        function parentOf(id) {
            return deckit.mods.runOf(id)?.summary?.parent || null;
        }

        // In the panel's list: a mod that is no child, or a child the person listed.
        function listed(id) {
            return !parentOf(id) || chosen.has(id);
        }

        function childrenOf(parent) {
            return deckit.mods
                .list()
                .filter(({ id }) => views.has(id) && parentOf(id) === parent)
                .map(({ id, name }) => ({ id, name, icon: icons.get(id) || '' }));
        }

        // The pages on screen while the panel is: the mod on screen, then the children its regions show.
        function onScreen() {
            const pages = [];
            if (!views.has(current)) return pages;
            pages.push(views.get(current).webContents);
            for (const id of shownChildren().keys()) pages.push(views.get(id).webContents);
            return pages;
        }

        // child id -> its rect: the children the mod on screen shows in its regions, laid out.
        function shownChildren() {
            const shown = new Map();
            for (const { parent, rect, child } of regions.values()) {
                if (parent !== current || !child || child === current || !views.has(child)) continue;
                if (rect && rect.width > 0 && rect.height > 0) shown.set(child, rect);
            }
            return shown;
        }

        // Every view where it goes: the mod on screen fills the container, the children it shows are laid over their
        // regions, above it, and the rest are hidden. Each page hears whether it is on screen and how it is framed.
        function update() {
            const { width, height } = container.getBounds();
            const children = shownChildren();
            for (const [id, view] of views) {
                if (id === current) {
                    view.setBounds({ x: 0, y: 0, width, height });
                    view.setVisible(true);
                    continue;
                }
                const rect = children.get(id);
                if (!rect) {
                    view.setVisible(false);
                    continue;
                }
                // Added again, a view is lifted over the rest.
                if (!laidOver.has(id)) container.addChildView(view);
                view.setBounds(clip(rect, width, height));
                view.setVisible(true);
            }
            laidOver = new Set(children.keys());
            const now = new Set(shown ? onScreen() : []);
            for (const page of told.onScreen)
                if (!now.has(page)) PROTOCOL.visible.send(page, { open: false, animate: false });
            for (const page of now)
                if (!told.onScreen.has(page)) PROTOCOL.visible.send(page, { open: true, animate: false });
            told.onScreen = now;
            for (const view of views.values()) {
                const next = lookOf(view.webContents);
                const written = JSON.stringify(next);
                if (told.looks.get(view.webContents) === written) continue;
                told.looks.set(view.webContents, written);
                PROTOCOL.look.send(view.webContents, next);
            }
        }

        function clip({ x, y, width, height }, outerWidth, outerHeight) {
            const left = Math.max(0, Math.round(x));
            const top = Math.max(0, Math.round(y));
            return {
                x: left,
                y: top,
                width: Math.max(0, Math.min(outerWidth, Math.round(x + width)) - left),
                height: Math.max(0, Math.min(outerHeight, Math.round(y + height)) - top),
            };
        }

        // How a page is framed where it is. In a region its frame is the region's: what of the window's title bar
        // lies over it, and Escape as the mod on screen has it.
        function lookOf(page) {
            const id = deckit.mods.modOf(page);
            if (!id || id === current || !parentOf(id)) return { ...look, region: false };
            const rect = [...regions.values()].find(({ child }) => child === id)?.rect;
            const bar = look.titleBar;
            const over = bar && rect ? Math.max(0, bar.height - rect.y) : 0;
            return {
                floating: false,
                dismissible: look.dismissible,
                titleBar: over ? { height: over, controlsWidth: Math.max(0, bar.controlsWidth - rect.x) } : null,
                region: true,
            };
        }

        function stateOf() {
            const mods = deckit.mods
                .list()
                .filter(({ id }) => views.has(id) && listed(id))
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
            for (const [id, view] of views) {
                const children = childrenOf(id);
                const written = JSON.stringify(children);
                if ((told.children.get(view.webContents) ?? '[]') === written) continue;
                told.children.set(view.webContents, written);
                PROTOCOL.childrenChanged.send(view.webContents, { children });
            }
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
            if (!views.has(id) || !listed(id)) return false;
            // Another mod put on screen meanwhile is where the panel stays.
            if (id !== returning) returning = null;
            if (current === id) return true;
            if (!fromHistory) {
                history.list.splice(history.at + 1, Infinity, id);
                if (history.list.length > HISTORY_LIMIT) history.list.shift();
                history.at = history.list.length - 1;
            }
            current = id;
            update();
            if (shown) focus();
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

        // A mod that is there, has something to show, and is in the panel's list.
        function hasView(id) {
            return views.has(id) && listed(id);
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
        // The children on screen play it with the mod on screen; main waits on that mod's alone.
        function setShown(on, token) {
            shown = on;
            const pages = onScreen();
            for (const page of pages)
                PROTOCOL.visible.send(page, {
                    open: on,
                    token: page === currentContents() ? (token ?? null) : null,
                    animate: true,
                });
            told.onScreen = new Set(on ? pages : []);
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
                for (const page of onScreen())
                    PROTOCOL.play.send(page, { direction: 'out', token: page === contents ? token : null });
            });
        }

        function arrive() {
            show();
            for (const page of onScreen()) PROTOCOL.play.send(page, { direction: 'in' });
        }

        // `titleBar`, filling a window that draws its title bar over the panel's top: { height, controlsWidth }, the
        // bar's height and the width the window's buttons take at its start.
        function present(next) {
            look = { floating: !!next?.floating, dismissible: !!next?.dismissible, titleBar: next?.titleBar || null };
            update();
        }

        return {
            start,
            // What the host drives of it.
            control: {
                glass: GLASS,
                view: () => container,
                // Into one of the host app's windows, as deckit places a view (`bounds`, `onClose`).
                place: (window, options) => deckit.window.place(container, window, options),
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
            bringToFront,
        };
    }
);
