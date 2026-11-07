import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as WIDTH from './model/width.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as LIST_ORDER from './model/list-order.js';
import * as TOKEN from '../ui/token/index.js';
import * as FIELD from './model/field.js';
import * as DOCK from './model/dock.js';
import { createKey } from '../key/main.js';

// `deckit` is what connect answered, `host` the app's answers, `PAGES` the shell's pages, `OVERLAY` their overlays and
// `makeStage()` a stage to lay them on (environment: SHELL.stage), and `dock` the ids of the mods the host app keeps in
// the Dock at the first start, or null.
export function createPanel({ REGION, PAGES, OVERLAY, makeStage, deckit, host, dock }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const SIDEBAR = 'panel-frame';
    const PINNED = 'panel-pinned';
    const ORDER = 'panel-order';
    const HISTORY_LIMIT = 50;
    const pages = new Map(); // mod id -> its page, while the mod has something to show
    const sent = { onScreen: new Set(), guides: new WeakMap(), look: '' }; // what the pages were last told
    // The frame's page, the surfaces it opened by name, where it said the slot under its list is, and the width a
    // drag of its handle draws. `moving` is where its page is laid while the frame moves: what it covers before and
    // after. `moved` is the last move of the sidebar: the mod it was told to and the parts it moved them to.
    const shell = {
        page: null,
        surfaces: new Map(),
        slot: null,
        sizing: null,
        moving: null,
        settling: null,
        moved: null,
    };
    const KEY = createKey({ deckit });
    // What each of the shell's keys does, by its id.
    const KEY_ACTIONS = Object.freeze({
        toggleSidebar: () => setSidebar({ collapsed: !sidebar.collapsed }),
        back: () => step(-1),
        forward: () => step(1),
    });
    const history = { list: [], at: -1 };
    let stage = null; // where the pages are laid, which the host app places
    let current = null;
    let returning = null; // the mod that was on screen while its page runs again, or that the person opened
    let opening = null; // the mod the person opened, while its launch has not settled
    // How long main waits on a page's exit, or its answer to Escape, before it goes on: it guards a page that is
    // gone or stuck.
    const EXIT_LIMIT_MS = 400;
    let shown = false;
    let moves = 0; // counts the hides and moves, so a newer one takes the place of one still waiting
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let look = { floating: false, dismissible: false, titleBar: null };
    let sidebar = { width: WIDTH.MIN, collapsed: false, navHeight: null }; // as the person left it
    let pinned = new Set(); // the mods the person keeps in the Dock
    let order = []; // the ids of the mods, as the person arranged the Dock

    // MARK: - Initializer
    for (const key of FIELD.KEYS) deckit.fields.define(key);

    // MARK: - Public
    // The mods whose manifest fields give a view, their pages on a stage the host app places, under the panel's frame,
    // and the Dock in its sidebar: the mods the person keeps there, running or not, and those running now. A mod whose
    // view names a parent is that one's child: its view is shown where a region of the parent's shows it, and in the
    // panel only once the person keeps it in the Dock.
    function start() {
        sidebar = { ...sidebar, ...deckit.state.read(SIDEBAR, {}) };
        // At the first start the Dock's mods take their places in the order they are kept there.
        const kept = deckit.state.read(PINNED, null);
        const arranged = deckit.state.read(ORDER, null);
        pinned = new Set(kept ?? firstDock());
        order = arranged ?? (kept ? [] : [...pinned]);
        if (!kept) deckit.state.write(PINNED, [...pinned]);
        if (!kept && !arranged) deckit.state.write(ORDER, order);
        KEY.start();
        deckit.keymap.monitor(monitor);
        stage = makeStage();
        stage.whenResized(update);
        listen();
        makeFrame();
        deckit.mods.onChange(reconcile);
        // Who is whose child changes with the runs, which reconcile hears too: a region's change is only layout.
        REGION.onChange(update);
        // An overlay laid or taken off is only layout.
        OVERLAY.onChange(() => layout());
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

    // A mod on screen, asked by the mod itself or by a mod with deckit.mods. One with no view in the panel has nothing
    // to show. A child not in the list brings its parent, whose regions show what they show. One that does not run
    // launches as the person opens it.
    function bringToFront(modId) {
        const front = frontOf(modId);
        if (select(front)) host.show();
        else if (launchable(front)) {
            open(front);
            host.show();
        }
    }

    // Whether bringToFront has a mod to put on screen for it.
    function canBringToFront(modId) {
        const front = frontOf(modId);
        return shownInPanel(front) || launchable(front);
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
            const frameNow = frameLook(partsOf());
            sent.look = JSON.stringify(frameNow);
            return { glass: TOKEN.GLASS, look: frameNow, shown, state: stateOf() };
        });
        PROTOCOL.chord.handle(({ id }, sender) => (fromFrame(sender) ? KEY.chordOf(id) : ''));
        PROTOCOL.pick.on(({ id }, sender) => fromFrame(sender) && (select(id) || (launchable(id) && open(id))));
        PROTOCOL.step.on(({ by }, sender) => fromFrame(sender) && step(by));
        PROTOCOL.reorder.on(({ ids }, sender) => fromFrame(sender) && arrange(ids));
        PROTOCOL.layout.on((change, sender) => fromFrame(sender) && setSidebar(change));
        PROTOCOL.slot.on((slot, sender) => fromFrame(sender) && setSlot(slot));
        PROTOCOL.sizing.on(({ width }, sender) => fromFrame(sender) && setSizing(width));
        // A page's new document is told its guide here, which is then the last it was told.
        PROTOCOL.setup.handle((_payload, sender) => {
            const guide = guideOf(sender, partsOf());
            sent.guides.set(sender, JSON.stringify(guide));
            return { guide, shown: sent.onScreen.has(sender) };
        });
        PROTOCOL.show.on((_payload, sender) => modOf(sender) && bringToFront(modOf(sender)));
        PROTOCOL.icon.handle(({ mod }) => FIELD.iconOf(deckit.mods.fieldsOf(mod)));
        PROTOCOL.list.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return listed();
        });
        PROTOCOL.pinned.handle((_payload, sender) => {
            deckit.mods.managerFrom(sender);
            return [...pinned];
        });
        PROTOCOL.setPinned.handle(({ id, pinned: on }, sender) => {
            if (!fromFrame(sender)) deckit.mods.managerFrom(sender);
            setPinned(id, on);
        });
        PROTOCOL.quit.on(({ id }, sender) => fromFrame(sender) && quit(id));
        PROTOCOL.open.handle(({ id }, sender) => {
            deckit.mods.managerFrom(sender);
            if (!canBringToFront(id)) throw new Error(`${id} has nothing to show`);
            bringToFront(id);
        });
        PROTOCOL.restart.on((_payload, sender) => fromFrame(sender) && down && deckit.restart());
    }

    // A key pressed in a page of the app, before the page has it: answers whether the panel took it. It is the key of
    // the deckit page it was pressed in, or of the one whose overlay or web page that is. In the panel's page in front
    // a chord of one of the shell's keys runs that key. Escape puts the panel away where the panel floats over
    // something, once the page did not take it: the frame or a mod's page plays it out and answers whether it did. In
    // its own window Escape is the window's.
    function monitor(pressedIn, keystroke) {
        const page = deckit.web.pageFor(OVERLAY.ownerOf(pressedIn));
        if (!page) return false;
        if (isEscape(keystroke)) {
            if (!dismisses(page)) return false;
            PROTOCOL.escape
                .invoke(page, {}, { timeout: EXIT_LIMIT_MS })
                .then((taken) => !taken && dismisses(page) && host.dismiss())
                .catch(() => {});
            return true;
        }
        const id = isActive(page) ? KEY.idOf(keystroke) : null;
        if (!id) return false;
        KEY_ACTIONS[id]();
        return true;
    }

    // The frame's page is the shell's own, made once, over every mod's view where it draws. It opens its backdrop and
    // its handle, and its overlay as every page the shell draws in does. A press there is the person's on the panel, so
    // the keyboard goes back to the mod on screen.
    // It lays the frame out off screen too, since the mods are laid by it, and the panel has no frame without it: a
    // page that crashed is loaded again.
    function makeFrame() {
        const page = PAGES.open(PAGE.PAGE_NAME, {
            keepsDrawing: true,
            reloadsOnCrash: true,
            surfaces: { names: Object.values(PAGE.SURFACE), onOpen: openSurface },
        });
        deckit.keymap.listen(page);
        PAGES.whenFocused(page, focus);
        shell.page = page;
        layout();
    }

    // A document of the frame's page, laid as a page of its own. It runs no code and goes nowhere.
    function openSurface(name, page) {
        PAGES.whenFocused(page, focus);
        shell.surfaces.set(name, page);
        update();
    }

    // A document loaded again in its place finds the surfaces the last one opened, by name, and draws them anew; a
    // page that crashed or went takes them with it, and its next document opens its own.
    function frameEnded({ replaced }) {
        const dropped = replaced ? [] : [...shell.surfaces.values()];
        if (!replaced) shell.surfaces.clear();
        layout();
        for (const page of dropped) PAGES.close(page);
        clearTimeout(shell.settling);
        shell.slot = null;
        shell.sizing = null;
        shell.moving = null;
        shell.moved = null;
        update();
    }

    function setSlot(next) {
        shell.slot = next;
        update();
    }

    function setSizing(width) {
        shell.sizing = width;
        update();
    }

    // Where the frame's parts are, for the panel's size and the sidebar as it is drawn; none until the frame told
    // where its slot is.
    function partsOf() {
        if (!shell.slot) return null;
        const { width, height } = stage.size();
        return LAYOUT.laidOut({
            size: { width, height },
            titleBar: look.titleBar,
            width: shell.sizing ?? sidebar.width,
            collapsed: sidebar.collapsed,
            slot: shell.slot,
        });
    }

    // The sidebar moved from `before`: the pages play the move until the parts move again, and the frame's page covers
    // both where it was and where it goes, until it has gone there.
    function move(before) {
        const after = partsOf();
        if (!before || !after || (before.collapsed === after.collapsed && before.drawn === after.drawn)) return;
        shell.moved = { id: current, parts: JSON.stringify(after) };
        clearTimeout(shell.settling);
        shell.moving = union(before.obscured, after.obscured);
        shell.settling = setTimeout(() => {
            shell.moving = null;
            layout();
        }, TOKEN.LENGTH.base);
    }

    // A mod kept in the Dock or taken out of it, as the person's. A child taken out while on screen leaves the panel
    // for its parent.
    function setPinned(id, on) {
        if (on === pinned.has(id)) return;
        if (on) pinned.add(id);
        else pinned.delete(id);
        deckit.state.write(PINNED, [...pinned]);
        if (!on && current === id && !inPanel(id)) {
            current = null;
            if (!select(REGION.parentOf(id)) && !select(firstShown())) update();
        }
        broadcast();
    }

    // The mod put on screen for one: itself, or the parent of a child not in the panel.
    function frontOf(id) {
        const parent = REGION.parentOf(id);
        return parent && !inPanel(id) ? parent : id;
    }

    // What the Dock keeps at the first start, in order: the mods the host app names, or else those it ships whose view
    // names no parent, in the mods' order.
    function firstDock() {
        if (dock) return dock;
        const shipped = new Set(deckit.mods.shipped());
        return deckit.mods
            .list()
            .map(({ id }) => id)
            .filter((id) => shipped.has(id) && viewOf(id)?.parent === null);
    }

    // The person quits a mod from the Dock.
    function quit(id) {
        deckit.mods.quit(id).catch((error) => deckit.log.error(`${id} did not quit`, error));
    }

    function isEscape(input) {
        return input.code === 'Escape' && !input.meta && !input.control && !input.alt && !input.shift;
    }

    // Escape puts the panel away only where it floats over something.
    function dismisses(page) {
        return isActive(page) && look.dismissible;
    }

    // The pages of the mods that said they have something to show, as the mods run. A page shown stays while
    // its mod terminates, and while it launches again in that page. The mod on screen whose page is replaced, or the
    // one the person opened, comes on screen once its new page says it has something to show; until then, and when it
    // has nothing, the panel lands as it does at the start.
    function reconcile() {
        const showing = new Map(
            deckit.mods
                .runs()
                .filter(({ run, page }) => joinedView(run) ?? (pages.get(run.mod.id) === page && inTransition(run)))
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
        if (returning && returning !== opening && !mayShow(returning)) returning = null;
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
        return joinedView(run) ?? inTransition(run);
    }

    // Whether a running run has a view, once the shell's lifecycle of it has joined or ended; undefined before.
    function joinedView(run) {
        return run.state === 'running' && run.summary?.view !== undefined ? run.summary.view : undefined;
    }

    // Launching, terminating, or ended to launch again.
    function inTransition(run) {
        return run.state !== 'notRunning' || run.relaunches;
    }

    // Shown in the panel, and not running: it has no run, or its run ended and does not launch again.
    function launchable(id) {
        const run = deckit.mods.runOf(id);
        return inPanel(id) && (!run || (run.state === 'notRunning' && !run.relaunches));
    }

    // The person opens a mod that does not run: it launches, and comes on screen once its view joins.
    function open(id) {
        remember(id);
        returning = id;
        opening = id;
        deckit.mods
            .launch(id)
            .catch((error) => deckit.log.error(`${id} did not launch`, error))
            .finally(() => {
                if (opening === id) opening = null;
                reconcile();
            });
    }

    // In the list's order: the first mod that has something to show, or may have once it has started, of those shown
    // in the panel. One still starting is waited for, so the panel lands where the order says and not on whoever
    // started first.
    function firstShown() {
        return inOrder().find(({ id }) => mayShow(id) && inPanel(id))?.id;
    }

    // The mods in the list's order: those the person placed, as they placed them, then the rest in the mods' order.
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

    // Shown in the panel: a mod with a view naming no parent, or a child the person keeps in the Dock.
    function inPanel(id) {
        return !!viewOf(id) && (!REGION.interfaceOf(id) || pinned.has(id));
    }

    // The view the mod's manifest fields give, or null.
    function viewOf(id) {
        const mod = deckit.mods.list().find((one) => one.id === id);
        return mod ? FIELD.viewOf(deckit.mods.fieldsOf(id), mod) : null;
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

    // Every page told where it lays out, then every view where it goes, then every page whether it is on screen: a
    // page comes on screen told where, and hears it is up once it is laid, since laying a page waits on the page and a
    // page asking main as it appears would wait on main. A page that leaves the screen holding the keyboard would go on
    // taking keystrokes unseen: the mod on screen takes it. The frame's parts are found once for all of it; once they
    // move again, the sidebar's move is over.
    function update() {
        const holder = [...sent.onScreen].find((page) => PAGES.isAlive(page) && OVERLAY.holdsKeyboard(page));
        const parts = partsOf();
        if (shell.moved && shell.moved.parts !== JSON.stringify(parts)) shell.moved = null;
        tellPages(parts);
        layout(parts);
        tellShown();
        if (holder && !sent.onScreen.has(holder)) focus();
    }

    // From the bottom: the backdrop over the whole stage, the mod on screen, the children it shows over their
    // regions, then the frame's page and its handle where they draw; the mods' other pages are hidden. Over all of it,
    // the overlay of each page laid that shows anything, at its page's rect. With deckit's core down the frame alone
    // covers the panel.
    function layout(parts = partsOf()) {
        const { width, height } = stage.size();
        const full = { x: 0, y: 0, width, height };
        if (down) {
            stage.lay(
                OVERLAY.withOverlays([
                    ...[...pages.values(), shell.surfaces.get(PAGE.SURFACE.HANDLE)]
                        .filter(Boolean)
                        .map((page) => ({ page, hidden: true })),
                    { page: shell.page, rect: full },
                ])
            );
            return;
        }
        const children = childrenOnScreen();
        const hidden = [...pages].filter(([id]) => id !== current && !children.has(id));
        stage.lay(
            OVERLAY.withOverlays(
                [
                    at(shell.surfaces.get(PAGE.SURFACE.BACKDROP), full),
                    ...hidden.map(([, page]) => ({ page, hidden: true })),
                    pages.has(current) ? { page: pages.get(current), rect: full } : null,
                    ...[...children].map(([id, rect]) => ({ page: pages.get(id), rect: clip(rect, width, height) })),
                    at(shell.page, shell.moving || parts?.obscured),
                    at(shell.surfaces.get(PAGE.SURFACE.HANDLE), parts?.handle),
                ].filter(Boolean)
            )
        );

        // A page laid where `rect` is, clipped to the stage, or hidden when nothing of it is left.
        function at(page, rect) {
            if (!page) return null;
            const laid = rect && clip(rect, width, height);
            return laid && laid.width > 0 && laid.height > 0 ? { page, rect: laid } : { page, hidden: true };
        }
    }

    function tellPages(parts) {
        const contents = frameContents();
        const framed = frameLook(parts);
        const written = JSON.stringify(framed);
        if (contents && sent.look !== written) {
            sent.look = written;
            PROTOCOL.look.send(contents, framed);
        }
        for (const page of onScreen()) {
            const next = guideOf(page, parts);
            const written = JSON.stringify(next);
            if (sent.guides.get(page) === written) continue;
            sent.guides.set(page, written);
            PROTOCOL.guide.send(page, next);
        }
    }

    function tellShown() {
        const now = new Set(shown ? onScreen() : []);
        for (const page of sent.onScreen)
            if (!now.has(page)) PROTOCOL.visible.send(page, { open: false, animate: false });
        for (const page of now)
            if (!sent.onScreen.has(page)) PROTOCOL.visible.send(page, { open: true, animate: false });
        sent.onScreen = now;
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

    // Where a mod's page on screen lays out what it shows; a hidden one is told as it comes on screen. Only the mod on
    // screen moves as the frame does. In a region its rooms are the region's: its sidebar at the start, as wide as the
    // panel's, and what of the frame and the window's title bar lie over it as it is laid.
    function guideOf(page, parts) {
        const id = deckit.mods.modOf(page);
        const { width, height } = stage.size();
        const lends = !!viewOf(id)?.sidebar;
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
                obscured: within(parts?.obscured, laid),
                titleBar: over ? { height: over } : null,
                moves: false,
            };
        }
        return {
            floating: look.floating,
            region: false,
            content: parts?.content || { x: 0, y: 0, width, height },
            sidebar: lends ? parts?.sidebar || null : null,
            obscured: parts?.obscured || null,
            titleBar: look.titleBar && { height: look.titleBar.height },
            moves: id === current && shell.moved?.id === id,
        };
    }

    // The frame lays out across the whole stage, its parts where main lays its views.
    function frameLook(parts) {
        const { width, height } = stage.size();
        return {
            floating: look.floating,
            titleBar: look.titleBar,
            barRoom: LAYOUT.barRoom(look.titleBar),
            size: { width, height },
            parts,
            moves: !!shell.moved,
        };
    }

    // The Dock: the mods shown in the panel that the person keeps there, running or not, then those running now. One
    // that does not run is there for the person to open.
    function stateOf() {
        const shown = inOrder().filter(({ id }) => inPanel(id));
        const names = new Map(shown.map(({ id, name }) => [id, name]));
        const mods = DOCK.items([...names.keys()], { pinned, running: runningIds() }).map((item) => ({
            ...item,
            name: names.get(item.id),
            icon: FIELD.iconOf(deckit.mods.fieldsOf(item.id)),
        }));
        return {
            mods,
            current,
            canBack: history.at > 0,
            canForward: history.at < history.list.length - 1,
            sidebar,
            down: down && { name: deckit.config.name, why: down },
        };
    }

    // Every mod with a view, in the list's order, marked as the Dock marks them.
    function listed() {
        const running = runningIds();
        return inOrder()
            .filter(({ id }) => viewOf(id))
            .map(({ id, name }) => {
                const fields = deckit.mods.fieldsOf(id);
                return {
                    id,
                    name,
                    icon: FIELD.iconOf(fields),
                    keywords: FIELD.keywordsOf(fields),
                    pinned: pinned.has(id),
                    running: running.has(id),
                };
            });
    }

    // The ids of the mods whose run launches, runs or terminates, or that launch again.
    function runningIds() {
        return new Set(
            deckit.mods
                .runs()
                .filter(({ run }) => inTransition(run))
                .map(({ run }) => run.mod.id)
        );
    }

    function broadcast() {
        const contents = frameContents();
        if (contents) PROTOCOL.state.send(contents, stateOf());
        const mod = deckit.mods.list().find(({ id }) => id === current);
        const title = mod?.name || deckit.config.name;
        if (title !== titled) host.panelTitled((titled = title));
    }

    // A width kept ends the drag that drew it.
    function setSidebar(change) {
        const before = partsOf();
        sidebar = {
            ...sidebar,
            ...Object.fromEntries(Object.entries(change).filter(([, value]) => value !== undefined && value !== null)),
        };
        if (typeof change.width === 'number') shell.sizing = null;
        deckit.state.write(SIDEBAR, sidebar);
        move(before);
        update();
        broadcast();
    }

    // Which mod is on screen. No fade: here it is a swap of views, on the most repeated action in the panel.
    // Answers whether it is on screen now.
    function select(id, { fromHistory = false } = {}) {
        if (!shownInPanel(id)) return false;
        // Another mod put on screen meanwhile is where the panel stays.
        if (id !== returning) returning = null;
        if (current === id) return true;
        if (!fromHistory) remember(id);
        current = id;
        update();
        if (shown) focus();
        broadcast();
        return true;
    }

    // The mod is the latest in the history, after where it is now.
    function remember(id) {
        history.list.splice(history.at + 1, Infinity, id);
        if (history.list.length > HISTORY_LIMIT) history.list.shift();
        history.at = history.list.length - 1;
    }

    // A mod no longer there, or with nothing to show, is passed over.
    function step(by) {
        let at = history.at + by;
        while (at >= 0 && at < history.list.length && !shownInPanel(history.list[at])) at += by;
        if (at < 0 || at >= history.list.length) return;
        if (!select(history.list[at], { fromHistory: true })) return;
        history.at = at;
        broadcast();
    }

    // A mod that is there, has something to show, and is shown in the panel.
    function shownInPanel(id) {
        return pages.has(id) && inPanel(id);
    }

    // Whether a keystroke or a request in this page is the panel's: its frame, a surface the frame opened, one of its
    // mods' pages, or a web page in one, or the overlay of one of them.
    function contains(page) {
        const owner = OVERLAY.ownerOf(page);
        if (owner === frameContents()) return true;
        if ([...shell.surfaces.values()].includes(owner)) return true;
        return [...pages.values()].includes(deckit.web.pageFor(owner));
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
        const held = leaving.some((page) => PAGES.isAlive(page) && OVERLAY.holdsKeyboard(page));
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
        if (page) PAGES.focus(page);
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
            glass: TOKEN.GLASS,
            // Into one of the host app's windows, as a stage is placed (`bounds`, `onClose`).
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
        bringToFront,
        canBringToFront,
    };
}
