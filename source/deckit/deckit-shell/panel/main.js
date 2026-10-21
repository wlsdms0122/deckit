import * as CHANNEL from '../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as WIDTH from './model/width.js';
import * as PAGE from './model/page-name.js';
import * as LIST_ORDER from './model/list-order.js';

// `deckit` is what connect answered, `host` the app's answers.
export function createPanel({ REGION, deckit, host }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const SIDEBAR = 'panel-frame';
    const PINNED = 'panel-pinned';
    const ORDER = 'panel-order';
    const HISTORY_LIMIT = 50;
    const pages = new Map(); // mod id -> its page, while the mod has something to show
    const floating = new Map(); // a mod's page with something floating -> its end's off
    const sent = { onScreen: new Set(), guides: new WeakMap(), look: '' }; // what the pages were last told
    // The frame's page, the surfaces it opened by name, and where it said its parts are. `moving` is where its
    // page is laid while the frame moves: what it covers before and after.
    // `animates` is the mod the move was told to.
    const shell = {
        page: null,
        surfaces: new Map(),
        rects: null,
        moving: null,
        settling: null,
        animates: null,
    };
    const NAMED_KEYS = new Set(['back', 'forward']); // the actions of the panel's keys a tooltip names
    const history = { list: [], at: -1 };
    let stage = null; // where the pages are laid, which the host app places
    let current = null;
    let returning = null; // the mod that was on screen while its page runs again
    let inList = new Set(); // the mods in the list as it was last sent
    // The panel is glass: its colour laid at this strength over what is behind it, blurred through.
    const GLASS = 0.68;
    // How long main waits on a page's exit, or its answer to Escape, before it goes on: it guards a page that is
    // gone or stuck.
    const EXIT_LIMIT_MS = 400;
    let shown = false;
    let moves = 0; // counts the hides and moves, so a newer one takes the place of one still waiting
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let look = { floating: false, dismissible: false, titleBar: null };
    let sidebar = { width: WIDTH.MIN, collapsed: false, navHeight: null }; // as the person left it
    let pinned = new Set(); // the children the person pinned to the panel's list
    let order = []; // the ids of the mods, as the person arranged the panel's list

    // MARK: - Initializer
    // MARK: - Public
    // The mods that have something to show, on a stage the host app places, under the panel's frame. A mod
    // whose view names a parent is that one's child: its view is shown where a region of the parent's shows it,
    // and in the panel only once the person pins it to the list.
    function start() {
        sidebar = { ...sidebar, ...deckit.state.read(SIDEBAR, {}) };
        pinned = new Set(deckit.state.read(PINNED, []));
        order = deckit.state.read(ORDER, []);
        stage = deckit.pages.stage();
        stage.whenResized(update);
        listen();
        registerKeys();
        makeFrame();
        deckit.mods.onChange(reconcile);
        // Who is whose child changes with the runs, which reconcile hears too: a region's change is only layout.
        REGION.onChange(update);
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, reconcile);
        reconcile();
        // With the core down nothing on deckit works, so the frame covers the panel and asks for a restart.
        deckit.core.onDown((why) => {
            down = why;
            update();
            broadcast();
            if (shown) focus();
        });
    }

    // Whether a deckit page is the panel's in front, the frame's included; whether the panel is what is in front
    // there is the host's.
    function isActive(page) {
        if (!shown || (page !== frameContents() && !onScreen().includes(page))) return false;
        return !!host.showsPanel(page);
    }

    // Escape is the page's while something floats in it, and else puts the panel away where the panel floats over
    // something; in its own window Escape is the window's. A mod's page plays it out and answers whether it took
    // it.
    function monitor(page, keystroke) {
        if (!isEscape(keystroke)) return false;
        const last = dismisses(page);
        if (page === frameContents()) {
            if (last) host.dismiss();
            return last;
        }
        if (!floating.has(page) && !last) return false;
        PROTOCOL.escape
            .invoke(page, {}, { timeout: EXIT_LIMIT_MS })
            .then((taken) => !taken && last && dismisses(page) && host.dismiss())
            .catch(() => {});
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
    // The list and the frame are drawn in the frame's page alone, so what it tells is the person's: no mod's code
    // runs there. A mod's page tells only what is its own.
    function listen() {
        const modOf = deckit.mods.modOf;
        const fromFrame = (sender) => sender === frameContents();
        PROTOCOL.frameSetup.handle((_payload, sender) => {
            if (!fromFrame(sender))
                throw Object.assign(new Error("only the panel's frame asks this"), { kind: 'REFUSED' });
            deckit.pages.whenEnds(sender, frameEnded);
            sent.look = JSON.stringify(frameLook());
            return { glass: GLASS, look: frameLook(), shown, state: stateOf() };
        });
        PROTOCOL.chord.handle(({ action }, sender) =>
            fromFrame(sender) && NAMED_KEYS.has(action) ? deckit.keymap.chordOf(action) : ''
        );
        PROTOCOL.pick.on(({ id }, sender) => fromFrame(sender) && select(id));
        PROTOCOL.step.on(({ by }, sender) => fromFrame(sender) && step(by));
        PROTOCOL.reorder.on(({ ids }, sender) => fromFrame(sender) && arrange(ids));
        PROTOCOL.layout.on((change, sender) => fromFrame(sender) && setSidebar(change));
        PROTOCOL.rects.on((rects, sender) => fromFrame(sender) && setRects(rects));
        PROTOCOL.setup.handle((_payload, sender) => ({ guide: guideOf(sender), shown: sent.onScreen.has(sender) }));
        PROTOCOL.show.on((_payload, sender) => modOf(sender) && bringToFront(modOf(sender)));
        PROTOCOL.floating.on(({ on }, sender) => modOf(sender) && setFloating(sender, on));
        PROTOCOL.pinned.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return [...pinned];
        });
        PROTOCOL.setPinned.handle(({ id, pinned: on }, sender) => {
            deckit.mods.managerFrom(sender);
            setPinned(id, on);
        });
        PROTOCOL.restart.on((_payload, sender) => fromFrame(sender) && down && deckit.restart());
    }

    // The frame's page is the shell's own, made once, over every mod's view where it draws.
    // It opens its backdrop and its handle, and nothing else. A press there is the person's on the panel, so the
    // keyboard goes back to the mod on screen.
    // It lays the frame out off screen too, since the mods are laid by it, and the panel has no frame without it: a
    // page that crashed is loaded again.
    function makeFrame() {
        const page = deckit.pages.open(PAGE.PAGE_NAME, {
            keepsDrawing: true,
            reloadsOnCrash: true,
            surfaces: { names: Object.values(PAGE.SURFACE), onOpen: openSurface },
        });
        deckit.keymap.listen(page);
        deckit.pages.whenFocused(page, focus);
        shell.page = page;
        layout();
    }

    // A document of the frame's page, laid as a page of its own. It runs no code and goes nowhere.
    function openSurface(name, page) {
        deckit.pages.whenFocused(page, focus);
        shell.surfaces.set(name, page);
        update();
    }

    // A document loaded again in its place finds the surfaces the last one opened, by name, and draws them anew; a
    // page that crashed or went takes them with it, and its next document opens its own.
    function frameEnded({ replaced }) {
        const dropped = replaced ? [] : [...shell.surfaces.values()];
        if (!replaced) shell.surfaces.clear();
        layout();
        for (const page of dropped) deckit.pages.close(page);
        clearTimeout(shell.settling);
        shell.rects = null;
        shell.moving = null;
        update();
    }

    // While the frame moves, its page covers both where it was and where it goes, until it has gone there.
    function setRects(next) {
        const before = shell.rects?.obscured;
        shell.rects = next;
        shell.animates = next.animation ? current : null;
        clearTimeout(shell.settling);
        shell.moving = next.animation && before ? union(before, next.obscured) : null;
        if (shell.moving)
            shell.settling = setTimeout(() => {
                shell.moving = null;
                layout();
            }, next.animation.duration);
        update();
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
        if (on === floating.has(page)) return;
        if (!on) {
            floating.get(page)();
            floating.delete(page);
            layout();
            return;
        }
        floating.set(
            page,
            deckit.pages.whenEnds(page, () => {
                floating.delete(page);
                layout();
            })
        );
        layout();
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
            run: () => setSidebar({ collapsed: !sidebar.collapsed }),
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
                .filter(({ run, page }) =>
                    run.state === 'running' ? run.summary.view : pages.get(run.mod.id) === page && inTransition(run)
                )
                .map(({ run, page }) => [run.mod.id, page])
        );
        for (const [id, page] of pages) {
            if (showing.get(id) === page) continue;
            pages.delete(id);
            if (current !== id) continue;
            current = null;
            returning = id;
        }
        for (const [id, page] of showing) if (!pages.has(id)) pages.set(id, page);
        update();
        if (returning && !mayShow(returning)) returning = null;
        if (returning && pages.has(returning)) {
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

    // In the list's order: the first mod that has something to show, or may have once it has started, of those in
    // the list. One still starting is waited for, so the panel lands where the order says and not on whoever started
    // first.
    function firstShown() {
        return inOrder().find(({ id }) => mayShow(id) && listed(id))?.id;
    }

    // The mods in the list's order: those the person placed, as they placed them, then the rest in the load order.
    function inOrder() {
        const mods = new Map(deckit.mods.list().map((mod) => [mod.id, mod]));
        return LIST_ORDER.sorted([...mods.keys()], order).map((id) => mods.get(id));
    }

    // The ids named take the places they held among themselves, in the order given; the rest stay put.
    function arrange(ids) {
        order = LIST_ORDER.arranged(
            inOrder().map(({ id }) => id),
            ids
        );
        deckit.state.write(ORDER, order);
        broadcast();
    }

    // In the panel's list: a mod that is no child, or a child the person pinned.
    function listed(id) {
        return !REGION.parentOf(id) || pinned.has(id);
    }

    // The mods' pages on screen while the panel is: the mod on screen, then the children its regions show.
    function onScreen() {
        if (!pages.has(current)) return [];
        return [current, ...childrenOnScreen().keys()].map((id) => pages.get(id));
    }

    // child id -> its rect: the children the mod on screen shows in its regions, laid out.
    function childrenOnScreen() {
        return REGION.laidOut(current, (id) => id !== current && pages.has(id));
    }

    // Every view where it goes, then every page told whether it is on screen and where it lays out. A page that
    // leaves the screen holding the keyboard would go on taking keystrokes unseen: the mod on screen takes it.
    function update() {
        const holder = [...sent.onScreen].find((page) => deckit.pages.isAlive(page) && deckit.web.holdsKeyboard(page));
        layout();
        tellPages();
        if (holder && !sent.onScreen.has(holder)) focus();
    }

    // From the bottom: the backdrop over the whole stage, the mod on screen, the children it shows over their
    // regions, then the frame's page and its handle where they draw; the mods' other pages are hidden. A dialog or a
    // menu of the mod on screen comes over the frame and its handle, as it did over the page's own. With deckit's
    // core down the frame alone covers the panel.
    function layout() {
        const { width, height } = stage.size();
        const full = { x: 0, y: 0, width, height };
        if (down) {
            stage.lay([
                ...[...pages.values(), shell.surfaces.get(PAGE.SURFACE.HANDLE)]
                    .filter(Boolean)
                    .map((page) => ({ page, hidden: true })),
                { page: shell.page, rect: full },
            ]);
            return;
        }
        const children = childrenOnScreen();
        const floats = floating.has(currentContents());
        const hidden = [...pages].filter(([id]) => id !== current && !children.has(id));
        const shownCurrent = pages.has(current) ? [{ page: pages.get(current), rect: full }] : [];
        stage.lay(
            [
                at(shell.surfaces.get(PAGE.SURFACE.BACKDROP), full),
                ...hidden.map(([, page]) => ({ page, hidden: true })),
                ...(floats ? [] : shownCurrent),
                ...[...children].map(([id, rect]) => ({ page: pages.get(id), rect: clip(rect, width, height) })),
                at(shell.page, shell.moving || shell.rects?.obscured),
                at(shell.surfaces.get(PAGE.SURFACE.HANDLE), shell.rects?.handle),
                ...(floats ? shownCurrent : []),
            ].filter(Boolean)
        );

        // A page laid where `rect` is, clipped to the stage, or hidden when nothing of it is left.
        function at(page, rect) {
            if (!page) return null;
            const laid = rect && clip(rect, width, height);
            return laid && laid.width > 0 && laid.height > 0 ? { page, rect: laid } : { page, hidden: true };
        }
    }

    function tellPages() {
        const contents = frameContents();
        const written = JSON.stringify(frameLook());
        if (contents && sent.look !== written) {
            sent.look = written;
            PROTOCOL.look.send(contents, frameLook());
        }
        const now = new Set(shown ? onScreen() : []);
        for (const page of sent.onScreen)
            if (!now.has(page)) PROTOCOL.visible.send(page, { open: false, animate: false });
        for (const page of now)
            if (!sent.onScreen.has(page)) PROTOCOL.visible.send(page, { open: true, animate: false });
        sent.onScreen = now;
        for (const page of pages.values()) {
            const next = guideOf(page);
            const written = JSON.stringify(next);
            if (sent.guides.get(page) === written) continue;
            sent.guides.set(page, written);
            PROTOCOL.guide.send(page, next);
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

    // The smallest rect that holds both; an empty one holds nothing.
    function union(one, other) {
        if (!one.width || !one.height) return other;
        if (!other.width || !other.height) return one;
        const x = Math.min(one.x, other.x);
        const y = Math.min(one.y, other.y);
        return {
            x,
            y,
            width: Math.max(one.x + one.width, other.x + other.width) - x,
            height: Math.max(one.y + one.height, other.y + other.height) - y,
        };
    }

    // The part of `rect` inside `outer`, in `outer`'s own place, or null.
    function within(rect, outer) {
        if (!rect) return null;
        const x = Math.max(rect.x, outer.x);
        const y = Math.max(rect.y, outer.y);
        const width = Math.min(rect.x + rect.width, outer.x + outer.width) - x;
        const height = Math.min(rect.y + rect.height, outer.y + outer.height) - y;
        return width > 0 && height > 0 ? { x: x - outer.x, y: y - outer.y, width, height } : null;
    }

    // Where a mod's page lays out what it shows. Every page in the panel lays out by the frame, the hidden ones
    // too, so one comes on screen laid out; only the one on screen moves as the frame does. In a region its
    // rooms are the region's: its sidebar at the start, as wide as the panel's, and what of the frame and the
    // window's title bar lie over it as it is laid.
    function guideOf(page) {
        const id = deckit.mods.modOf(page);
        const { width, height } = stage.size();
        const lends = !!deckit.mods.runOf(id)?.summary?.sidebar;
        if (id && id !== current && REGION.parentOf(id)) {
            const rect = REGION.rectOf(id);
            const laid = rect ? clip(rect, width, height) : { x: 0, y: 0, width: 0, height: 0 };
            const side = lends ? Math.min(laid.width, WIDTH.fitted(sidebar.width, laid.width)) : 0;
            const bar = look.titleBar;
            const over = bar ? Math.max(0, bar.height - laid.y) : 0;
            return {
                floating: false,
                region: true,
                content: { x: side, y: 0, width: laid.width - side, height: laid.height },
                sidebar: lends ? { x: 0, y: 0, width: side, height: laid.height } : null,
                obscured: within(shell.rects?.obscured, laid),
                titleBar: over ? { height: over } : null,
                animation: null,
            };
        }
        const rects = shell.rects;
        return {
            floating: look.floating,
            region: false,
            content: rects?.content || { x: 0, y: 0, width, height },
            sidebar: lends ? rects?.sidebar || null : null,
            obscured: rects?.obscured || null,
            titleBar: look.titleBar && { height: look.titleBar.height },
            animation: id === shell.animates && id === current ? rects?.animation || null : null,
        };
    }

    // The frame lays out across the whole stage.
    function frameLook() {
        const { width, height } = stage.size();
        return { floating: look.floating, titleBar: look.titleBar, size: { width, height } };
    }

    // A mod listed stays listed while it launches again, in this page or a new one (a replace), until its new run
    // says whether it has something to show.
    function stateOf() {
        const mods = inOrder()
            .filter(({ id }) => shownInList(id) || (inList.has(id) && listed(id) && mayShow(id)))
            .map(({ id, name }) => ({ id, name, icon: deckit.mods.listingOf(id)?.icon || '' }));
        inList = new Set(mods.map(({ id }) => id));
        return {
            mods,
            current,
            canBack: history.at > 0,
            canForward: history.at < history.list.length - 1,
            sidebar,
            down: down && { name: deckit.config.name, why: down },
        };
    }

    function broadcast() {
        const contents = frameContents();
        if (contents) PROTOCOL.state.send(contents, stateOf());
        const mod = deckit.mods.list().find(({ id }) => id === current);
        const title = mod?.name || deckit.config.name;
        if (title !== titled) host.panelTitled((titled = title));
    }

    function setSidebar(change) {
        sidebar = {
            ...sidebar,
            ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined && value !== null)),
        };
        deckit.state.write(SIDEBAR, sidebar);
        update();
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
        return pages.has(id) && listed(id);
    }

    // Whether a keystroke or a request in this page is the panel's: its frame, a surface the frame opened, one of its
    // mods' pages, or a web page in one.
    function contains(page) {
        if (page === frameContents()) return true;
        if ([...shell.surfaces.values()].includes(page)) return true;
        return [...pages.values()].includes(deckit.web.pageFor(page));
    }

    function currentContents() {
        return pages.get(current) || null;
    }

    function frameContents() {
        return shell.page;
    }

    // The view's own idea of whether it is up (didAppear, its keys, its entrance and exit) never parts from this.
    // The frame and the children on screen play it with the mod on screen; main waits on the frame's alone.
    // `waited`: a page main waits on to play its exit, told by its own channel.
    function setShown(on, waited = null) {
        shown = on;
        const shownPages = onScreen();
        for (const page of [frameContents(), ...shownPages])
            if (page && page !== waited) PROTOCOL.visible.send(page, { open: on, animate: true });
        sent.onScreen = new Set(on ? shownPages : []);
    }

    // Showing over an app does not move focus off the app's document, so the app's keys would still answer
    // under the panel. Only on the way in: a later click into the app is the person's.
    function show() {
        stage.show(true);
        if (shown) return;
        setShown(true);
        focus();
    }

    // Resolves whether the panel had the keyboard as it went, in any of its pages on screen: a hidden view keeps
    // its focus and goes on taking keystrokes, so the host gives it back. Hidden only after the frame has played
    // its exit.
    // A newer hide or move takes the place of one waiting on its exit, which then resolves false.
    async function hide() {
        if (!shown) return false;
        const mine = ++moves;
        const contents = frameContents();
        const leaving = [contents, ...onScreen()].filter(Boolean);
        setShown(false, contents);
        if (contents) await exitOf(PROTOCOL.exit, contents);
        if (mine !== moves || shown) return false;
        const held = leaving.some((page) => deckit.pages.isAlive(page) && deckit.web.holdsKeyboard(page));
        stage.show(false);
        return held;
    }

    // Main waits on a page's exit only so long: a page that is gone or stuck plays none.
    function exitOf(channel, contents) {
        return channel.invoke(contents, {}, { timeout: EXIT_LIMIT_MS }).catch(() => {});
    }

    // The keyboard is the mod's on screen, or the frame's while there is none.
    function focus() {
        const page = (!down && currentContents()) || frameContents();
        if (page) deckit.pages.focus(page);
    }

    // A move keeps the panel up the whole way, its exit played as it leaves and its entrance as it arrives.
    // Resolves false when it was put away on the way, or a newer move replaced it.
    async function leave() {
        const contents = frameContents();
        if (!shown || !contents) return true;
        const mine = ++moves;
        for (const page of onScreen()) PROTOCOL.play.send(page, { direction: 'out' });
        await exitOf(PROTOCOL.leave, contents);
        return mine === moves;
    }

    function arrive() {
        show();
        for (const page of [frameContents(), ...onScreen()]) if (page) PROTOCOL.play.send(page, { direction: 'in' });
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
            place: (window, options) => stage.place(window, options),
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
