import * as PROTOCOL from './protocol.js';
import * as WIDTH from './model/width.js';
import * as PAGE from './model/page-name.js';

// `deckit` is what connect answered, `host` the app's answers.
export function createPanel({ REGION, deckit, host }) {
    // MARK: - Property
    const SIDEBAR = 'panel-frame';
    const PINNED = 'panel-pinned';
    const HISTORY_LIMIT = 50;
    const views = new Map(); // mod id -> the view its page is in, while the mod has something to show
    const floating = new Map(); // webContents id of a mod page with something floating -> its end's off
    const sent = { onScreen: new Set(), guides: new WeakMap(), look: '' }; // what the pages were last told
    // The frame's page, the surfaces it opened by name, and where it said its parts are. `moving` is where its
    // page is laid while the frame moves: what it covers before and after.
    // `animates` is the mod the move was told to.
    const shell = { view: null, surfaces: new Map(), rects: null, moving: null, settling: null, animates: null };
    const NAMED_KEYS = new Set(['back', 'forward']); // the actions of the panel's keys a tooltip names
    let raised = new Set(); // the children laid over their regions, lifted over the mod on screen
    let front = null; // what is lifted over every view: the frame, or the mod on screen while something floats in it
    const history = { list: [], at: -1 };
    let container = null;
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
    let look = { floating: false, dismissible: false, titleBar: null };
    let sidebar = { width: WIDTH.MIN, collapsed: false, navHeight: null }; // as the person left it
    let pinned = new Set(); // the children the person pinned to the panel's list

    // MARK: - Initializer
    // MARK: - Public
    // The mods that have something to show, in a container the host app places, under the panel's frame. A mod
    // whose view names a parent is that one's child: its view is shown where a region of the parent's shows it,
    // and in the panel only once the person pins it to the list.
    function start() {
        sidebar = { ...sidebar, ...deckit.state.read(SIDEBAR, {}) };
        pinned = new Set(deckit.state.read(PINNED, []));
        const { View } = require('electron');
        container = new View();
        container.setBackgroundColor('#00000000');
        container.setVisible(false);
        deckit.log.guard(container, 'bounds-changed', update);
        listen();
        registerKeys();
        makeFrame();
        deckit.mods.onChange(reconcile);
        // Who is whose child changes with the runs, which reconcile hears too: a region's change is only layout.
        REGION.onChange(update);
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, reconcile);
        reconcile();
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
    function monitor(page, input) {
        if (!isEscape(input)) return false;
        const last = dismisses(page);
        if (page === frameContents()) {
            if (last) host.dismiss();
            return last;
        }
        if (!floating.has(page.id) && !last) return false;
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
            // What the page opened ends with it: its next run opens its own.
            deckit.pages.whenEnds(sender, dropSurfaces);
            sent.look = JSON.stringify(frameLook());
            return { glass: GLASS, look: frameLook(), shown, state: stateOf() };
        });
        PROTOCOL.chord.handle(({ action }, sender) =>
            fromFrame(sender) && NAMED_KEYS.has(action) ? deckit.keymap.chordOf(action) : ''
        );
        PROTOCOL.pick.on(({ id }, sender) => fromFrame(sender) && select(id));
        PROTOCOL.step.on(({ by }, sender) => fromFrame(sender) && step(by));
        PROTOCOL.reorder.on(({ ids }, sender) => fromFrame(sender) && deckit.mods.arrange(ids));
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
    }

    // The frame's page is the shell's own, made once, over every mod's view where it draws.
    // It opens its backdrop and its handle, and nothing else. A press there is the person's on the panel, so the
    // keyboard goes back to the mod on screen.
    function makeFrame() {
        const view = deckit.pages.make(PAGE.PAGE_NAME);
        const contents = view.webContents;
        view.setBackgroundColor('#00000000');
        view.setVisible(false);
        contents.setWindowOpenHandler(({ frameName }) =>
            Object.values(PAGE.SURFACE).includes(frameName) && !shell.surfaces.has(frameName)
                ? { action: 'allow', createWindow: (options) => openSurface(frameName, options.webContents) }
                : { action: 'deny' }
        );
        deckit.keymap.listen(contents);
        deckit.log.guard(contents, 'focus', focus);
        // It lays the frame out off screen too, since the mods are laid by it. Chromium takes the preference back
        // at each load, so it is given again as each one finishes.
        deckit.log.guard(contents, 'did-finish-load', () => contents.setBackgroundThrottling(false));
        // The panel has no frame without it: a page that crashed is loaded again.
        deckit.log.guard(contents, 'render-process-gone', () => !contents.isDestroyed() && contents.reload());
        deckit.log.guard(
            contents,
            'console-message',
            ({ level, message }) => level === 'error' && deckit.log.error(`panel: ${message}`)
        );
        container.addChildView(view);
        shell.view = view;
    }

    // A document of the frame's page, laid as a view of its own. It runs no code and goes nowhere.
    function openSurface(name, webContents) {
        const { WebContentsView } = require('electron');
        const view = new WebContentsView({ webContents });
        view.setBackgroundColor('#00000000');
        view.setVisible(false);
        webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
        deckit.log.guard(webContents, 'will-frame-navigate', (details) => details.preventDefault());
        deckit.log.guard(webContents, 'focus', focus);
        shell.surfaces.set(name, view);
        if (name === PAGE.SURFACE.BACKDROP) container.addChildView(view, 0);
        else {
            container.addChildView(view);
            stack(true);
        }
        update();
        return webContents;
    }

    function dropSurfaces() {
        for (const view of shell.surfaces.values()) {
            container.removeChildView(view);
            if (!view.webContents.isDestroyed()) view.webContents.close();
        }
        shell.surfaces.clear();
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
        if (on === floating.has(page.id)) return;
        if (!on) {
            floating.get(page.id)();
            floating.delete(page.id);
            stack();
            return;
        }
        const id = page.id;
        floating.set(
            id,
            deckit.pages.whenEnds(page, () => {
                floating.delete(id);
                stack();
            })
        );
        stack();
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
        let added = false;
        for (const [id, view] of showing) {
            if (views.has(id)) continue;
            views.set(id, view);
            view.setBackgroundColor('#00000000');
            view.setVisible(false);
            container.addChildView(view);
            added = true;
        }
        if (added) stack(true);
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

    // The mods' pages on screen while the panel is: the mod on screen, then the children its regions show.
    function onScreen() {
        if (!views.has(current)) return [];
        return [current, ...childrenOnScreen().keys()].map((id) => views.get(id).webContents);
    }

    // child id -> its rect: the children the mod on screen shows in its regions, laid out.
    function childrenOnScreen() {
        return REGION.laidOut(current, (id) => id !== current && views.has(id));
    }

    // Every view where it goes, then every page told whether it is on screen and where it lays out. A page that
    // leaves the screen holding the keyboard would go on taking keystrokes unseen: the mod on screen takes it.
    function update() {
        const holder = [...sent.onScreen].find((page) => !page.isDestroyed() && deckit.web.holdsKeyboard(page));
        layout();
        tellPages();
        if (holder && !sent.onScreen.has(holder)) focus();
    }

    // From the bottom: the backdrop over the whole container, the mod on screen over it all, the children it shows
    // over their regions, then the frame's page and its handle where they draw. The rest are hidden.
    function layout() {
        const { width, height } = container.getBounds();
        const children = childrenOnScreen();
        let lifted = false;
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
            if (!raised.has(id)) {
                container.addChildView(view);
                lifted = true;
            }
            view.setBounds(clip(rect, width, height));
            view.setVisible(true);
        }
        raised = new Set(children.keys());
        stack(lifted);
        lay(shell.surfaces.get(PAGE.SURFACE.BACKDROP), { x: 0, y: 0, width, height }, width, height);
        lay(shell.view, shell.moving || shell.rects?.obscured, width, height);
        lay(shell.surfaces.get(PAGE.SURFACE.HANDLE), shell.rects?.handle, width, height);
    }

    // The frame's page and its handle stay over every mod's view, but for a dialog or a menu of the mod on screen,
    // which comes over them as it did over the page's own. `again`: a view was added, so what was lifted is
    // lifted again.
    function stack(again = false) {
        const next = floating.has(currentContents()?.id) ? views.get(current) : shell.view;
        if (next === front && !again) return;
        front = next;
        if (next !== shell.view) return container.addChildView(next);
        for (const view of [shell.view, shell.surfaces.get(PAGE.SURFACE.HANDLE)])
            if (view) container.addChildView(view);
    }

    function lay(view, rect, width, height) {
        if (!view) return;
        const laid = rect && clip(rect, width, height);
        const on = !!laid && laid.width > 0 && laid.height > 0;
        if (on) view.setBounds(laid);
        view.setVisible(on);
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
        for (const view of views.values()) {
            const next = guideOf(view.webContents);
            const written = JSON.stringify(next);
            if (sent.guides.get(view.webContents) === written) continue;
            sent.guides.set(view.webContents, written);
            PROTOCOL.guide.send(view.webContents, next);
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
        const { width, height } = container.getBounds();
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

    // The frame lays out across the whole container.
    function frameLook() {
        const { width, height } = container.getBounds();
        return { floating: look.floating, titleBar: look.titleBar, size: { width, height } };
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
            sidebar,
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
        return views.has(id) && listed(id);
    }

    // Whether a keystroke or a request in this webContents is the panel's: its frame, a surface the frame opened,
    // one of its mods' pages, or a web page in one.
    function contains(webContents) {
        if (webContents === frameContents()) return true;
        if ([...shell.surfaces.values()].some((view) => view.webContents === webContents)) return true;
        const page = deckit.web.pageFor(webContents);
        return [...views.values()].some((view) => view.webContents === page);
    }

    function currentContents() {
        return views.get(current)?.webContents || null;
    }

    function frameContents() {
        return shell.view?.webContents || null;
    }

    // The view's own idea of whether it is up (didAppear, its keys, its entrance and exit) never parts from this.
    // The frame and the children on screen play it with the mod on screen; main waits on the frame's alone.
    // `waited`: a page main waits on to play its exit, told by its own channel.
    function setShown(on, waited = null) {
        shown = on;
        const pages = onScreen();
        for (const page of [frameContents(), ...pages])
            if (page && page !== waited) PROTOCOL.visible.send(page, { open: on, animate: true });
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
    // its focus and goes on taking keystrokes, so the host gives it back. Hidden only after the frame has played
    // its exit.
    // A newer hide or move takes the place of one waiting on its exit, which then resolves false.
    async function hide() {
        if (!shown) return false;
        const mine = ++moves;
        const contents = frameContents();
        const pages = [contents, ...onScreen()].filter(Boolean);
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

    // The keyboard is the mod's on screen, or the frame's while there is none.
    function focus() {
        (currentContents() || frameContents())?.focus();
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
