import * as PROTOCOL from './protocol.js';

// `deckit` is what connect answered, `host` the app's answers.
export function createPanel({ REGION, deckit, host }) {
    // MARK: - Property
    const FRAME = 'panel-frame';
    const PINNED = 'panel-pinned';
    const HISTORY_LIMIT = 50;
    const views = new Map(); // mod id -> the view its page is in, while the mod has something to show
    const floating = new Map(); // webContents id of a mod page with something floating -> its end's off
    const sent = { onScreen: new Set(), looks: new WeakMap() }; // what the pages were last told
    let raised = new Set(); // the children laid over their regions, lifted over the mod on screen
    const history = { list: [], at: -1 };
    let container = null;
    let current = null;
    let returning = null; // the mod that was on screen while its page runs again
    let inList = new Set(); // the mods in the list as it was last sent
    // The panel is glass: its colour laid at this strength over what is behind it, blurred through.
    const GLASS = 0.68;
    // How long main waits on a page's exit before it goes on: it guards a page that is gone or stuck.
    const EXIT_LIMIT_MS = 400;
    let shown = false;
    let moves = 0; // counts the hides and moves, so a newer one takes the place of one still waiting
    let titled = null; // the title the host was last told
    let look = { floating: false, dismissible: false, titleBar: null };
    let frame = { width: 240, collapsed: false, navHeight: null };
    let pinned = new Set(); // the children the person pinned to the panel's list

    // MARK: - Initializer
    // MARK: - Public
    // The mods that have something to show, in a container the host app places. A mod whose view names a parent is
    // that one's child: its view is shown where a region of the parent's shows it, and in the panel only once the
    // person pins it to the list.
    function start() {
        frame = { ...frame, ...deckit.state.read(FRAME, {}) };
        pinned = new Set(deckit.state.read(PINNED, []));
        const { View } = require('electron');
        container = new View();
        container.setBackgroundColor('#00000000');
        container.setVisible(false);
        deckit.log.guard(container, 'bounds-changed', update);
        listen();
        registerKeys();
        deckit.mods.onChange(reconcile);
        // Who is whose child changes with the runs, which reconcile hears too: a region's change is only layout.
        REGION.onChange(update);
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
        if (select(frontOf(modId))) host.show();
    }

    // Whether bringToFront has a mod to put on screen for it.
    function canBringToFront(modId) {
        return shownInList(frontOf(modId));
    }

    // MARK: - Private
    // Only a mod's page speaks to the panel.
    function listen() {
        const modOf = deckit.mods.modOf;
        PROTOCOL.setup.handle((_payload, sender) => ({
            glass: GLASS,
            look: lookOf(sender),
            shown: sent.onScreen.has(sender),
            frame,
            state: stateOf(),
        }));
        // The panel's frame is drawn in each mod's page, so what it tells is taken only while a person presses there:
        // otherwise a mod's own code could change the mod on screen or how the person arranged the panel. Its rows and
        // Back and Forward are buttons, pressed with a key as well; a drag is the mouse's alone, so a key typed in a
        // field does not let the mod's code reorder the mods or size the panel.
        const pressed = (sender) => !!modOf(sender) && deckit.pages.isPressing(sender);
        const pointed = (sender) => !!modOf(sender) && deckit.pages.isPointing(sender);
        PROTOCOL.pick.on(({ id }, sender) => pressed(sender) && select(id));
        PROTOCOL.step.on(({ by }, sender) => pressed(sender) && step(by));
        // A reorder not taken puts the list the page drew back as it is.
        PROTOCOL.reorder.on(({ ids }, sender) => (pointed(sender) ? deckit.mods.arrange(ids) : broadcast()));
        PROTOCOL.layout.on((change, sender) => pointed(sender) && setFrame(change));
        PROTOCOL.show.on((_payload, sender) => modOf(sender) && bringToFront(modOf(sender)));
        PROTOCOL.dismiss.on((_payload, sender) => pressed(sender) && onScreen().includes(sender) && host.dismiss());
        PROTOCOL.floating.on(({ on }, sender) => modOf(sender) && setFloating(sender, on));
        PROTOCOL.pinned.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return [...pinned];
        });
        PROTOCOL.setPinned.handle(({ id, pinned: on }, sender) => {
            deckit.mods.managerFrom(sender);
            setPinned(id, on);
        });
    }

    // A child unpinned while on screen leaves the panel for its parent.
    function setPinned(id, on) {
        if (on === pinned.has(id)) return;
        if (on) pinned.add(id);
        else pinned.delete(id);
        deckit.state.write(PINNED, [...pinned]);
        if (!on && current === id) {
            current = null;
            if (!select(REGION.parentOf(id)) && !select(firstShown())) update();
        }
        broadcast();
    }

    // The mod put on screen for one: itself, or the parent of a child not in the list.
    function frontOf(id) {
        const parent = REGION.parentOf(id);
        return parent && !listed(id) ? parent : id;
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
            view.setBackgroundColor('#00000000');
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

    // In the person's order: the first mod that has something to show, or may have once it has started, of those
    // in the list. One still starting is waited for, so the panel lands where the order says and not on whoever
    // started first.
    function firstShown() {
        return deckit.mods.list().find(({ id }) => mayShow(id) && listed(id))?.id;
    }

    // In the panel's list: a mod that is no child, or a child the person pinned.
    function listed(id) {
        return !REGION.parentOf(id) || pinned.has(id);
    }

    // The pages on screen while the panel is: the mod on screen, then the children its regions show.
    function onScreen() {
        if (!views.has(current)) return [];
        return [current, ...childrenOnScreen().keys()].map((id) => views.get(id).webContents);
    }

    // child id -> its rect: the children the mod on screen shows in its regions, laid out.
    function childrenOnScreen() {
        return REGION.laidOut(current, (id) => id !== current && views.has(id));
    }

    // Every view where it goes, then every page told whether it is on screen and how it is framed. A page that
    // leaves the screen holding the keyboard would go on taking keystrokes unseen: the mod on screen takes it.
    function update() {
        const holder = [...sent.onScreen].find((page) => !page.isDestroyed() && deckit.web.holdsKeyboard(page));
        layout();
        tellPages();
        if (holder && !sent.onScreen.has(holder)) focus();
    }

    // The mod on screen fills the container, the children it shows are laid over their regions, above it, and
    // the rest are hidden.
    function layout() {
        const { width, height } = container.getBounds();
        const children = childrenOnScreen();
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
            if (!raised.has(id)) container.addChildView(view);
            view.setBounds(clip(rect, width, height));
            view.setVisible(true);
        }
        raised = new Set(children.keys());
    }

    function tellPages() {
        const now = new Set(shown ? onScreen() : []);
        for (const page of sent.onScreen)
            if (!now.has(page)) PROTOCOL.visible.send(page, { open: false, animate: false });
        for (const page of now)
            if (!sent.onScreen.has(page)) PROTOCOL.visible.send(page, { open: true, animate: false });
        sent.onScreen = now;
        for (const view of views.values()) {
            const next = lookOf(view.webContents);
            const written = JSON.stringify(next);
            if (sent.looks.get(view.webContents) === written) continue;
            sent.looks.set(view.webContents, written);
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
    // lies over it as it is laid, and Escape as the mod on screen has it.
    function lookOf(page) {
        const id = deckit.mods.modOf(page);
        if (!id || id === current || !REGION.parentOf(id)) return { ...look, region: false };
        const { width, height } = container.getBounds();
        const rect = REGION.rectOf(id);
        const laid = rect && clip(rect, width, height);
        const bar = look.titleBar;
        const over = bar && laid ? Math.max(0, bar.height - laid.y) : 0;
        return {
            floating: false,
            dismissible: look.dismissible,
            titleBar: over ? { height: over, controlsWidth: Math.max(0, bar.controlsWidth - laid.x) } : null,
            region: true,
        };
    }

    // A mod listed stays listed while it launches again, in this page or a new one (a replace), until its new run
    // says whether it has something to show.
    function stateOf() {
        const mods = deckit.mods
            .list()
            .filter(({ id }) => shownInList(id) || (inList.has(id) && listed(id) && mayShow(id)))
            .map(({ id, name }) => ({ id, name, icon: deckit.mods.listingOf(id)?.icon || '' }));
        inList = new Set(mods.map(({ id }) => id));
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
            ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined && value !== null)),
        };
        deckit.state.write(FRAME, frame);
        broadcast();
    }

    // Which mod is on screen. No fade: here it is a swap of views, on the most repeated action in the panel.
    // Answers whether it is on screen now.
    function select(id, { fromHistory = false } = {}) {
        if (!shownInList(id)) return false;
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
        while (at >= 0 && at < history.list.length && !shownInList(history.list[at])) at += by;
        if (at < 0 || at >= history.list.length) return;
        if (!select(history.list[at], { fromHistory: true })) return;
        history.at = at;
        broadcast();
    }

    // A mod that is there, has something to show, and is in the panel's list.
    function shownInList(id) {
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
    // `waited`: a page main waits on to play its exit, told by its own channel.
    function setShown(on, waited = null) {
        shown = on;
        const pages = onScreen();
        for (const page of pages) if (page !== waited) PROTOCOL.visible.send(page, { open: on, animate: true });
        sent.onScreen = new Set(on ? pages : []);
    }

    // Showing over an app does not move focus off the app's document, so the app's keys would still answer
    // under the panel. Only on the way in: a later click into the app is the person's.
    function show() {
        container.setVisible(true);
        if (shown) return;
        setShown(true);
        focus();
    }

    // Resolves whether the panel had the keyboard as it went, in any of its pages on screen: a hidden view keeps
    // its focus and goes on taking keystrokes, so the host gives it back. Hidden only after the view has played
    // its exit.
    // A newer hide or move takes the place of one waiting on its exit, which then resolves false.
    async function hide() {
        if (!shown) return false;
        const mine = ++moves;
        const contents = currentContents();
        const pages = onScreen();
        setShown(false, contents);
        if (contents) await exitOf(PROTOCOL.exit, contents);
        if (mine !== moves || shown) return false;
        const held = pages.some((page) => !page.isDestroyed() && deckit.web.holdsKeyboard(page));
        container.setVisible(false);
        return held;
    }

    // Main waits on a page's exit only so long: a page that is gone or stuck plays none.
    function exitOf(channel, contents) {
        return channel.invoke(contents, {}, { timeout: EXIT_LIMIT_MS }).catch(() => {});
    }

    function focus() {
        currentContents()?.focus();
    }

    // A move keeps the panel up the whole way, its exit played as it leaves and its entrance as it arrives.
    // Resolves false when it was put away on the way, or a newer move replaced it.
    async function leave() {
        const contents = currentContents();
        if (!shown || !contents) return true;
        const mine = ++moves;
        for (const page of onScreen()) if (page !== contents) PROTOCOL.play.send(page, { direction: 'out' });
        await exitOf(PROTOCOL.leave, contents);
        return mine === moves;
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
        canBringToFront,
    };
}
