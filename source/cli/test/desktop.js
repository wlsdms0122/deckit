// The desktop's window manager (deckit-shell/shell/desktop/model/window-manager): the windows every seat shares and
// each seat's own order, key window and minimized windows, a window opened right behind each seat's key window, a
// window another seat holds left to it, the key window passed on as one closes or is minimized, a window ordered behind
// the key window, and a frame no smaller than its minimum; which mods may activate for a seat (model/activation): the
// mod its input reaches and those asked along the chain, until its next input, and the mods that ask for its attention;
// and where windows go (model/layout): a new one cascaded from the key window or centred, a restored one kept
// reachable, a resize held to the minimum, a drag kept under the host's strip as it goes, zoom to the desktop but the
// Dock's sliver, and the frame's parts; and the desktop (desktop/main) over stand-ins for what connect answers, the
// shell's pages and a stage: the pages laid in the local seat's order, no window key at start, the keyboard and the
// host's title following its key window, a window brought forward in front and key, the host window coming up, only by
// a mod that may activate, and right behind the key window, its mod asking for attention, by one that may not, a window
// ordered front or opened without taking the keyboard, the shell's keys, a frame restored and remembered by the
// window's name, a mod's windows brought in front for a seat from the Dock, the Dock's pointer room, a zoomed window
// following the desktop's size and any other kept reachable as it shrinks, and a titled window's content under the
// title bar the shell draws, its title told and its drag, and the panel windows in the host's bar: placed right to left
// in the order they opened, laid over the desktop's page, told no title bar, never key, pressed with the key window
// left key; and one at the right edge: placed along it under the bar, cut to a window's corners, taking the keyboard
// as it opens and as it is pressed, keeping it through a press in the bar, and giving it back to the key window as a
// normal window or the desktop is pressed and as it closes; and the anchors a window's mod tells, with the panel
// windows that stand under them. Exits 1 with a line for each check that failed. The packages are ES modules, so they
// are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const WM = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'window-manager.js'));
    const ACTIVATION = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'activation.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'layout.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'dock', 'model', 'dock.js'));
    const { createDesktop } = await import(url('deckit-shell', 'shell', 'desktop', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // Two seats at one desktop: `me` and `you`.
    const manager = WM.createWindowManager();
    manager.addSeat('me');
    manager.addSeat('you');
    const minimum = { width: 100, height: 50 };
    const at = (x) => ({ x, y: 0, width: 300, height: 200 });
    const order = (seat) =>
        manager
            .viewOf(seat)
            .map(({ id }) => id)
            .join();
    manager.open('me', 1, { frame: at(0), minimum });
    const opened = manager.orderFront('me', 1);
    manager.open('me', 2, { frame: at(10), minimum });
    check(
        "a window opens right behind each seat's key window, or in front for a seat with none, and is no key window",
        order('me') === '2,1' && order('you') === '1,2' && manager.keyOf('me') === 1 && manager.keyOf('you') === null,
        { me: order('me'), you: order('you'), key: manager.keyOf('me') }
    );
    manager.orderFront('me', 2);
    check(
        'a window a seat orders front is in front, its key window',
        opened === WM.KEY && order('me') === '1,2' && manager.keyOf('me') === 2,
        { me: order('me'), key: manager.keyOf('me') }
    );
    check(
        'the key window is held by its seat alone, and is no key window of the seat that did not make it key',
        manager.isKey(2) && !manager.isKey(1) && manager.keyOf('you') === null,
        ''
    );
    const held = manager.orderFront('you', 2);
    check(
        'a seat that brings a window another holds to its front has it in front, and is answered it is held',
        held === WM.HELD && order('you') === '1,2' && manager.keyOf('you') === null && manager.keyOf('me') === 2,
        { held, you: order('you') }
    );
    const yours = manager.orderFront('you', 1);
    check(
        "each seat has its own order and key window: one's front may be behind for another",
        yours === WM.KEY && order('you') === '2,1' && order('me') === '1,2' && manager.keyOf('you') === 1,
        { me: order('me'), you: order('you') }
    );
    manager.orderFront('me', 1);
    check('a window another seat holds is not taken from it', manager.keyOf('me') === 2 && manager.keyOf('you') === 1, [
        manager.keyOf('me'),
        manager.keyOf('you'),
    ]);
    manager.open('me', 3, { frame: at(20), minimum });
    check(
        "a window opened leaves each seat's key window where it is, in front of it",
        manager.keyOf('me') === 2 && order('me') === '3,2,1' && order('you') === '2,3,1',
        { key: manager.keyOf('me'), me: order('me'), you: order('you') }
    );
    manager.orderFront('me', 3);
    check('making another window key lets go of the one before', !manager.isKey(2) && manager.keyOf('me') === 3, '');

    manager.minimize('me', 3);
    check(
        "a seat's minimized window leaves its view alone, and its key window is the next it does not minimize",
        order('me') === '2,1' &&
            order('you') === '2,3,1' &&
            manager.isMinimized('me', 3) &&
            manager.isShown(3) &&
            manager.keyOf('me') === 2,
        { me: order('me'), you: order('you'), key: manager.keyOf('me') }
    );
    manager.minimize('you', 3);
    check('a window every seat minimized is on no screen', !manager.isShown(3), '');
    manager.orderFront('me', 3);
    check(
        'brought to front, a minimized window is back in front, the key window',
        order('me') === '2,1,3' && manager.keyOf('me') === 3 && !manager.isMinimized('me', 3) && manager.isShown(3),
        order('me')
    );
    manager.minimize('me', 3);
    manager.minimize('me', 2);
    check(
        'the next key window passes over one another seat holds',
        manager.keyOf('me') === null && manager.keyOf('you') === 1,
        manager.keyOf('me')
    );
    manager.orderFront('me', 2);
    manager.close('you', 1);
    check(
        'a window closed closes for every seat, and a seat whose key window it was takes the next it may hold',
        order('me') === '2' && order('you') === '2' && manager.keyOf('you') === null && manager.keyOf('me') === 2,
        { me: order('me'), you: order('you'), key: manager.keyOf('you') }
    );
    check(
        'the key window of one seat is not made key by another going to it',
        manager.makeKey('you', 2) === WM.HELD,
        ''
    );

    manager.setFrame('you', 2, { x: 5, y: 6, width: 20, height: 400 });
    check(
        "a frame one seat sets every seat sees, no smaller than the window's minimum",
        JSON.stringify(manager.frameOf(2)) === JSON.stringify({ x: 5, y: 6, width: 100, height: 400 }) &&
            JSON.stringify(manager.viewOf('me')[0].frame) === JSON.stringify(manager.frameOf(2)),
        manager.frameOf(2)
    );
    const area = { x: 6, y: 40, width: 994, height: 660 };
    manager.zoom('me', 2, area);
    const zoomed = manager.frameOf(2);
    manager.zoom('me', 2, area);
    check(
        'zoom fills the area it is given, and zoomed again goes back to the frame it had',
        JSON.stringify(zoomed) === JSON.stringify(area) &&
            JSON.stringify(manager.frameOf(2)) === JSON.stringify({ x: 5, y: 6, width: 100, height: 400 }),
        { zoomed, back: manager.frameOf(2) }
    );
    manager.zoom('me', 2, area);
    manager.setFrame('me', 2, { x: 1, y: 2, width: 300, height: 300 });
    check(
        'a frame set ends the zoom',
        !manager.isZoomed(2) && JSON.stringify(manager.standardFrameOf(2)) === JSON.stringify(manager.frameOf(2)),
        manager.frameOf(2)
    );
    const taken = manager.orderFront('you', 3);
    manager.removeSeat('you');
    check(
        "a seat that leaves holds nothing more: its key window may be another's",
        taken === WM.KEY && manager.orderFront('me', 3) === WM.KEY,
        taken
    );
    manager.addSeat('late');
    check('a seat that sits down sees every window open', order('late') === '2,3', order('late'));

    // A window ordered behind the key window, as a mod that may not activate brings one forward.
    const behind = WM.createWindowManager();
    behind.addSeat('me');
    for (const id of [1, 2, 3]) behind.open('me', id, { frame: at(0), minimum });
    behind.orderFront('me', 2);
    behind.minimize('me', 1);
    behind.orderBehindKey('me', 1);
    const behindOrder = () => behind.orderOf('me').join();
    check(
        'a window ordered behind the key window is right behind it, out of what the seat minimized, not key',
        behindOrder() === '3,1,2' && behind.keyOf('me') === 2 && !behind.isMinimized('me', 1),
        behindOrder()
    );
    behind.orderFront('me', 3, { activates: false });
    behind.orderBehindKey('me', 3);
    check(
        'a window in front of the key window already stays there',
        behindOrder() === '1,2,3' && behind.keyOf('me') === 2,
        behindOrder()
    );

    // Which mods may activate for a seat.
    const activation = ACTIVATION.createActivation();
    activation.addSeat('me');
    activation.addSeat('you');
    check(
        'a seat with no key window and no input hands activation to no mod',
        !activation.mayActivate('me', 'a') && !activation.mayActivate('me', null),
        ''
    );
    activation.input('me', 'a');
    activation.request('a', 'b');
    activation.request('b', 'c');
    activation.request('x', 'y');
    check(
        "the mod a seat's input reaches may activate for it, and each mod one that may asks, along the chain",
        ['a', 'b', 'c'].every((mod) => activation.mayActivate('me', mod)) &&
            !activation.mayActivate('me', 'y') &&
            !activation.mayActivate('you', 'b'),
        ''
    );
    activation.setActive('me', 'c');
    activation.input('me', 'd');
    check(
        "the seat's next input ends what it handed: the mod it reaches and its active mod may activate",
        activation.mayActivate('me', 'd') &&
            activation.mayActivate('me', 'c') &&
            !activation.mayActivate('me', 'a') &&
            !activation.mayActivate('me', 'b'),
        ''
    );
    // The one seat a mod acts for as it activates.
    const causes = ACTIVATION.createActivation();
    for (const seat of ['me', 'you']) causes.addSeat(seat);
    const unasked = causes.causeOf('view');
    causes.input('me', 'band');
    causes.input('you', 'band');
    causes.request('band', 'view');
    const last = causes.causeOf('view');
    causes.input('me', 'band');
    causes.request('band', 'registry');
    causes.request('registry', 'view');
    const handedOn = [causes.causeOf('view'), causes.mayActivate('you', 'view')];
    check(
        'a mod acts for one seat of those it may activate for, the one whose input reached it last, itself or handed ' +
            'on, and for none where it may activate for none',
        unasked === null && last === 'you' && handedOn.join() === 'me,true',
        { unasked, last, handedOn }
    );
    causes.setActive('you', 'view');
    causes.input('you', null);
    const active = [causes.causeOf('view'), causes.mayActivate('you', 'band')];
    causes.input('me', 'other');
    const left = causes.causeOf('view');
    causes.setActive('you', null);
    check(
        'the seat a mod acts for is the later of one whose input was handed on to it and one it is the active mod ' +
            "of, and a seat's input elsewhere ends what it handed",
        active.join() === 'me,false' && left === 'you' && causes.causeOf('view') === null,
        { active, left, none: causes.causeOf('view') }
    );
    activation.requestAttention('me', 'e');
    activation.requestAttention('me', 'f');
    activation.requestAttention('you', 'e');
    activation.setActive('me', 'f');
    check(
        'a mod asks for attention until it is the active mod',
        activation.attentionOf('me').join() === 'e' && activation.attentionOf('you').join() === 'e',
        activation.attentionOf('me')
    );
    activation.cancelAttention('e');
    check(
        'a mod with no window open asks no seat for attention',
        !activation.attentionOf('me').length && !activation.attentionOf('you').length,
        activation.attentionOf('you')
    );

    // Where windows go, on a desktop under a 40 px strip.
    const desktop = LAYOUT.desktopOf({ width: 1000, height: 700 }, 40);
    check(
        "the desktop is the stage under the host's strip",
        JSON.stringify(desktop) === JSON.stringify({ x: 0, y: 40, width: 1000, height: 660 }),
        desktop
    );
    const size = { width: 400, height: 300 };
    const centred = LAYOUT.placed({ size, desktop });
    const cascaded = LAYOUT.placed({ size, after: { x: 100, y: 100, ...size }, desktop });
    const wrapped = LAYOUT.placed({ size, after: { x: 590, y: 380, ...size }, desktop });
    check(
        'a new window opens centred, or cascaded from the key window, back at the top left where that leaves no room',
        JSON.stringify(centred) === JSON.stringify({ x: 303, y: 160, width: 400, height: 300 }) &&
            cascaded.x === 124 &&
            cascaded.y === 124 &&
            wrapped.x === 30 &&
            wrapped.y === 64,
        { centred, cascaded, wrapped }
    );
    const restored = LAYOUT.placed({ size, restored: { x: 2000, y: -50, ...size }, desktop });
    check(
        'a frame restored is kept where its title bar can be reached',
        restored.x === 936 && restored.y === 40 && restored.width === 400,
        restored
    );
    const fromLeft = LAYOUT.resized({ x: 100, y: 100, width: 300, height: 200 }, 'top-left', 250, -20, minimum);
    check(
        'a resize from the top left moves those sides, the others staying put at the minimum',
        JSON.stringify(fromLeft) === JSON.stringify({ x: 300, y: 80, width: 100, height: 220 }),
        fromLeft
    );
    const draggedUp = LAYOUT.underBar({ x: 100, y: 10, width: 300, height: 200 }, desktop, { moved: true });
    const toppedUp = LAYOUT.underBar({ x: 100, y: 10, width: 300, height: 200 }, desktop, { moved: false });
    check(
        "a drag as it goes leaves no window over the host's strip: a move stops below it, a top edge at it",
        JSON.stringify(draggedUp) === JSON.stringify({ x: 100, y: 40, width: 300, height: 200 }) &&
            JSON.stringify(toppedUp) === JSON.stringify({ x: 100, y: 40, width: 300, height: 170 }),
        { draggedUp, toppedUp }
    );
    check(
        "a window's minimum is at least its title bar and buttons",
        LAYOUT.minimumOf({ width: 10 }).width === LAYOUT.MINIMUM.width &&
            LAYOUT.minimumOf({ width: 500, height: 400 }).height === 400,
        LAYOUT.minimumOf({ width: 10 })
    );
    check(
        "zoomed, a window leaves the Dock's sliver",
        LAYOUT.zoomedIn(desktop).x === DOCK.SLIVER && LAYOUT.zoomedIn(desktop).width === 1000 - DOCK.SLIVER,
        LAYOUT.zoomedIn(desktop)
    );
    const parts = LAYOUT.partsOf({ x: 100, y: 100, width: 300, height: 200 });
    const right = parts.edges.find(({ edge }) => edge === 'right').rect;
    check(
        "a frame's surface takes the window and its shadow, its edges outside the window, its buttons at its top left",
        parts.rect.x === 100 - LAYOUT.SHADOW &&
            parts.rect.width === 300 + 2 * LAYOUT.SHADOW &&
            parts.edges.length === 8 &&
            right.x === LAYOUT.SHADOW + 300 &&
            right.width === LAYOUT.EDGE &&
            parts.buttons.x === 100 &&
            parts.buttons.width === 78,
        parts
    );
    const bar = LAYOUT.DEFAULT_BAR;
    const close = LAYOUT.buttonsOf(bar)[0];
    check(
        "a window's buttons stand centred on its 48 bar, as far in as down, its title bar area 78 in",
        bar.height === 48 && close.x === 18 && close.y === 18 && bar.areaX === 78 && LAYOUT.MINIMUM.width === 120,
        { bar, close }
    );
    const tall = LAYOUT.barOf({ height: 64 });
    const moved = LAYOUT.barOf({ origin: { x: 30, y: 400 } });
    const wide = LAYOUT.minimumOf({}, LAYOUT.barOf({ origin: { x: 200 } }));
    check(
        "a taller bar keeps its buttons centred; an origin moves them and the area, one past the bar's bottom stands there",
        tall.y === 26 &&
            tall.x === 18 &&
            LAYOUT.minimumOf({}, tall).height === 64 &&
            moved.x === 30 &&
            moved.y === 36 &&
            moved.areaX === 90 &&
            wide.width === 302,
        { tall, moved, wide }
    );
    const titled = LAYOUT.barOf({ style: 'titled' });
    check(
        'a titled window tells its content no bar and lays it below its own; a unified one tells its bar',
        LAYOUT.guideOf(titled) === null &&
            JSON.stringify(LAYOUT.guideOf(bar)) === JSON.stringify({ height: 48, controlsWidth: 78 }) &&
            LAYOUT.contentOf({ x: 0, y: 0, width: 100, height: 200 }, titled).y === 48 &&
            LAYOUT.framedSize({ width: 520, height: 700 }, titled).height === 748,
        LAYOUT.guideOf(titled)
    );

    // Mods `a` and `b`; windows 1 and 2 of `a`, 3 of `b`, each a stand-in for what the shell's windows make.
    const desk = desktopOver(createDesktop, {
        state: { 'window-frames': { a: { main: { level: 'normal', x: 200, y: 100, width: 400, height: 300 } } } },
    });
    const pages = { a: { name: 'page-a', mod: 'a' }, b: { name: 'page-b', mod: 'b' }, c: { name: 'page-c', mod: 'c' } };
    const windowOf = (id, mod, name) => ({
        id,
        mod,
        name,
        level: 'normal',
        page: pages[mod],
        surface: { name: `content-${id}`, of: pages[mod] },
        size: { width: 300, height: 200 },
        minimum: { width: 0, height: 0 },
        bar: LAYOUT.DEFAULT_BAR,
    });
    const one = windowOf(1, 'a', 'main');
    const two = windowOf(2, 'a', 'other');
    const three = windowOf(3, 'b', 'main');
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const names = () => desk.laid().map(({ page }) => page.name);
    desk.desktop.open(one);
    desk.openSurfaces(1);
    check(
        'at start no window takes the keyboard by itself: one a mod opens is in front, not key, its mod asking for ' +
            'no attention with no key window to be held behind, the host window left down',
        names().at(-2) === 'buttons-1' &&
            !desk.desktop.isKey(one) &&
            !desk.focused.some(({ name }) => name === 'content-1') &&
            desk.hostShown() === 0 &&
            !desk.page().dock.attention.length,
        { names: names(), shown: desk.hostShown(), dock: desk.page().dock }
    );
    desk.pagePress(1);
    check(
        'a press on a window makes it key, its mod the active mod, which asks for no attention',
        desk.desktop.isKey(one) && desk.page().dock.active === 'a' && !desk.page().dock.attention.length,
        desk.page().dock
    );
    desk.desktop.open(two);
    desk.openSurfaces(2);
    desk.request('a', 'b');
    desk.desktop.open(three);
    desk.openSurfaces(3);
    check(
        "the pages are laid in the local seat's order: the mods' pages, the backdrop, each window's frame, content and " +
            "buttons, then the desktop's page",
        names().join() ===
            [
                'page-a',
                'page-b',
                'backdrop',
                ...[1, 2, 3].flatMap((id) => [`frame-${id}`, `content-${id}`, `buttons-${id}`]),
                'desktop',
            ].join(),
        names()
    );
    check(
        'a window opens where its mod left the window of its name, and cascades from the key window when it left none',
        JSON.stringify(desk.frameOf(1)) === JSON.stringify({ x: 200, y: 100, width: 400, height: 300 }) &&
            desk.frameOf(2).x === 224 &&
            desk.frameOf(2).y === 124,
        [desk.frameOf(1), desk.frameOf(2)]
    );
    check(
        "the keyboard and the host's title are the key window's",
        desk.focused.at(-1)?.name === 'content-3' && desk.titles.at(-1) === 'B' && !('title' in desk.page()),
        { focused: desk.focused.at(-1), titles: desk.titles }
    );
    check(
        'a window the active mod opens, or a mod it asked, is in front and key, the host window coming up',
        desk.hostShown() === 2,
        desk.hostShown()
    );
    desk.pagePress(2);
    check(
        "a press on a window's frame makes it key, in front",
        desk.focused.at(-1)?.name === 'content-2' &&
            desk.titles.at(-1) === 'A' &&
            desk.page().dock.active === 'a' &&
            names().at(-2) === 'buttons-2',
        { focused: desk.focused.at(-1), titles: desk.titles, names: names() }
    );
    const keyboardBefore = desk.focused.length;
    const hostBefore = desk.hostShown();

    // b, which the seat's input no longer reaches, brings windows forward on its own; c too, which has one alone.
    const reminder = windowOf(5, 'b', 'reminder');
    desk.desktop.open(reminder);
    desk.openSurfaces(5);
    check(
        'a window a mod that may not activate opens goes right behind the key window, not key, the host window left ' +
            'down, and its mod asks for attention',
        names().at(-2) === 'buttons-2' &&
            names().at(-5) === 'buttons-5' &&
            desk.desktop.isKey(two) &&
            desk.focused.length === keyboardBefore &&
            desk.hostShown() === hostBefore &&
            JSON.stringify(desk.page().dock.attention) === '["b"]',
        { names: names(), shown: desk.hostShown(), dock: desk.page().dock }
    );
    const quiet = windowOf(7, 'c', 'quiet');
    desk.desktop.open(quiet, { activates: false });
    desk.openSurfaces(7);
    check(
        'a window such a mod opens without activating goes right behind the key window, its mod asking for no attention',
        names().at(-5) === 'buttons-7' &&
            desk.desktop.isKey(two) &&
            JSON.stringify(desk.page().dock.attention) === '["b"]',
        { names: names(), dock: desk.page().dock }
    );
    desk.desktop.close(quiet);
    desk.desktop.orderFront(three);
    check(
        'a window such a mod orders front goes right behind the key window too',
        names().at(-5) === 'buttons-3' && desk.desktop.isKey(two) && desk.hostShown() === hostBefore,
        names()
    );
    const lone = windowOf(6, 'c', 'main');
    desk.desktop.open(lone);
    desk.desktop.close(lone);
    desk.desktop.close(reminder);
    check(
        'a mod asks for attention until it has no window open',
        JSON.stringify(desk.page().dock.attention) === '["b"]',
        desk.page().dock
    );
    desk.chord('b');
    desk.desktop.orderFront(three);
    check(
        'a chord that reaches a mod lets it activate: its window comes in front and key, the host window coming up',
        names().at(-2) === 'buttons-3' &&
            desk.desktop.isKey(three) &&
            desk.hostShown() === hostBefore + 1 &&
            !desk.page().dock.attention.length,
        { names: names(), dock: desk.page().dock }
    );
    desk.key(three.surface);
    desk.desktop.orderFront(two);
    check(
        'a key pressed in a window ends what the seat handed before: the mod it reached is the one that may activate',
        names().at(-5) === 'buttons-2' && desk.desktop.isKey(three),
        names()
    );
    desk.pagePress(2);

    desk.desktop.orderFront(one, { activates: false });
    check(
        'a window the active mod orders front comes in front and leaves the key window and the keyboard where they are',
        names().at(-2) === 'buttons-1' && desk.desktop.isKey(two) && desk.focused.at(-1)?.name === 'content-2',
        { names: names(), focused: desk.focused.at(-1) }
    );
    const shownBefore = desk.hostShown();
    desk.desktop.orderFront(two);
    check(
        'a window the active mod makes key and orders front takes the keyboard, the host window coming up',
        names().at(-2) === 'buttons-2' &&
            desk.desktop.isKey(two) &&
            desk.focused.at(-1)?.name === 'content-2' &&
            desk.hostShown() === shownBefore + 1,
        { names: names(), shown: desk.hostShown() }
    );
    const toast = windowOf(9, 'a', 'toast');
    desk.desktop.open(toast, { activates: false });
    desk.openSurfaces(9);
    check(
        'a window opened without activating comes in front, the key window and the host window left where they are',
        names().at(-2) === 'buttons-9' &&
            desk.desktop.isKey(two) &&
            desk.focused.at(-1)?.name === 'content-2' &&
            desk.hostShown() === shownBefore + 1,
        names()
    );
    desk.desktop.close(toast);
    desk.press('cycleWindows', one.surface);
    check('the next window of the active mod comes in front', desk.desktop.isKey(one), names());
    desk.press('closeWindow', two.surface);
    check(
        'the key window closes, and the next in the order is key',
        !names().includes('content-1') && desk.desktop.isKey(two),
        names()
    );
    desk.press('minimizeWindow', two.surface);
    check(
        'the key window minimizes, and the next is key',
        !names().includes('content-2') && desk.desktop.isKey(three) && desk.titles.at(-1) === 'B',
        { names: names(), titles: desk.titles }
    );
    const pressedOff = desk.press('closeWindow', { name: 'elsewhere' });
    check("a shell key in a page that is not the desktop's is not taken", pressedOff === false, pressedOff);
    desk.desktop.control.hide();
    const pressedHidden = desk.press('closeWindow', three.surface);
    desk.desktop.control.show();
    check(
        'a shell key is not taken while the desktop is not shown',
        pressedHidden === false && desk.desktop.isKey(three),
        pressedHidden
    );

    desk.desktop.activation.input('local', 'a');
    const activated = desk.desktop.activate('local', 'a');
    check(
        'a mod brought in front for a seat has its windows in front, those it minimized too, the front one key',
        activated && names().includes('content-2') && desk.desktop.isKey(two) && !desk.desktop.activate('local', 'c'),
        names()
    );
    check(
        "the desktop's page is the local seat's screen, and no other page is",
        desk.desktop.seatAt(desk.desktopPage) === 'local' && desk.desktop.seatAt(two.page) === null,
        null
    );

    desk.pageFrames(2, { x: 300, y: 200, width: 500, height: 400 });
    check(
        "a window's frame is remembered by its mod and its name",
        JSON.stringify(desk.state['window-frames'].a.other) ===
            JSON.stringify({ level: 'normal', x: 300, y: 200, width: 500, height: 400 }),
        desk.state['window-frames']
    );

    const inputOf = () => desk.laid().at(-1).input;
    const sliver = inputOf();
    desk.fromPage('dock', { out: true });
    const out = inputOf();
    check(
        "the desktop's page takes the pointer at the host's bar and the Dock's sliver down the edge, and its card too " +
            'while it is out, never the rest of its column',
        sliver.length === 2 &&
            sliver[0].height === 28 &&
            sliver[1].width === DOCK.SLIVER &&
            sliver[1].y === 28 &&
            out.length === 3 &&
            out[1].width === DOCK.SLIVER &&
            out[2].x === 0 &&
            out[2].width === DOCK.WIDTH &&
            out[2].y > 28 &&
            out[2].height < sliver[1].height - 2 * DOCK.CARD.padding,
        { sliver, out }
    );

    const materials = () => desk.laid().filter(({ material }) => material);
    const card = { material: 'popover', x: -20, y: 300, width: 84, height: 200, cornerRadius: 20 };
    desk.fromPage('glass', { materials: [card, { material: 'menu', x: 'left' }] });
    const desktopAt = desk.laid().findIndex(({ page }) => page === desk.desktopPage);
    check(
        "a material the desktop's page tells is laid just under it at its rect and radius, one that is no rect dropped",
        materials().length === 1 &&
            JSON.stringify(desk.laid()[desktopAt - 1]) ===
                JSON.stringify({
                    material: 'popover',
                    rect: { x: -20, y: 300, width: 84, height: 200 },
                    cornerRadius: 20,
                }),
        materials()
    );
    desk.fromPage('glass', { materials: [] });
    check("the desktop's page telling no material takes them off", materials().length === 0, materials());

    desk.desktop.zoom(two);
    desk.resize({ width: 1400, height: 900 });
    check(
        'a zoomed window fills the desktop again as it changes size',
        JSON.stringify(desk.frameOf(2)) ===
            JSON.stringify({ x: DOCK.SLIVER, y: 28, width: 1400 - DOCK.SLIVER, height: 900 - 28 }),
        desk.frameOf(2)
    );

    desk.pageFrames(3, { x: 1300, y: 700, width: 300, height: 200 });
    desk.resize({ width: 800, height: 500 });
    const smaller = LAYOUT.desktopOf({ width: 800, height: 500 }, 28);
    check(
        'as the desktop shrinks, a window not zoomed is moved where its title bar can be reached, and a zoomed one fills it',
        JSON.stringify(desk.frameOf(3)) ===
            JSON.stringify(LAYOUT.kept({ x: 1300, y: 700, width: 300, height: 200 }, smaller)) &&
            JSON.stringify(desk.frameOf(2)) === JSON.stringify(LAYOUT.zoomedIn(smaller)),
        [desk.frameOf(3), desk.frameOf(2)]
    );

    const web = LAYOUT.barOf({ style: 'titled' });
    const four = { ...windowOf(4, 'b', 'web'), size: LAYOUT.framedSize({ width: 300, height: 200 }, web), bar: web };
    four.title = 'Site';
    desk.desktop.open(four);
    desk.openSurfaces(4);
    const framed = desk.laid().find(({ page }) => page.name === 'frame-4');
    const titledFrame = {
        ...desk.frameOf(4),
        y: desk.frameOf(4).y - LAYOUT.TITLE_BAR.height,
        height: 200 + LAYOUT.TITLE_BAR.height,
    };
    check(
        "a titled window's content is laid under the title bar the shell draws, which takes the pointer in its frame",
        framed.rect.y + LAYOUT.SHADOW + LAYOUT.TITLE_BAR.height === desk.frameOf(4).y &&
            desk.frameOf(4).height === 200 &&
            JSON.stringify(framed.input.at(-1)) === JSON.stringify(LAYOUT.titleBarOf(titledFrame, web)),
        { framed, content: desk.frameOf(4) }
    );
    desk.desktop.setTitle(four, 'Other');
    const told = desk.page().windows;
    check(
        "the desktop's page is told a titled window's title as it changes, and null for any other",
        told.find(({ id }) => id === 4).title === 'Other' && told.find(({ id }) => id === 3).title === null,
        told
    );
    const before = desk.frameOf(4);
    desk.pagePointer(4, 'bar', 'down', { x: 0, y: 0 }, { grabX: 100, grabY: 10 });
    desk.pagePointer(4, 'bar', 'move', { x: -10, y: 5 });
    desk.pagePointer(4, 'bar', 'up', { x: -10, y: 5 });
    check(
        "a drag of a titled window's title bar moves it, and its frame is remembered by its name",
        desk.frameOf(4).x === before.x - 10 &&
            desk.frameOf(4).y === before.y + 5 &&
            desk.state['window-frames'].b.web.y === before.y + 5 - LAYOUT.TITLE_BAR.height,
        { frame: desk.frameOf(4), kept: desk.state['window-frames'].b }
    );
    // An overlay window of `b`, in a floating window of the host app's, moved by the person to a screen on the left.
    const float = { id: 10, mod: 'b', name: 'float', level: 'overlay' };
    desk.desktop.remember(float, { x: -900, y: 40, width: 400, height: 300 });
    check(
        "an overlay window's frame is kept with the desktop's, at its level as the host app tells it, and an overlay " +
            'window of its name opens at it',
        JSON.stringify(desk.state['window-frames'].b.float) ===
            JSON.stringify({ level: 'overlay', x: -900, y: 40, width: 400, height: 300 }) &&
            JSON.stringify(desk.desktop.keptFrameOf({ ...float, id: 11 })) ===
                JSON.stringify({ x: -900, y: 40, width: 400, height: 300 }),
        desk.state['window-frames'].b
    );
    const named = windowOf(12, 'b', 'float');
    desk.desktop.open(named);
    check(
        'a window opened at another level than the frame its name was left at takes none',
        desk.frameOf(12).x !== -900 &&
            desk.desktop.keptFrameOf({ ...float, name: 'web' }) === null &&
            desk.desktop.keptFrameOf(named) === null,
        { frame: desk.frameOf(12), kept: desk.state['window-frames'].b }
    );
    desk.desktop.close(named);
    const framesKept = desk.desktop.keepsFramesOf('b') && !desk.desktop.keepsFramesOf('c');
    await desk.desktop.forgetFramesOf('b');
    check(
        'the desktop answers whether it keeps frames of a mod, and erasing them leaves those of the others',
        framesKept &&
            !desk.desktop.keepsFramesOf('b') &&
            !('b' in desk.state['window-frames']) &&
            'a' in desk.state['window-frames'],
        desk.state['window-frames']
    );
    desk.desktop.remember({ ...float, mod: 'c' }, { x: 10, y: 20, width: 400, height: 300 });
    const overlayKept = desk.desktop.keepsFramesOf('c');
    await desk.desktop.forgetFramesOf('c');
    check(
        'a mod whose overlay window alone was left somewhere is one the desktop keeps frames of, and erasing them ' +
            'forgets that frame',
        overlayKept && !desk.desktop.keepsFramesOf('c') && desk.desktop.keptFrameOf({ ...float, mod: 'c' }) === null,
        desk.state['window-frames']
    );

    // Panel windows in the host's bar, 28 high across a stage 800 wide.
    const panelOf = (id, mod, size) => ({ ...windowOf(id, mod, `bar-${id}`), level: 'panel', size });
    const firstPanel = panelOf(21, 'a', { width: 100, height: 20 });
    const secondPanel = panelOf(22, 'b', { width: 60, height: 40 });
    const keyBefore = desk.page().windows.find(({ key }) => key)?.id ?? null;
    desk.desktop.openPanel(firstPanel);
    desk.desktop.openPanel(secondPanel);
    const inBar = desk.desktop.control.panels();
    check(
        "panel windows stand in the host's bar right to left in the order they opened, 8 in from its right end and 8 " +
            'apart, each no higher than the bar and centred on its height',
        JSON.stringify(inBar.map(({ frame }) => frame)) ===
            JSON.stringify([
                { x: 692, y: 4, width: 100, height: 20 },
                { x: 624, y: 0, width: 60, height: 28 },
            ]) &&
            inBar[0].mod === 'a' &&
            inBar[1].name === 'bar-22',
        inBar
    );
    const laidNames = names();
    const content = desk.laid().find(({ page }) => page.name === 'content-21');
    check(
        "a panel window's content is laid over the desktop's page, cut to its frame rounded by half its height, its " +
            'material under it in that page',
        laidNames.indexOf('content-21') > laidNames.indexOf('desktop') &&
            laidNames.indexOf('content-22') > laidNames.indexOf('content-21') &&
            content.clip.cornerRadius === 10 &&
            JSON.stringify(desk.page().panels) ===
                JSON.stringify(inBar.map(({ id, frame }) => ({ id, frame, radius: frame.height / 2 }))),
        { laidNames, content, panels: desk.page().panels }
    );
    check(
        "a panel window's content has its overlay laid over the whole stage, what it presents not cut to the panel",
        JSON.stringify(content.spread) === JSON.stringify({ x: 0, y: 0, width: 800, height: 500 }),
        content
    );
    const panelTold = desk.desktop.stateOf(firstPanel);
    desk.desktop.pressPanel(firstPanel);
    check(
        'a panel window is told no title bar and is never key, and a press in it leaves the key window key',
        panelTold.titleBar === null &&
            panelTold.key === false &&
            panelTold.width === 100 &&
            panelTold.height === 20 &&
            (desk.page().windows.find(({ key }) => key)?.id ?? null) === keyBefore,
        { panelTold, keyBefore, windows: desk.page().windows }
    );
    const roomsNow = () => [firstPanel, secondPanel].map((panel) => desk.desktop.stateOf(panel).room);
    const rooms = roomsNow();
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 100 } });
    const roomsLess = roomsNow();
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    const elsewhere = LAYOUT.roomsIn(
        [
            { edge: 'right', size: { width: 300, height: 200 } },
            { edge: 'top', size: { width: 900, height: 20 } },
        ],
        { width: 800, bar: 28, controls: 70 }
    );
    check(
        "a panel window in the bar is told its room there, the bar past the host's controls less 8 at each end and " +
            'what the other panel windows in it take, told again as the controls change; any other window has none',
        JSON.stringify([rooms, roomsLess, roomsNow()]) ===
            JSON.stringify([
                [
                    { width: 646, height: 28 },
                    { width: 606, height: 28 },
                ],
                [
                    { width: 616, height: 28 },
                    { width: 576, height: 28 },
                ],
                rooms,
            ]) &&
            JSON.stringify(elsewhere) === JSON.stringify([null, { width: 714, height: 28 }]) &&
            desk.desktop.stateOf(desk.page().windows.map(({ id }) => ({ id }))[0] ?? {}).room === null,
        { rooms, roomsLess, elsewhere }
    );
    // A child of `b` shown in its panel window's region, pressed.
    const childPage = { name: 'page-c', mod: 'c' };
    desk.children.runs = [{ run: { mod: { id: 'c' }, state: 'running', summary: { view: true } }, page: childPage }];
    desk.children.laid.set('b', new Map([['c', { window: 22, rect: { x: 4, y: 2, width: 32, height: 24 } }]]));
    desk.desktop.update();
    const keyboardAt = desk.focused.length;
    desk.pressIn(childPage);
    check(
        "a press on a child's view in a panel window reaches the child's mod and leaves the key window key",
        desk.laid().some(({ page }) => page === childPage) &&
            desk.focused.length === keyboardAt + 1 &&
            desk.focused.at(-1)?.name?.startsWith('content-') &&
            desk.desktop.activation.mayActivate(desk.desktop.localSeat, 'c') &&
            (desk.page().windows.find(({ key }) => key)?.id ?? null) === keyBefore,
        { focused: desk.focused.at(-1), windows: desk.page().windows }
    );
    desk.children.runs = [];
    desk.children.laid.clear();
    desk.desktop.closePanel(firstPanel);
    check(
        'a panel window closed leaves its place to those opened after it',
        JSON.stringify(desk.desktop.control.panels().map(({ frame }) => frame)) ===
            JSON.stringify([{ x: 732, y: 0, width: 60, height: 28 }]),
        desk.desktop.control.panels()
    );

    // A panel window at the right edge, under the bar 28 high across the stage 800 by 500, its mod one that may
    // activate.
    const keyId = () => desk.page().windows.find(({ key }) => key)?.id ?? null;
    const rightPanel = { ...panelOf(31, 'a', { width: 360, height: 100 }), edge: 'right' };
    desk.desktop.activation.input(desk.desktop.localSeat, 'a');
    const shownAtRight = desk.hostShown();
    desk.desktop.openPanel(rightPanel);
    const atRight = desk.desktop.control.panels().find(({ id }) => id === 31);
    const rightContent = desk.laid().find(({ page }) => page.name === 'content-31');
    check(
        'a panel window at the right edge stands 8 in from it, from 8 under the bar to 8 above the bottom, its width ' +
            "its mod's, cut to a window's corners, and takes the keyboard as it opens, the host window coming up",
        JSON.stringify(atRight?.frame) === JSON.stringify({ x: 432, y: 36, width: 360, height: 456 }) &&
            atRight.key === true &&
            keyId() === null &&
            desk.desktop.stateOf(rightPanel).key === true &&
            desk.desktop.stateOf(rightPanel).height === 456 &&
            rightContent?.clip.cornerRadius === 16 &&
            desk.page().panels.some(({ id, edge }) => id === 31 && edge === 'right') &&
            desk.focused.at(-1)?.name === 'content-31' &&
            desk.hostShown() === shownAtRight + 1,
        { atRight, rightContent, focused: desk.focused.at(-1) }
    );
    desk.desktop.pressPanel(secondPanel);
    check(
        'a press in the bar leaves the keyboard with the panel window at the right edge that holds it',
        desk.desktop.control.panels().find(({ id }) => id === 31).key === true &&
            desk.focused.at(-1)?.name === 'content-31' &&
            keyId() === null,
        { focused: desk.focused.at(-1), panels: desk.desktop.control.panels() }
    );
    desk.desktop.control.hand.press(keyBefore);
    check(
        'a press on a normal window takes the keyboard back from the panel window at the right edge',
        desk.desktop.control.panels().find(({ id }) => id === 31).key === false &&
            keyId() === keyBefore &&
            desk.desktop.stateOf(rightPanel).key === false,
        { panels: desk.desktop.control.panels(), key: keyId() }
    );
    desk.desktop.control.hand.press(31);
    const pressedKey = desk.desktop.control.panels().find(({ id }) => id === 31).key;
    desk.pressIn(desk.backdrop);
    check(
        'a press on the panel window at the right edge gives it the keyboard, and a press on the desktop where no ' +
            'window is gives it back to the key window',
        pressedKey === true &&
            desk.desktop.control.panels().find(({ id }) => id === 31).key === false &&
            keyId() === keyBefore &&
            desk.focused.at(-1)?.name?.startsWith('content-') &&
            desk.focused.at(-1)?.name !== 'content-31',
        { pressedKey, focused: desk.focused.at(-1) }
    );
    desk.desktop.control.hand.press(31);
    desk.desktop.closePanel(rightPanel);
    const heldBack = { ...panelOf(32, 'z', { width: 200, height: 10 }), edge: 'right' };
    desk.desktop.openPanel(heldBack);
    check(
        'the key window is key again as the panel window at the right edge that holds the keyboard closes, and one ' +
            'of a mod that may not activate opens without it',
        keyId() === keyBefore &&
            desk.desktop.control.panels().find(({ id }) => id === 32).key === false &&
            !desk.desktop.control.panels().some(({ id }) => id === 31),
        { key: keyId(), panels: desk.desktop.control.panels() }
    );
    desk.desktop.closePanel(heldBack);

    const { createOverlay } = await import(url('deckit-shell', 'shell', 'overlay', 'main.js'));
    overlayChecks(createOverlay, check);

    seatChecks({ LAYOUT, DOCK, createDesktop }, check);
    await readingChecks({ LAYOUT, createDesktop }, check);
    const COLOURS = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'colours.js'));
    drawnChecks({ COLOURS, LAYOUT, createDesktop }, check);
    const SEATS = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'seats.js'));
    chipChecks({ SEATS }, check);
    routeChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'routes.js')), check);
    levelChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'levels.js')), check);
    const ANCHOR = await import(url('deckit-sdk', 'shell', 'window', 'model', 'anchor.js'));
    const ANCHORED = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'anchored.js'));
    anchoredChecks({ ANCHOR, ANCHORED }, check);
    await anchorChecks({ LAYOUT, createDesktop }, check);
    showingChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'showing.js')), check);
    await viewChecks({ LAYOUT, createDesktop }, check);
    await askChecks({ SEATS, createDesktop }, check);
    await followChecks({ SEATS, LAYOUT, createDesktop }, check);
    await cursorChecks({ LAYOUT, createDesktop }, check);
    await typingChecks({ LAYOUT, createDesktop }, check);

    const MOTION = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'motion.js'));
    tilingChecks({ WM, LAYOUT, DOCK, MOTION, createDesktop }, check);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} desktop checks`);
    process.exit(0);
}

// The overlay (overlay/main) over stand-ins: a page's overlay laid over it at its rect with a material just under it
// where it told one, on the stage and cut to the page's rect, or at a wider rect it is laid with, the page told where,
// and none once it tells none.
function overlayChecks(createOverlay, check) {
    const handlers = {};
    const frames = [];
    const page = { name: 'page' };
    const surface = { name: 'overlay' };
    const OVERLAY = createOverlay({
        deckit: {
            channels: {
                bind: (declared) => ({
                    handle: (handler) => (handlers[declared.channel] = handler),
                    on: (handler) => (handlers[declared.channel] = handler),
                    send: (_page, payload) => declared.channel === 'deckit-shell:overlay-frame' && frames.push(payload),
                }),
            },
            mods: { modOf: () => 'a' },
            pages: { nameOf: () => null, whenEnds() {} },
        },
        web: { holdsKeyboard: () => false },
        PAGES: { allowSurface: (_page, _name, onOpen) => onOpen(surface), isAlive: () => true, close() {}, focus() {} },
        KEY: { listen() {} },
    });
    OVERLAY.start({ keyboardOf: (each) => each });
    handlers['deckit-shell:overlay-open']({}, page);
    const rect = { x: 100, y: 50, width: 400, height: 300 };
    const tell = (materials) =>
        handlers['deckit-shell:overlay-state'](
            { shows: true, focused: false, regions: [{ x: 10, y: 20, width: 100, height: 50 }], materials },
            page
        );
    tell([
        { material: 'menu', x: 10, y: 20, width: 100, height: 50, cornerRadius: 10 },
        { material: 'popover', x: 380, y: -5, width: 50, height: 10 },
        { material: 'menu', x: 500, y: 0, width: 10, height: 10 },
    ]);
    const laid = OVERLAY.withOverlays([{ page, rect }]);
    check(
        "a page's overlay is laid over it with a material just under it at each it told, on the stage, cut to the " +
            "page's rect, none for one outside it",
        JSON.stringify(laid) ===
            JSON.stringify([
                { page, rect },
                { material: 'menu', rect: { x: 110, y: 70, width: 100, height: 50 }, cornerRadius: 10 },
                { material: 'popover', rect: { x: 480, y: 50, width: 20, height: 5 }, cornerRadius: 0 },
                { page: surface, rect, input: [{ x: 10, y: 20, width: 100, height: 50 }] },
            ]),
        laid
    );
    const full = { x: 0, y: 0, width: 1200, height: 800 };
    const spread = OVERLAY.withOverlays([{ page, rect, spread: full }]);
    check(
        'a page laid with a spread has its overlay there, its materials cut to it, and hears where from its top left',
        JSON.stringify(spread[0]) === JSON.stringify({ page, rect }) &&
            JSON.stringify(spread[2].rect) === JSON.stringify({ x: 380, y: 0, width: 50, height: 5 }) &&
            JSON.stringify(spread.at(-1).rect) === JSON.stringify(full) &&
            JSON.stringify(frames.at(-1)) === JSON.stringify({ x: -100, y: -50, width: 1200, height: 800 }) &&
            JSON.stringify(frames[0]) === JSON.stringify({ x: 0, y: 0, width: 400, height: 300 }),
        { spread, frames }
    );
    tell([]);
    const plain = OVERLAY.withOverlays([{ page, rect }]);
    check(
        'an overlay that tells no material, as where the system asks for less transparency, has none under it',
        plain.length === 2 && !plain.some(({ material }) => material),
        plain
    );
}

// Tiles, edge snapping, the drop a drag shows and the motion a window's frame is drawn by.
// Two seats attached beside the local one at a desktop with three windows, each seat's devices entering as deckit
// hands them: presses read against what is laid for the seat, keys put in the seat's key window, a window held.
function seatChecks({ LAYOUT, DOCK, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    const page = { name: 'page-a', mod: 'a' };
    const windowOf = (id, x) => ({
        id,
        mod: 'a',
        name: `w${id}`,
        level: 'normal',
        page,
        surface: { name: `content-${id}`, of: page },
        size: { width: 200, height: 200 },
        minimum: { width: 0, height: 0 },
        bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
        at: x,
    });
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const all = [windowOf(1, 100), windowOf(2, 400), windowOf(3, 700)];
    for (const window of all) {
        desk.desktop.open(window);
        desk.openSurfaces(window.id);
        desk.desktop.control.hand.move(
            window.id,
            window.at - desk.frameOf(window.id).x,
            300 - desk.frameOf(window.id).y
        );
    }
    const middle = (id) => {
        const { x, y, width, height } = desk.desktop.control.windows().find((one) => one.id === id).frame;
        return { x: x + width / 2, y: y + height / 2 };
    };
    const pointer = (type, at, more = {}) => ({ event: 'pointer', type, ...at, button: 0, count: 1, ...more });
    const key = (code) => ({ event: 'key', type: 'down', code, key: code.slice(3).toLowerCase() });
    const [me, you] = [desk.sit('s1'), desk.sit('s2')];
    const localKey = () => desk.desktop.control.windows().find((one) => one.key)?.id;
    check('the local seat keeps its key window as seats sit', localKey() === 3, localKey());

    const mine = desk.enter(me, pointer('down', middle(1)));
    const yours = desk.enter(you, pointer('down', middle(2)));
    desk.enter(me, pointer('up', middle(1)));
    desk.enter(you, pointer('up', middle(2)));
    const typed = [desk.enter(me, key('KeyA')), desk.enter(you, key('KeyB')), desk.enter(me, key('KeyC'))];
    const putIn = (name, from) =>
        desk.puts
            .filter((put) => put.page === name && put.source === `of-${from}`)
            .map(({ event }) => event.code ?? event.type);
    check(
        'two seats press two windows and type at once: each has its key window, and each key is put in its own',
        mine.over === 1 &&
            mine.key === 'key' &&
            mine.holder === 's1' &&
            yours.over === 2 &&
            yours.holder === 's2' &&
            typed.map(({ to }) => to).join() === '1,2,1' &&
            putIn('content-1', 's1').join() === 'down,up,KeyA,KeyC' &&
            putIn('content-2', 's2').join() === 'down,up,KeyB' &&
            localKey() === 3,
        JSON.stringify({ mine, yours, typed, puts: desk.puts })
    );
    // A child laid over the content of window 1, in a region of it: the seat's keys go to the page it pressed last.
    const over = { name: 'page-c', mod: 'c' };
    desk.children.runs = [{ run: { mod: { id: 'c' }, state: 'running', summary: { view: true } }, page: over }];
    desk.children.laid.set('a', new Map([['c', { window: 1, rect: { x: 60, y: 60, width: 80, height: 80 } }]]));
    desk.desktop.update();
    const pressThenKey = (at, code) => {
        desk.enter(me, pointer('down', at));
        desk.enter(me, pointer('up', at));
        return desk.enter(me, key(code)).to;
    };
    const corner = { x: desk.frameOf(1).x + 20, y: desk.frameOf(1).y + desk.frameOf(1).height - 20 };
    const went = [pressThenKey(middle(1), 'KeyD'), pressThenKey(corner, 'KeyE')];
    desk.enter(me, pointer('down', middle(1)));
    desk.enter(me, pointer('up', middle(1)));
    went.push(pressThenKey({ x: desk.frameOf(1).x + 100, y: desk.frameOf(1).y + 10 }, 'KeyF'));
    went.push(pressThenKey(middle(1), 'KeyG'));
    desk.children.runs = [];
    desk.children.laid.clear();
    desk.desktop.update();
    went.push(desk.enter(me, key('KeyH')).to);
    const keysIn = (name) =>
        desk.puts.filter((put) => put.page === name && put.event.event === 'key').map(({ event }) => event.code);
    check(
        "a seat's keys go to the page of its key window that took its last press, a child laid over the content as " +
            'the content, and to the content once it presses the frame or the child is laid there no more',
        went.join() === '1,1,1,1,1' &&
            keysIn('page-c').join() === 'KeyD,KeyG' &&
            keysIn('content-1').join() === 'KeyA,KeyC,KeyE,KeyF,KeyH',
        JSON.stringify({ went, child: keysIn('page-c'), content: keysIn('content-1') })
    );
    desk.enter(me, pointer('down', middle(1)));
    desk.enter(me, pointer('up', middle(1)));
    const pressAt = desk.puts.find((put) => put.page === 'content-1').event;
    check(
        "a press is put at its point from the page's top left",
        pressAt.x === 100 && pressAt.y === 100 - LAYOUT.DEFAULT_BAR.height,
        JSON.stringify(pressAt)
    );
    check(
        "the pages of the windows other seats hold are kept from the machine's keyboard, the local seat's own is not",
        desk.reserved.get('content-1') && desk.reserved.get('content-2') && !desk.reserved.get('content-3'),
        JSON.stringify([...desk.reserved])
    );

    const before = desk.puts.length;
    const held = desk.enter(you, pointer('down', middle(1)));
    desk.enter(you, pointer('up', middle(1)));
    const refused = (() => {
        try {
            return desk.enter(you, key('KeyZ'));
        } catch (error) {
            return error;
        }
    })();
    check(
        'a press on a window another seat holds reaches it and answers held and who holds it, and a key is refused',
        held.over === 1 &&
            held.key === 'held' &&
            held.holder === 's1' &&
            refused.kind === 'HELD' &&
            refused.stage === 'call' &&
            desk.puts.slice(before).every(({ event }) => event.event === 'pointer') &&
            desk.puts.length === before + 2,
        JSON.stringify({ held, refused: refused.kind, puts: desk.puts.slice(before) })
    );
    const localHeld = desk.enter(desk.seats.open[0], {
        ...pointer('down', { x: 5, y: 5 }),
        page: all[0].surface,
        carried: true,
    });
    check(
        "the machine's press in a window another seat holds comes in front and leaves the local seat's key window",
        localHeld.key === 'held' &&
            localHeld.holder === 's1' &&
            localKey() === 3 &&
            desk.desktop.control.windows().at(-1).id === 1 &&
            desk.puts.length === before + 2,
        JSON.stringify(localHeld)
    );

    desk.seats.idle.add('s1');
    const taken = desk.enter(you, pointer('down', middle(1)));
    const after = desk.enter(you, key('KeyY'));
    check(
        "an idle holder's window is taken: the press answers key, the holder is told, and it has no key window",
        taken.key === 'key' &&
            taken.holder === 's2' &&
            after.to === 1 &&
            JSON.stringify(desk.seats.held) === JSON.stringify([{ seat: 's1', window: 1, holder: 's2' }]) &&
            desk.enter(me, key('KeyA')).to === null,
        JSON.stringify({ taken, after, held: desk.seats.held })
    );
    desk.seats.idle.clear();

    desk.enter(me, pointer('down', middle(2)));
    desk.enter(me, pointer('up', middle(2)));
    const closing = desk.press('closeWindow', all[1].surface, 'of-s1');
    const open = () =>
        desk.desktop.control
            .windows()
            .map(({ id }) => id)
            .sort()
            .join();
    check(
        "a seat's close key closes its own key window, not the local seat's",
        closing === true && desk.closed.join() === '2' && localKey() === 3,
        JSON.stringify({ closing, closed: desk.closed, open: open() })
    );

    const frame = () => desk.desktop.control.windows().find((one) => one.id === 3).frame;
    const from = { ...frame() };
    const bar = { x: from.x + 100, y: from.y + 10 };
    const onBar = desk.enter(me, pointer('down', bar));
    desk.enter(me, pointer('move', { x: bar.x + 40, y: bar.y + 30 }, { buttons: [0] }));
    desk.enter(me, pointer('up', { x: bar.x + 40, y: bar.y + 30 }));
    check(
        "a seat's drag of a title bar moves the window, and its press there answers that the local seat holds it",
        onBar.over === 3 && onBar.key === 'held' && frame().x === from.x + 40 && frame().y === from.y + 30,
        JSON.stringify({ onBar, from, to: frame() })
    );
    const edge = { x: frame().x + frame().width + 2, y: frame().y + 100 };
    desk.enter(me, pointer('down', edge));
    desk.enter(me, pointer('move', { x: edge.x + 25, y: edge.y }, { buttons: [0] }));
    desk.enter(me, pointer('up', { x: edge.x + 25, y: edge.y }));
    check("a seat's drag of an edge resizes the window", frame().width === from.width + 25, JSON.stringify(frame()));

    const moved = desk.enter(me, pointer('move', { x: 3, y: 500 }));
    const nowhere = desk.enter(me, pointer('down', { x: 3, y: 500 }));
    check(
        'a move with no button reaches no page, and a press where no window is reaches the desktop',
        moved.over === null && nowhere.over === 'desktop',
        JSON.stringify({ moved, nowhere })
    );
    desk.dock.items = [{ id: 'a', pinned: true, running: true }];
    const tile = DOCK.tileOf(LAYOUT.desktopOf({ width: 1200, height: 800 }, 28), desk.dock.items, 'a');
    const item = { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
    desk.enter(me, pointer('move', { x: 600, y: 700 }));
    const under = desk.enter(me, pointer('down', item));
    desk.enter(me, pointer('up', item));
    desk.enter(me, pointer('move', { x: 2, y: item.y }));
    const onItem = desk.enter(me, pointer('down', item));
    desk.enter(me, pointer('up', item));
    desk.enter(me, pointer('down', item));
    desk.enter(me, pointer('up', { x: 600, y: 700 }));
    const left = desk.enter(me, pointer('down', item));
    desk.enter(me, pointer('up', item));
    check(
        "the Dock comes out for a seat as its pointer reaches the Dock's sliver, a click on an item there is that " +
            "seat's, and the Dock goes back in as its pointer leaves",
        under.over !== 'dock' &&
            onItem.over === 'dock' &&
            left.over !== 'dock' &&
            JSON.stringify(desk.dock.clicked) === '[["a","s1"]]',
        JSON.stringify({ under, onItem, left, clicked: desk.dock.clicked })
    );
    desk.dock.items = [];
    const refusedOf = (enter) => {
        try {
            return enter();
        } catch (error) {
            return error;
        }
    };
    const grabbed = middle(3);
    const rested = { ...desk.frameOf(3) };
    desk.enter(me, pointer('down', grabbed));
    desk.desktop.move(all[2], 'began', 0, 0, { x: 100, y: 100 });
    desk.desktop.move(all[2], 'changed', 40, 30);
    desk.enter(me, pointer('move', { x: grabbed.x + 40, y: grabbed.y + 30 }, { buttons: [0] }));
    desk.enter(me, pointer('up', { x: grabbed.x + 40, y: grabbed.y + 30 }));
    desk.desktop.move(all[2], 'ended', 40, 30);
    const [pressedAt, movedAt, letGoAt] = desk.puts.slice(-3).map(({ event }) => event);
    check(
        "a window its content's drag moves under a seat's press stays under the seat's pointer: its move and its up " +
            'are put where the pointer is in the page now',
        desk.frameOf(3).x === rested.x + 40 &&
            desk.frameOf(3).y === rested.y + 30 &&
            [movedAt, letGoAt].every(({ x, y }) => x === pressedAt.x && y === pressedAt.y),
        JSON.stringify({ rested, now: desk.frameOf(3), pressedAt, movedAt, letGoAt })
    );
    const side = { ...windowOf(9, 0), level: 'panel', edge: 'right', size: { width: 300, height: 100 } };
    desk.desktop.openPanel(side, { activates: false });
    const sideFrame = desk.desktop.control.panels().find(({ id }) => id === 9).frame;
    const inSide = { x: sideFrame.x + 20, y: sideFrame.y + 20 };
    const onSide = desk.enter(me, pointer('down', inSide));
    desk.enter(me, pointer('up', inSide));
    const toSide = desk.enter(me, key('KeyP'));
    const sideKey = desk.desktop.control.panels().find(({ id }) => id === 9).key;
    desk.enter(me, pointer('down', { x: 600, y: 780 }));
    desk.enter(me, pointer('up', { x: 600, y: 780 }));
    const toDesk = desk.enter(me, key('KeyQ'));
    check(
        "a seat's press in a panel window at the right edge gives that window its keyboard, not the machine's, until " +
            'it presses the desktop',
        onSide.over === 9 &&
            toSide.to === 9 &&
            desk.puts.some((put) => put.page === 'content-9' && put.source === 'of-s1' && put.event.code === 'KeyP') &&
            sideKey === false &&
            toDesk.to !== 9,
        JSON.stringify({ onSide, toSide, sideKey, toDesk })
    );
    const pressedBy = (seat, id) => {
        const answer = desk.enter(seat, pointer('down', middle(id)));
        desk.enter(seat, pointer('up', middle(id)));
        return answer.over === id && answer.key === 'key';
    };
    const others = desk.desktop.control
        .windows()
        .filter((one) => !one.key && !one.minimized)
        .map(({ id }) => id);
    const holds = { other: others.find((id) => pressedBy(you, id)) ?? null, local: localKey() };
    const toldKey = () =>
        [holds.other, holds.local].map((id) => desk.desktop.stateOf(all.find((window) => window.id === id) ?? {}).key);
    const told = [toldKey()];
    desk.enter(you, pointer('down', inSide));
    desk.enter(you, pointer('up', inSide));
    told.push(toldKey());
    desk.enter(you, pointer('down', { x: 600, y: 780 }));
    desk.enter(you, pointer('up', { x: 600, y: 780 }));
    told.push(toldKey());
    desk.desktop.orderFrontPanel(side);
    told.push([desk.desktop.stateOf(side).key, ...toldKey()]);
    desk.desktop.closePanel(side);
    told.push(toldKey());
    check(
        "a window's content is told key by the seat that holds it: a seat's keyboard on a panel window leaves that " +
            "seat's key window not key and every other seat's key, the machine's as an attached seat's",
        holds.other !== null &&
            holds.other !== holds.local &&
            told.join(' ') === 'true,true false,true true,true true,true,false true,true',
        JSON.stringify({ holds, told })
    );
    desk.desktop.control.hide();
    const count = desk.puts.length;
    const hidden = [pointer('down', grabbed), key('KeyH')].map((event) => refusedOf(() => desk.enter(me, event)));
    desk.desktop.control.show();
    check(
        "a seat's input while the host window is hidden is refused HIDDEN, and nothing is put",
        hidden.every(({ kind, stage }) => kind === 'HIDDEN' && stage === 'call') && desk.puts.length === count,
        JSON.stringify(hidden.map(({ kind }) => kind))
    );
    const listed = (id) => desk.desktop.control.windows().find((one) => one.id === id);
    const stood = { ...listed(1).frame };
    desk.pagePointer(1, 'bar', 'down', { x: 0, y: 0 }, { button: 2, grabX: 10, grabY: 10 });
    desk.pagePointer(1, 'bar', 'move', { x: 50, y: 0 });
    desk.pagePointer(1, 'bar', 'up', { x: 50, y: 0 }, { button: 2 });
    const front = desk.desktop.control.windows().at(-1).id;
    desk.pagePointer(1, 'minimize', 'down', { x: 0, y: 0 });
    desk.pagePointer(1, 'buttons', 'up', { x: 30, y: 0 });
    const missed = { ...listed(1) };
    desk.pagePointer(1, 'minimize', 'down', { x: 0, y: 0 });
    desk.pagePointer(1, 'minimize', 'up', { x: 0, y: 0 });
    check(
        "the pointer the desktop's page tells is recognized as a seat's is: a button is clicked as it is let go on " +
            'it, not off it, and another button than the first presses the window and moves nothing',
        front === 1 && !missed.minimized && missed.frame.x === stood.x && listed(1).minimized,
        JSON.stringify({ front, stood, missed, now: listed(1) })
    );
    desk.leave(you);
    check(
        'a seat that left is not at the desktop',
        (() => {
            try {
                desk.enter(you, key('KeyA'));
            } catch (error) {
                return error.kind === 'NOT_FOUND';
            }
        })(),
        ''
    );
}

function tilingChecks({ WM, LAYOUT, DOCK, MOTION, createDesktop }, check) {
    const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);
    const area = { x: 6, y: 28, width: 1195, height: 773 };
    const tiles = Object.fromEntries(LAYOUT.TILES.map((name) => [name, LAYOUT.tileOf(name, area)]));
    check(
        'the halves and the quarters split the zoom area flush, the left and top taking half rounded, the rest the ' +
            'other, and the whole tile is the zoom area',
        same(tiles.left, { x: 6, y: 28, width: 598, height: 773 }) &&
            same(tiles.right, { x: 604, y: 28, width: 597, height: 773 }) &&
            same(tiles['top-left'], { x: 6, y: 28, width: 598, height: 387 }) &&
            same(tiles['bottom-right'], { x: 604, y: 415, width: 597, height: 386 }) &&
            tiles['top-right'].x === tiles.right.x &&
            tiles['bottom-left'].y + tiles['bottom-left'].height === area.y + area.height &&
            same(tiles.fill, area),
        tiles
    );
    const drops = [
        [{ x: 6, y: 400 }, 'left'],
        [{ x: -40, y: 400 }, 'left'],
        [{ x: 1200, y: 400 }, 'right'],
        [{ x: 8, y: 40 }, 'top-left'],
        [{ x: 1199, y: 790 }, 'bottom-right'],
        [{ x: 600, y: 28 }, 'fill'],
        [{ x: 600, y: 10 }, 'fill'],
        [{ x: 30, y: 400 }, null],
        [{ x: 600, y: 60 }, null],
    ];
    const dropped = drops.map(([point]) => LAYOUT.dropAt(point, area));
    check(
        "a drag let go with the pointer at the zoom area's left or right side, or past it, takes that half, at a " +
            'corner along it that quarter, at its top the whole of it, and anywhere else none',
        drops.every(([, tile], at) => dropped[at] === tile),
        dropped
    );
    const all = ['top', 'bottom', 'left', 'right'];
    const other = { x: 400, y: 100, width: 300, height: 300 };
    const near = LAYOUT.snapped({ x: 95, y: 150, width: 300, height: 200 }, all, [other], area);
    const far = LAYOUT.snapped({ x: 85, y: 150, width: 300, height: 200 }, all, [other], area);
    const overlap = LAYOUT.snapped({ x: 106, y: 150, width: 300, height: 200 }, all, [other], area);
    check(
        "a window moved within LAYOUT.SNAP of a neighbour's facing edge lands on it, from either side, and further " +
            'away it follows as it is',
        LAYOUT.SNAP === 8 && near.x === 100 && overlap.x === 100 && far.x === 85 && near.y === 150,
        { near, far, overlap }
    );
    const aligned = LAYOUT.snapped({ x: 404, y: 405, width: 200, height: 100 }, all, [other], area);
    const edge = LAYOUT.snapped({ x: 10, y: 33, width: 200, height: 100 }, all, [], area);
    const apart = LAYOUT.snapped({ x: 95, y: 600, width: 300, height: 100 }, all, [other], area);
    check(
        "a window lines up with the side alike of one it meets across a gap, lands on the zoom area's edges, and " +
            'meets no window it is not beside',
        same(aligned, { x: 400, y: 400, width: 200, height: 100 }) &&
            same(edge, { x: 6, y: 28, width: 200, height: 100 }) &&
            apart.x === 95,
        { aligned, edge, apart }
    );
    const grown = LAYOUT.snapped({ x: 100, y: 150, width: 296, height: 200 }, ['right'], [other], area);
    const held = LAYOUT.snapped({ x: 100, y: 150, width: 296, height: 200 }, ['left'], [other], area);
    const least = LAYOUT.snapped({ x: 395, y: 150, width: 125, height: 200 }, ['left'], [other], area, {
        width: 130,
        height: 48,
    });
    check(
        'a resize moves only the sides it drags onto an edge they come near, the others where they are, never below ' +
            'the minimum',
        same(grown, { x: 100, y: 150, width: 300, height: 200 }) &&
            same(held, { x: 100, y: 150, width: 296, height: 200 }) &&
            least.x === 395,
        { grown, held, least }
    );

    const manager = WM.createWindowManager();
    manager.addSeat('me');
    const own = { x: 100, y: 100, width: 500, height: 400 };
    manager.open('me', 1, { frame: own, minimum: { width: 100, height: 50 } });
    manager.tile('me', 1, 'left', tiles.left);
    manager.tile('me', 1, 'top-right', tiles['top-right']);
    const tiled = manager.frameOf(1);
    manager.zoom('me', 1, area);
    const filled = manager.frameOf(1);
    manager.zoom('me', 1, area);
    check(
        'a tiled window is not zoomed, keeps the frame it had before its first tile, fills the zoom area as it ' +
            'zooms and goes back to its tile zoomed again',
        same(tiled, tiles['top-right']) &&
            same(filled, area) &&
            same(manager.frameOf(1), tiles['top-right']) &&
            manager.tileNameOf(1) === 'top-right' &&
            same(manager.standardFrameOf(1), own),
        { tiled, filled, back: manager.frameOf(1), kept: manager.standardFrameOf(1) }
    );
    const wider = { ...area, width: 1395 };
    manager.fitZoomed(wider, (name) => LAYOUT.tileOf(name, wider));
    const refit = manager.frameOf(1);
    manager.untile('me', 1);
    check(
        'a tiled window takes its tile again as the zoom area changes size, and leaves it for the frame it had',
        same(refit, LAYOUT.tileOf('top-right', wider)) && same(manager.frameOf(1), own) && !manager.tileNameOf(1),
        { refit, back: manager.frameOf(1) }
    );

    const from = { x: 0, y: 0, width: 400, height: 300, opacity: 1 };
    const to = { x: 600, y: 200, width: 800, height: 600, opacity: 1 };
    const motion = MOTION.motionOf({ from, to, role: 'move', now: 0 });
    const xs = [];
    for (let t = 0; t <= motion.length + 16; t += 4) xs.push(MOTION.motionAt(motion, t).value.x);
    const cut = MOTION.motionAt(motion, 60);
    const back = MOTION.motionOf({ from: cut.value, to: from, role: 'move', now: 60, velocity: cut.velocity });
    const onward = MOTION.motionOf({ from: cut.value, to, role: 'move', now: 60, velocity: cut.velocity });
    let past = 0;
    for (let t = 60; t <= 60 + onward.length; t += 2) past = Math.max(past, MOTION.motionAt(onward, t).value.x);
    check(
        "a window's frame moves by the move spring for its way, never past where it goes, and a motion cut short " +
            'starts the next from where it is drawn, its speed carried on',
        xs.every((x, at) => at === 0 || x >= xs[at - 1]) &&
            Math.max(...xs) <= 600 &&
            xs.at(-1) === 600 &&
            motion.length > 279 &&
            Math.abs(MOTION.motionAt(back, 60).value.x - cut.value.x) < 1e-9 &&
            MOTION.motionAt(back, 68).value.x > cut.value.x &&
            past <= 600,
        { length: motion.length, last: xs.at(-1), past, cut: cut.value.x }
    );
    const intoTile = MOTION.scaleInto({ x: 0, y: 0, width: 400, height: 300 }, { x: 8, y: 423, width: 48, height: 48 });
    check(
        'a window drawn into a rect is scaled alike both ways to fit inside it, centred in it, and one drawn into its ' +
            'own frame is drawn as it is',
        same(intoTile, { by: 0.12, x: 8, y: 429 }) && MOTION.scaleInto(from, from) === null,
        intoTile
    );
    const items = [
        { id: 'a', pinned: true, running: true },
        { id: 'b', pinned: false, running: true },
    ];
    const tileAt = DOCK.tileOf({ x: 0, y: 28, width: 1200, height: 772 }, items, 'b');
    const cardAt = DOCK.cardOf({ x: 0, y: 28, width: 1200, height: 772 }, items);
    const tall = DOCK.cardOf({ x: 0, y: 28, width: 1200, height: 100 }, items);
    check(
        "the Dock's card stands where its view lays it, centred down the desktop, no taller than the room in it",
        same(cardAt, { x: 0, y: 350, width: DOCK.WIDTH, height: 129 }) &&
            same(tall, { x: 0, y: 36, width: DOCK.WIDTH, height: 84 }),
        { cardAt, tall }
    );
    check(
        "a mod's Dock tile stands where the Dock's view lays it out, past the divider after the items kept",
        same(tileAt, { x: 8, y: 423, width: 48, height: 48 }) && DOCK.tileOf({ x: 0, y: 0 }, items, 'c') === null,
        tileAt
    );

    // The desktop over a clock of its own, the desktop's page telling it the system asks for no reduced motion.
    let now = 0;
    const due = [];
    const desk = desktopOver(createDesktop, { clock: { now: () => now, later: (next) => due.push(next) } });
    const run = (ms) => {
        for (let t = 0; t < ms; t += 8) {
            now += 8;
            due.splice(0).forEach((next) => next());
        }
    };
    const page = { name: 'page-a', mod: 'a' };
    const windowOf = (id) => ({
        id,
        mod: 'a',
        name: `w${id}`,
        level: 'normal',
        page,
        surface: { name: `content-${id}`, of: page },
        size: { width: 400, height: 300 },
        minimum: { width: 0, height: 0 },
        bar: LAYOUT.DEFAULT_BAR,
    });
    desk.fromPage('motion', { reduced: false });
    desk.desktop.control.show();
    const one = windowOf(1);
    desk.desktop.open(one);
    desk.openSurfaces(1);
    desk.desktop.press(one);
    const listed = () => desk.desktop.control.windows()[0].frame;
    const opening = { ...desk.frameOf(1) };
    const frameLayer = () => desk.laid().find(({ page: laid }) => laid.name === 'frame-1');
    const fading = frameLayer().opacity;
    const contentLayer = () => desk.laid().find(({ page: laid }) => laid.name === 'content-1');
    const growing = frameLayer().scale;
    // Where the scale draws the middle of the window's frame: where it is laid, scaled about it.
    const middleOf = ({ x, y, width, height }, { by, x: dx, y: dy }) => ({
        x: (x + width / 2) * by + dx,
        y: (y + height / 2) * by + dy,
    });
    const middle = growing && middleOf(opening, growing);
    run(400);
    check(
        'a window opens scaled from a little smaller about its middle and faded out, laid whole at its frame, its ' +
            'content and frame alike, and is drawn as laid once its motion is over, while the list reads that frame ' +
            'at once',
        same(opening, listed()) &&
            fading < 0.5 &&
            growing?.by >= 0.96 &&
            growing.by < 1 &&
            Math.abs(middle.x - (opening.x + 200)) < 0.1 &&
            Math.abs(middle.y - (opening.y + 150)) < 0.1 &&
            same(desk.frameOf(1), listed()) &&
            frameLayer().opacity === undefined &&
            frameLayer().scale === undefined &&
            contentLayer().scale === undefined,
        { opening, fading, growing, now: desk.frameOf(1), listed: listed() }
    );
    const before = listed();
    desk.press('tileLeft', one.surface);
    const zone = LAYOUT.zoomedIn(LAYOUT.desktopOf({ width: 1200, height: 800 }, 0));
    const leftTile = LAYOUT.tileOf('left', zone);
    const midway = () => desk.frameOf(1);
    run(40);
    const between = { ...midway() };
    run(400);
    check(
        'a shell key tiles the key window: the list has the tile at once, and its frame is drawn there by its motion',
        same(listed(), leftTile) &&
            between.x !== before.x &&
            between.x !== leftTile.x &&
            same(desk.frameOf(1), { ...leftTile }),
        { listed: listed(), between, drawn: desk.frameOf(1), leftTile }
    );
    desk.press('restoreWindow', one.surface);
    run(400);
    check('the restore key puts a tiled window back at its frame', same(listed(), before), listed());
    desk.press('tileRight', one.surface);
    run(400);
    const tileWidth = listed().width;
    desk.pagePointer(1, 'bar', 'down', { x: 0, y: 0 }, { grabX: 300, grabY: 20 });
    desk.pagePointer(1, 'bar', 'move', { x: -50, y: 30 });
    const pulled = listed();
    const grabbed = Math.round((300 * before.width) / tileWidth);
    check(
        'a tiled window dragged away is back at its size before, under the pointer where it was grabbed, drawn there ' +
            'at once',
        pulled.width === before.width &&
            pulled.height === before.height &&
            pulled.x + grabbed === LAYOUT.tileOf('right', zone).x + 300 - 50 &&
            same(desk.frameOf(1), pulled),
        { pulled, drawn: desk.frameOf(1) }
    );
    const pointer = LAYOUT.tileOf('right', zone).x + 300;
    desk.pagePointer(1, 'bar', 'move', { x: zone.x - pointer, y: 300 });
    const shown = desk.page().drop;
    desk.pagePointer(1, 'bar', 'move', { x: zone.x - pointer + 200, y: 300 });
    const hidden = desk.page().drop;
    desk.pagePointer(1, 'bar', 'move', { x: zone.x - pointer - 30, y: 300 });
    desk.pagePointer(1, 'bar', 'up', { x: zone.x - pointer - 30, y: 300 });
    check(
        "a window dragged with the pointer at the zoom area's left side shows the half it takes there, none away " +
            'from it, and takes it as it is let go',
        same(shown, { tile: 'left', frame: leftTile }) &&
            hidden === null &&
            desk.page().drop === null &&
            same(listed(), leftTile),
        { shown, hidden, now: desk.page().drop, listed: listed() }
    );
    run(400);
    desk.desktop.minimize(one);
    run(40);
    const going = frameLayer();
    const goingContent = contentLayer();
    run(400);
    check(
        "a window minimized goes on drawn into its mod's Dock tile, or where it is with none, laid whole at its " +
            'frame, until it is there, then is laid no more',
        !!going && same(goingContent?.scale, going.scale) && same(goingContent.rect, leftTile) && !frameLayer(),
        { going, goingContent }
    );
}

// How what a seat's devices did finds where it goes (model/routes.js), as plain data.
function routeChecks(ROUTING, check) {
    const { routeOf, placeOf, waits, hovers, raises } = ROUTING;
    check(
        'each kind of event has its route by the table, and what is no kind has none',
        ['pointer', 'key', 'text', 'act', undefined].map((event) => routeOf({ event })).join() ===
            'place,keyboard,keyboard,,' && routeOf(null) === null,
        JSON.stringify(ROUTING.ROUTES)
    );
    check(
        "a pointer's place is a point or a ref, never both and never neither",
        placeOf({ x: 1, y: 2 }) === 'point' &&
            placeOf({ ref: '4.2' }) === 'ref' &&
            [{}, { x: 1 }, { x: 1, y: 2, ref: '4.2' }, { ref: '' }, { x: '1', y: 2 }].every(
                (event) => placeOf(event) === null
            ),
        ''
    );
    check(
        "an event at a ref waits, and so does any that enters behind one that waits, but never the machine's own",
        waits({ ref: '4.2' }, false) &&
            waits({ x: 1, y: 2 }, true) &&
            !waits({ x: 1, y: 2 }, false) &&
            !waits({ carried: true }, true),
        ''
    );
    check(
        'a move at a ref with no button held hovers, and a window comes forward only where another covers the place',
        hovers({ type: 'move', ref: '4.2' }, []) &&
            !hovers({ type: 'move', ref: '4.2' }, [0]) &&
            !hovers({ type: 'move', x: 1, y: 2 }, []) &&
            !hovers({ type: 'down', ref: '4.2' }, []) &&
            raises(1, 3) &&
            !raises(1, 1) &&
            !raises(1, null) &&
            !raises(null, 3),
        ''
    );
}

// The levels of the desktop's stage (model/levels.js), as plain data: their order, what lies under the pages' overlays
// and what over them, and a level that takes the pointer for all over it.
function levelChecks(LEVELS, check) {
    const { ORDER, under, over, heldAt } = LEVELS;
    const named = (layers) => layers.map(({ page }) => page).join();
    const parts = {
        cursors: [{ page: 'cursors', input: [] }],
        views: [{ page: 'view' }],
        panels: [{ page: 'panel' }, { page: 'child', input: [{ x: 1, y: 1, width: 2, height: 2 }] }],
        desktop: [{ page: 'desktop', input: [{ x: 0, y: 0, width: 9, height: 3 }] }],
        glass: [{ material: 'popover' }],
        windows: [{ page: 'frame' }, { page: 'content' }, { page: 'buttons' }],
        backdrop: [{ page: 'backdrop' }],
        pages: [{ page: 'mod', input: [] }],
    };
    check(
        "the stage's levels are, from the bottom, the mods' pages, the backdrop, the windows, the glass, the desktop's " +
            "page, the panel windows at an edge, those under an anchor, the pages' overlays and the cursors",
        ORDER.join() === 'pages,backdrop,windows,glass,desktop,panels,views,overlays,cursors' && Object.isFrozen(ORDER),
        ORDER
    );
    check(
        "what lies under the pages' overlays is each level under them in order, a level's own layers as given, and " +
            'what lies over them is the cursors alone',
        named(under(parts)) === 'mod,backdrop,frame,content,buttons,,desktop,panel,child,view' &&
            under(parts)[5] === parts.glass[0] &&
            named(over(parts)) === 'cursors',
        { under: named(under(parts)), over: named(over(parts)) }
    );
    check(
        'a level left out lays nothing, and a part that is no level, or the overlays, is refused',
        named(under({ desktop: parts.desktop })) === 'desktop' &&
            over({ desktop: parts.desktop }).length === 0 &&
            [{ menus: [] }, { overlays: [] }].every((wrong) =>
                [under, over, (given) => heldAt(given, 'desktop', {})].every((asked) => {
                    try {
                        asked(wrong);
                        return false;
                    } catch {
                        return true;
                    }
                })
            ),
        ''
    );
    const full = { x: 0, y: 0, width: 9, height: 9 };
    const held = heldAt(parts, 'desktop', full);
    check(
        'a level held takes the pointer over the whole rect, every level over it nowhere, those under it as they did',
        JSON.stringify([...under(held), ...over(held)].map(({ input }) => input ?? null)) ===
            JSON.stringify([[], null, null, null, null, null, [full], [], [], [], []]) &&
            held.windows === parts.windows &&
            JSON.stringify(parts.desktop[0].input) === JSON.stringify([{ x: 0, y: 0, width: 9, height: 3 }]),
        held
    );
}

// The anchors a window's mod tells (deckit-sdk shell/window/model/anchor) and the views that stand under them
// (model/anchored), as plain data: the shape kept, whose an anchor is, a view's size held to its limits, its place
// under its anchor and inside the stage, and what stands as an anchor moves, goes or is another mod's.
function anchoredChecks({ ANCHOR, ANCHORED }, check) {
    const { VIEW, toldBy, isForeign, sizeOf, placeOf, standingOf } = ANCHORED;
    const rect = (x, y, width, height) => ({ x, y, width, height });
    const written = (value) => JSON.stringify(value);
    const told = [{ id: 'clock', rect: { ...rect(100, 2, 60, 16), more: 1 }, mod: 'clock', extra: true }];
    check(
        "the anchors a window's mod tells are kept as an id, a rect and the mod that may bind, and nothing else",
        written(ANCHOR.heldTo(told)) === written([{ id: 'clock', rect: rect(100, 2, 60, 16), mod: 'clock' }]) &&
            written(ANCHOR.heldTo([])) === '[]',
        ANCHOR.heldTo(told)
    );
    const wrong = [
        null,
        'clock',
        { id: 'clock' },
        [null],
        [{ id: 'clock', rect: rect(0, 0, 1, 1) }],
        [{ id: '', rect: rect(0, 0, 1, 1), mod: 'clock' }],
        [{ id: 7, rect: rect(0, 0, 1, 1), mod: 'clock' }],
        [{ id: 'clock', rect: rect(0, 0, -1, 1), mod: 'clock' }],
        [{ id: 'clock', rect: rect(0, NaN, 1, 1), mod: 'clock' }],
        [{ id: 'clock', rect: [0, 0, 1, 1], mod: 'clock' }],
        [{ id: 'x'.repeat(129), rect: rect(0, 0, 1, 1), mod: 'clock' }],
        [
            { id: 'clock', rect: rect(0, 0, 1, 1), mod: 'clock' },
            { id: 'clock', rect: rect(9, 0, 1, 1), mod: 'bell' },
        ],
    ];
    check(
        'anchors of another shape, or with an id named twice, are none',
        wrong.every((each) => ANCHOR.heldTo(each) === null),
        wrong.map((each) => ANCHOR.heldTo(each))
    );
    check(
        'a view binds by the mod that tells the anchor and its id, and another shape is no name',
        written(ANCHOR.nameOf({ mod: 'bar', id: 'clock', more: 1 })) === written({ mod: 'bar', id: 'clock' }) &&
            [null, 'bar', {}, { mod: 'bar' }, { mod: 'bar', id: '' }, { mod: 7, id: 'clock' }].every(
                (each) => ANCHOR.nameOf(each) === null
            ),
        ANCHOR.nameOf({ mod: 'bar', id: 'clock' })
    );

    // A stage 800 by 500 with the host's bar 28 high: the band of `bar` in it, a window of `app` under it.
    const bounds = { stage: { width: 800, height: 500 }, desktop: rect(0, 28, 800, 472) };
    const band = (content, anchors) => ({ id: 1, mod: 'bar', anchors, content, anchor: null, size: null });
    const items = [
        { id: 'clock', rect: rect(100, 2, 60, 16), mod: 'clock' },
        { id: 'bell', rect: rect(20, 2, 24, 16), mod: 'bell' },
    ];
    const inBar = band(rect(600, 4, 192, 20), items);
    const second = { id: 2, mod: 'bar', anchors: [{ id: 'clock', rect: rect(0, 0, 9, 9), mod: 'bell' }] };
    const all = toldBy([inBar, second]);
    check(
        'every anchor told is named by its mod and its id, and of one id a mod names in two windows the first stands',
        written(all.map(({ window, owner, id, mod }) => [window, owner, id, mod])) ===
            written([
                [1, 'bar', 'clock', 'clock'],
                [1, 'bar', 'bell', 'bell'],
            ]) && written(all[0].rect) === written(rect(100, 2, 60, 16)),
        all
    );
    check(
        'an anchor given to another mod is refused, and one given to the asker or told by no window is not',
        isForeign(all, { mod: 'bar', id: 'clock' }, 'bell') &&
            !isForeign(all, { mod: 'bar', id: 'clock' }, 'clock') &&
            !isForeign(all, { mod: 'bar', id: 'gone' }, 'bell') &&
            !isForeign(all, { mod: 'clock', id: 'clock' }, 'bell'),
        all
    );
    check(
        'a view is as wide as asked between 240 and 480 and as high as asked from 80 to the desktop less 16, and ' +
            'never wider than the stage less 16',
        written(sizeOf(bounds, { width: 100, height: 10 })) === written({ width: 240, height: 80 }) &&
            written(sizeOf(bounds, { width: 900, height: 900 })) === written({ width: 480, height: 456 }) &&
            written(sizeOf(bounds, { width: 320.4, height: 200.6 })) === written({ width: 320, height: 201 }) &&
            written(
                sizeOf(
                    { stage: { width: 200, height: 60 }, desktop: rect(0, 28, 200, 32) },
                    { width: 320, height: 200 }
                )
            ) === written({ width: 184, height: 16 }) &&
            VIEW.margin === 8 &&
            VIEW.radius === 12,
        sizeOf(bounds, { width: 900, height: 900 })
    );
    const size = { width: 320, height: 200 };
    const inWindow = placeOf(bounds, rect(300, 100, 40, 20), size);
    const inStrip = placeOf(bounds, rect(700, 6, 60, 16), size);
    check(
        'a view stands 8 under its anchor, their right edges in line, and one under an anchor in the bar 8 under ' +
            "the desktop's top",
        written(inWindow) === written(rect(20, 128, 320, 200)) && written(inStrip) === written(rect(440, 36, 320, 200)),
        { inWindow, inStrip }
    );
    const atRight = placeOf(bounds, rect(780, 6, 40, 16), size);
    const atLeft = placeOf(bounds, rect(0, 100, 20, 20), size);
    const low = placeOf(bounds, rect(400, 450, 50, 30), size);
    check(
        "a view is kept 8 inside the stage's sides and 8 above the desktop's bottom, over its anchor where no room " +
            'is under it',
        written(atRight) === written(rect(472, 36, 320, 200)) &&
            written(atLeft) === written(rect(8, 128, 320, 200)) &&
            written(low) === written(rect(130, 292, 320, 200)),
        { atRight, atLeft, low }
    );

    const view = (id, mod, anchor, anchors = []) => ({ id, mod, anchors, content: null, anchor, size });
    const ofClock = view(3, 'clock', { mod: 'bar', id: 'clock' });
    const stood = standingOf(bounds, [inBar, ofClock]);
    check(
        "an anchor stands on the stage at its rect from its window's content, and the view bound to it under it",
        written(stood.anchors.map(({ id, rect: at }) => [id, at])) ===
            written([
                ['clock', rect(700, 6, 60, 16)],
                ['bell', rect(620, 6, 24, 16)],
            ]) && written([...stood.frames]) === written([[3, rect(440, 36, 320, 200)]]),
        { anchors: stood.anchors, frames: [...stood.frames] }
    );
    const moved = standingOf(bounds, [band(rect(500, 4, 192, 20), items), ofClock]);
    const regrown = standingOf(bounds, [inBar, { ...ofClock, size: { width: 400, height: 300 } }]);
    check(
        'a view moves as its anchor does, and stands anew at the size it asks',
        written(moved.frames.get(3)) === written(rect(340, 36, 320, 200)) &&
            written(regrown.frames.get(3)) === written(rect(360, 36, 400, 300)),
        { moved: moved.frames.get(3), regrown: regrown.frames.get(3) }
    );
    const gone = standingOf(bounds, [band(rect(600, 4, 192, 20), [items[1]]), ofClock]);
    const away = standingOf(bounds, [band(null, items), ofClock]);
    check(
        'a view stands nowhere once its anchor is told no more, or while the window that tells it is not on the stage',
        gone.frames.size === 0 && gone.anchors.length === 1 && away.frames.size === 0 && away.anchors.length === 0,
        { gone: [...gone.frames], away: [...away.frames] }
    );
    const foreign = standingOf(bounds, [inBar, view(4, 'clock', { mod: 'bar', id: 'bell' })]);
    check(
        'a view bound to an anchor given to another mod stands nowhere',
        foreign.frames.size === 0 && foreign.anchors.length === 2,
        [...foreign.frames]
    );
    // The view of `clock` names an anchor in its own content for `bell`, whose view opened first; and two views
    // each bound to an anchor the other tells.
    const nested = view(3, 'clock', { mod: 'bar', id: 'clock' }, [
        { id: 'more', rect: rect(10, 20, 100, 30), mod: 'bell' },
    ]);
    const chained = standingOf(bounds, [inBar, view(2, 'bell', { mod: 'clock', id: 'more' }), nested]);
    const circled = standingOf(bounds, [
        view(5, 'a', { mod: 'b', id: 'one' }, [{ id: 'one', rect: rect(0, 0, 9, 9), mod: 'b' }]),
        view(6, 'b', { mod: 'a', id: 'one' }, [{ id: 'one', rect: rect(0, 0, 9, 9), mod: 'a' }]),
    ]);
    check(
        'an anchor a view tells stands once the view does, whichever opened first, and views bound to one another ' +
            'stand nowhere',
        written(chained.frames.get(2)) === written(rect(230, 94, 320, 200)) &&
            written(chained.anchors.at(-1).rect) === written(rect(450, 56, 100, 30)) &&
            circled.frames.size === 0 &&
            circled.anchors.length === 0,
        { chained: [...chained.frames], circled: [...circled.frames] }
    );
}

// The anchors the desktop keeps (desktop/main), over the stand-ins, on a stage 1200 by 800 under a bar 28 high: each
// on the stage where its window's content is, gone with its window; and a view under one: standing nowhere until its
// anchor is told, then under it, over the panel windows at an edge, for every seat, moving and going as the anchor
// does, held to its sizes, and refused an anchor given to another mod.
async function anchorChecks({ LAYOUT, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, mod, more = {}) => {
        const page = { name: `page-${mod}`, mod };
        return {
            id,
            mod,
            name: `w${id}`,
            level: 'normal',
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 200, height: 20 },
            minimum: { width: 0, height: 0 },
            bar: LAYOUT.DEFAULT_BAR,
            ...more,
        };
    };
    const rect = (x, y, width, height) => ({ x, y, width, height });
    const written = (value) => JSON.stringify(value);
    const anchors = () => desk.desktop.control.anchors();
    const titled = windowOf(1, 'a', {
        size: { width: 400, height: 300 },
        bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
    });
    desk.desktop.open(titled);
    desk.openSurfaces(1);
    const band = windowOf(2, 'bar', { level: 'panel' });
    desk.desktop.openPanel(band);
    const items = [{ id: 'clock', rect: rect(100, 2, 60, 16), mod: 'clock' }];
    desk.desktop.setAnchors(band, items);
    desk.desktop.setAnchors(titled, [{ id: 'field', rect: rect(10, 10, 80, 24), mod: 'a' }]);
    desk.desktop.setAnchors(windowOf(9, 'z'), [{ id: 'none', rect: rect(0, 0, 1, 1), mod: 'z' }]);
    const content = desk.frameOf(1);
    check(
        "an anchor stands on the stage at its rect from its window's content, a titled window's under its title bar, " +
            'and one told of a window that is not open is kept by nobody',
        written(anchors()) ===
            written([
                { window: 1, owner: 'a', id: 'field', rect: rect(content.x + 10, content.y + 10, 80, 24), mod: 'a' },
                { window: 2, owner: 'bar', id: 'clock', rect: rect(1092, 6, 60, 16), mod: 'clock' },
            ]) && content.y === desk.desktop.control.windows()[0].frame.y + LAYOUT.DEFAULT_BAR.height,
        { anchors: anchors(), content }
    );
    desk.desktop.setAnchors(band, [{ id: 'bell', rect: rect(20, 2, 24, 16), mod: 'bell' }]);
    desk.desktop.minimize(titled);
    check(
        'the anchors a mod tells stand in place of those it told before, and those of a window no seat has on screen ' +
            'stand nowhere',
        written(anchors().map(({ id, rect: at }) => [id, at])) === written([['bell', rect(1012, 6, 24, 16)]]),
        anchors()
    );
    desk.desktop.closePanel(band);
    desk.desktop.openPanel(band);
    check("a window's anchors go as it closes", anchors().length === 0, anchors());

    // A view of `clock` under the anchor `bar` names for it, opened before the anchor is told and before another
    // panel window in the bar.
    const view = windowOf(3, 'clock', {
        level: 'panel',
        edge: null,
        anchor: { mod: 'bar', id: 'clock' },
        size: { width: 320, height: 200 },
    });
    desk.desktop.openPanel(view, { activates: false });
    desk.desktop.openPanel(windowOf(4, 'z', { level: 'panel' }));
    const names = () => desk.laid().map(({ page }) => page?.name);
    const standsAt = () => desk.desktop.control.panels().find(({ id }) => id === 3)?.frame ?? null;
    const drawnAt = () => desk.page().panels.find(({ id }) => id === 3) ?? null;
    const nowhere = () => standsAt() === null && drawnAt() === null && !names().includes('content-3');
    const unbound = { nowhere: nowhere(), told: desk.desktop.stateOf(view) };
    check(
        'a view under an anchor no window tells stands nowhere: it is not laid, no material is drawn for it, and it ' +
            'is told it is not shown, at the size it would stand at',
        unbound.nowhere &&
            unbound.told.shown === false &&
            unbound.told.key === false &&
            unbound.told.width === 320 &&
            unbound.told.height === 200,
        unbound
    );
    desk.desktop.setAnchors(band, items);
    const laid = desk.laid().find(({ page }) => page?.name === 'content-3');
    const told = desk.desktop.stateOf(view);
    check(
        'a view stands under its anchor once that is told, 8 under the bar with their right edges in line, and is ' +
            'told it is shown and no title bar',
        written(standsAt()) === written(rect(832, 36, 320, 200)) &&
            written(laid?.rect) === written(standsAt()) &&
            told.shown === true &&
            told.key === false &&
            told.width === 320 &&
            told.height === 200 &&
            told.titleBar === null,
        { at: standsAt(), laid, told }
    );
    check(
        "a view's content is laid over the panel windows at an edge, cut to its corners, its overlay over the whole " +
            "stage and its material under it in the desktop's page",
        names().indexOf('content-3') > names().indexOf('content-4') &&
            names().indexOf('content-4') > names().indexOf('content-2') &&
            laid.clip.cornerRadius === 12 &&
            written(laid.spread) === written(rect(0, 0, 1200, 800)) &&
            written(drawnAt()) === written({ id: 3, edge: null, frame: standsAt(), radius: 12 }),
        { names: names(), laid, drawn: drawnAt() }
    );
    const other = desk.sit('s1');
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const before = desk.puts.length;
    await desk.enter(other, pointer('down', { x: 900, y: 100 }));
    await desk.enter(other, pointer('up', { x: 900, y: 100 }));
    const reached = desk.puts.slice(before).map(({ page }) => page);
    desk.desktop.pressPanel(view);
    check(
        'a view opened activating for nobody is laid for every seat: the press of any reaches its content, and its mod ' +
            'may activate for the seat that pressed',
        reached.join() === 'content-3,content-3' &&
            desk.desktop.activation.mayActivate('s1', 'clock') &&
            desk.desktop.activation.mayActivate(desk.desktop.localSeat, 'clock') &&
            desk.desktop.control.panels().every(({ key }) => key === false),
        reached
    );
    desk.leave(other);
    desk.desktop.setAnchors(band, [{ id: 'clock', rect: rect(40, 2, 60, 16), mod: 'clock' }]);
    const moved = standsAt();
    view.size = { width: 900, height: 900 };
    desk.desktop.update();
    check(
        'a view moves as its anchor does, and is held between its sizes as its mod asks another',
        written(moved) === written(rect(772, 36, 320, 200)) && written(standsAt()) === written(rect(612, 36, 480, 756)),
        { moved, resized: standsAt() }
    );
    const refused = [
        desk.desktop.refusesAnchor('bell', { mod: 'bar', id: 'clock' }),
        desk.desktop.refusesAnchor('clock', { mod: 'bar', id: 'clock' }),
        desk.desktop.refusesAnchor('bell', { mod: 'bar', id: 'gone' }),
    ];
    desk.desktop.setAnchors(band, [{ id: 'clock', rect: rect(40, 2, 60, 16), mod: 'bell' }]);
    const foreign = nowhere();
    desk.desktop.setAnchors(band, items);
    check(
        'an anchor given to another mod is refused a view, one given to its mod or told by no window is not, and a ' +
            "view whose anchor becomes another mod's stands nowhere until it is its own again",
        written(refused) === '[true,false,false]' && foreign && standsAt() !== null,
        { refused, foreign, at: standsAt() }
    );
    desk.desktop.setAnchors(band, []);
    const gone = { nowhere: nowhere(), shown: desk.desktop.stateOf(view).shown };
    desk.desktop.setAnchors(band, items);
    const back = standsAt();
    desk.desktop.closePanel(band);
    check(
        'a view goes as its anchor goes, stands again as it is told again, and goes with the window that tells it',
        gone.nowhere && gone.shown === false && back !== null && nowhere(),
        { gone, back, at: standsAt() }
    );
}

// What a seat reads of the desktop, over a reader that answers one document a page: the desktop, a window and a node
// as text and as data, what changed since a mark, a mark that is not kept, an act on a ref and a picture.
// What the desktop's page is told of the seats: each one's colour, where its pointer is and what it holds.
// The chips of the seats at the desktop's bottom right, as the model lays them.
// The showing rule (model/showing.js): on which seats' screens a view is after each thing that shows it and each that
// puts it away, and which seat holds its keyboard.
function showingChecks({ createShowing, KEY, HELD }, check) {
    const idle = new Set();
    const taken = [];
    const showing = createShowing({
        isIdle: (seat) => idle.has(seat),
        onTaken: (holder, view, by) => taken.push([holder, view, by].join()),
    });
    for (const seat of ['me', 'you']) showing.addSeat(seat);
    const on = (view) => ['me', 'you', 'late'].filter((seat) => showing.isOn(seat, view)).join();
    showing.open(1, { seat: 'you' });
    check(
        'a view opened is shown for the seat its mod acts for and no other, which holds its keyboard',
        on(1) === 'you' && showing.of('you') === 1 && showing.of('me') === null && showing.holderOf(1) === 'you',
        { on: on(1), holder: showing.holderOf(1) }
    );
    showing.open(2, { activates: false, seat: 'me' });
    showing.addSeat('late');
    check(
        'a view opened with activates false is shown for every seat, one that sits later too, and takes no keyboard',
        on(2) === 'me,you,late' && showing.of('me') === null && showing.holderOf(2) === null && showing.isShown(2),
        { on: on(2), holder: showing.holderOf(2) }
    );
    showing.removeSeat('late');
    for (const seat of ['me', 'nobody', null]) showing.show(1, seat);
    const second = { on: on(1), holder: showing.holderOf(1), take: showing.take('me'), held: showing.heldBy('me') };
    check(
        'a view shown again is shown for a second seat too and for no seat where its mod acts for none, and the ' +
            'second seat finds its keyboard held',
        second.on === 'me,you' && second.holder === 'you' && second.take === HELD && second.held === null,
        second
    );
    showing.toggle(1, 'me');
    const off = on(1);
    showing.toggle(1, 'me');
    const both = on(1);
    showing.toggle(1, 'you');
    const flipped = { off, both, on: on(1), holder: showing.holderOf(1), take: showing.take('me') };
    check(
        "a toggle puts a view away for one seat and shows it for that seat again, the other seat's screen left as it " +
            'is, so two seats each keep it by their own toggles, and its keyboard is given back by the holder it is ' +
            'put away for',
        flipped.off === 'you' &&
            flipped.both === 'me,you' &&
            flipped.on === 'me' &&
            flipped.holder === null &&
            flipped.take === KEY,
        flipped
    );
    showing.toggle(1, 'me');
    showing.toggle(1, 'you');
    const apart = on(1);
    for (const seat of [null, 'nobody']) showing.toggle(1, seat);
    const still = on(1);
    showing.toggle(1, 'you');
    showing.toggle(1, 'me');
    check(
        "a seat that put a view away does not get it by another seat's toggle, and a toggle for no seat does nothing",
        apart === 'you' && still === 'you' && on(1) === 'me' && showing.holderOf(1) === 'me',
        { apart, still, on: on(1), holder: showing.holderOf(1) }
    );
    showing.open(3);
    const unseen = showing.isShown(3);
    showing.show(3, 'me');
    check(
        'another view shown for a seat puts away the one it had, one a seat, and a view is shown from its first seat',
        !unseen && showing.isShown(3) && on(3) === 'me' && on(1) === '' && showing.holderOf(1) === null,
        { unseen, three: on(3), one: on(1) }
    );
    const spared = showing.pressed('me', [3]);
    const stays = on(3);
    const outside = showing.pressed('me', [1, 2]);
    check(
        'a press down a view is spared by leaves it, one outside puts it away for that seat, and it is shown to its ' +
            'last seat',
        spared === false && stays === 'me' && outside === true && on(3) === '' && !showing.isShown(3),
        { spared, stays, outside, on: on(3) }
    );
    showing.show(3, 'me');
    const away = [showing.putAway('me'), showing.putAway('me'), showing.heldBy('me'), showing.holderOf(3)];
    check(
        "a seat's view is put away as a window becomes its key window, at Escape, at Close Window and as it begins " +
            'to follow: once, its keyboard given back',
        JSON.stringify(away) === '[true,false,null,null]',
        away
    );
    for (const seat of ['me', 'you']) showing.show(3, seat);
    const gone = [showing.unanchored(3), on(3), showing.holderOf(3), showing.unanchored(3), showing.unanchored(2)];
    check(
        'a view whose anchor goes is put away for every seat it was shown for by activation, and one shown for ' +
            'every seat is left',
        JSON.stringify(gone) === '[true,"",null,false,false]' && on(2) === 'me,you',
        gone
    );
    for (const seat of ['me', 'you']) showing.show(1, seat);
    idle.add('me');
    const given = [showing.take('you'), showing.holderOf(1), taken.join(';'), showing.take('me')];
    idle.clear();
    check(
        'an idle holder gives the keyboard of a view up to the seat that takes it, and is told',
        JSON.stringify(given) === JSON.stringify([KEY, 'you', 'me,1,you', HELD]),
        given
    );
    showing.removeSeat('you');
    const left = [showing.holderOf(1), on(1), showing.take('me'), showing.take('you')];
    showing.close(1);
    showing.close(2);
    check(
        'a seat that leaves gives its keyboard back, and a view that closes is on no screen',
        JSON.stringify(left) === JSON.stringify([null, 'me', KEY, null]) &&
            showing.of('me') === null &&
            on(1) === '' &&
            on(2) === '' &&
            showing.take('me') === null,
        left
    );
}

// The desktop over stand-ins: a view under an anchor is on the screens it was shown for, is put away for a seat by
// each line of the rule, and its keyboard is one seat's.
async function viewChecks({ LAYOUT, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, mod, more = {}) => {
        const page = { name: `page-${mod}`, mod };
        return {
            id,
            mod,
            name: `w${id}`,
            level: 'normal',
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 200, height: 20 },
            minimum: { width: 0, height: 0 },
            bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
            ...more,
        };
    };
    const normal = windowOf(1, 'a', { size: { width: 300, height: 200 } });
    desk.desktop.open(normal);
    desk.openSurfaces(1);
    const band = windowOf(2, 'bar', { level: 'panel', edge: 'top' });
    desk.desktop.openPanel(band);
    desk.desktop.setAnchors(band, [
        { id: 'clock', rect: { x: 100, y: 2, width: 60, height: 16 }, mod: 'clock' },
        { id: 'bell', rect: { x: 20, y: 2, width: 24, height: 16 }, mod: 'bell' },
    ]);
    const viewOf = (id, mod) =>
        windowOf(id, mod, {
            level: 'panel',
            edge: null,
            anchor: { mod: 'bar', id: mod },
            size: { width: 320, height: 200 },
        });
    const view = viewOf(3, 'clock');
    const s1 = desk.sit('s1');
    const s2 = desk.sit('s2');
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const press = async (seat, at) => {
        const answer = await desk.enter(seat, pointer('down', at));
        await desk.enter(seat, pointer('up', at));
        return answer;
    };
    const key = (seat) => desk.enter(seat, { event: 'key', type: 'down', code: 'KeyA' });
    const refused = (ask) =>
        Promise.resolve()
            .then(ask)
            .then(
                () => null,
                (error) => error.kind
            );
    const onAnchor = { x: 1100, y: 10 }; // on the anchor `clock` in the band
    const inView = { x: 900, y: 100 };
    const outside = { x: 600, y: 700 }; // on the desktop, in no window
    // The seat's press in the front normal window there: its input reached that window's mod and no other.
    const elsewhere = (seat) => press(seat, { x: desk.frameOf(1).x + 10, y: desk.frameOf(1).y + 10 });
    // The mod `clock` asked by the band's mod after the seat's press on its anchor, as a command runs.
    const asks = async (seat) => {
        await press(seat, onAnchor);
        desk.request('bar', 'clock');
    };
    // The ids of the panel windows `seat` reads on the desktop.
    const reads = async (seat) => {
        const read = JSON.stringify(await desk.seats.served.read(seat, { of: 'desktop', format: 'json' }));
        return ['w2', 'w3', 'w5'].filter((id) => read.includes(`"${id}"`));
    };
    const on = async () => {
        const seats = [];
        for (const seat of [desk.seats.open[0], s1, s2]) if ((await reads(seat)).includes('w3')) seats.push(seat.id);
        return seats.join();
    };
    const drawn = () => desk.page().panels.some(({ id }) => id === 3);
    // Where the view's content is on the host's stage: 'over' the desktop, 'under' the backdrop taking no pointer, or
    // null.
    const laid = () => {
        const names = desk.laid().map(({ page }) => page?.name);
        const at = names.indexOf('content-3');
        if (at < 0) return null;
        if (at > names.indexOf('desktop')) return 'over';
        return at < names.indexOf('backdrop') && desk.laid()[at].input?.length === 0 ? 'under' : null;
    };
    const told = () => desk.desktop.stateOf(view);

    await asks(s1);
    desk.desktop.openPanel(view);
    const opened = { on: await on(), drawn: drawn(), laid: laid(), told: told(), over: await press(s1, inView) };
    const typed = await key(s1);
    check(
        "a view its mod opens after a seat's press is on that seat's screen alone: the local seat's does not draw it " +
            'and lays its content under the backdrop, the seat reads it, presses in it and types in it, and its ' +
            'content is told shown and key',
        opened.on === 's1' &&
            !opened.drawn &&
            opened.laid === 'under' &&
            opened.told.shown &&
            opened.told.key &&
            opened.over.over === 3 &&
            opened.over.key === 'key' &&
            opened.over.holder === 's1' &&
            typed.to === 3 &&
            desk.puts.at(-1).page === 'content-3',
        { ...opened, typed, put: desk.puts.at(-1) }
    );
    await asks(s2);
    desk.desktop.orderFrontPanel(view);
    const both = { on: await on(), over: await press(s2, inView), key: await refused(() => key(s2)) };
    check(
        "a view shown for a second seat is on its screen too, its keyboard the first seat's: the second's press " +
            'answers held and its key is refused HELD',
        both.on === 's1,s2' && both.over.key === 'held' && both.over.holder === 's1' && both.key === 'HELD',
        both
    );
    await press(s1, outside);
    const after = { on: await on(), key: await refused(() => key(s2)), holder: (await press(s2, inView)).holder };
    check(
        "a press down outside a view puts it away for that seat alone, and its keyboard is the other seat's to take",
        after.on === 's2' && after.key === null && after.holder === 's2' && told().shown && told().key,
        after
    );
    await press(s2, onAnchor);
    const spared = await on();
    await elsewhere(s1);
    desk.desktop.togglePanel(view);
    const off = { on: await on(), told: told() };
    await elsewhere(s2);
    await asks(s1);
    desk.desktop.togglePanel(view);
    const flipped = await on();
    check(
        'a press down on its anchor leaves a view, and a toggle puts it away where it is shown and shows it where ' +
            'it is not, told it is gone at the last seat and shown at the first',
        spared === 's2' && off.on === '' && !off.told.shown && !off.told.key && flipped === 's1' && told().shown,
        { spared, off, flipped }
    );
    const other = viewOf(5, 'bell');
    desk.request('clock', 'bell');
    desk.desktop.openPanel(other);
    const one = (await reads(s1)).join();
    desk.desktop.closePanel(other);
    check('another view shown for a seat puts away the one it had', one === 'w2,w5' && (await on()) === '', one);

    await asks(s1);
    desk.desktop.togglePanel(view);
    const escaped = [
        desk.unhandled(view.surface, 'KeyA', s1.source),
        desk.unhandled(normal.surface, 'Escape', s1.source),
        desk.unhandled(view.surface, 'Escape', s2.source),
        await on(),
        desk.unhandled(view.surface, 'Escape', s1.source),
        await on(),
        desk.unhandled(view.surface, 'Escape', s1.source),
    ];
    check(
        'Escape a view left unhandled puts it away for the seat that pressed it there, and no other key does',
        JSON.stringify(escaped) === JSON.stringify([false, false, false, 's1', true, '', false]),
        escaped
    );
    await asks(s1);
    desk.desktop.togglePanel(view);
    const closing = [await on(), desk.press('closeWindow', view.surface, s1.source), await on(), desk.closed.length];
    check(
        "Close Window puts a seat's view away and closes no window",
        JSON.stringify(closing) === JSON.stringify(['s1', true, '', 0]),
        closing
    );
    await asks(s1);
    desk.desktop.togglePanel(view);
    const before = await on();
    desk.request('clock', 'b');
    const second = windowOf(6, 'b', { size: { width: 300, height: 200 } });
    desk.desktop.open(second);
    desk.openSurfaces(6);
    check(
        "a window that becomes a seat's key window puts its view away",
        before === 's1' && (await on()) === '' && desk.desktop.control.windows().some(({ id }) => id === 6),
        { before, on: await on() }
    );
    await asks(s1);
    desk.desktop.togglePanel(view);
    const stood = await on();
    desk.desktop.setAnchors(band, []);
    const gone = { on: await on(), shown: told().shown };
    desk.desktop.setAnchors(band, [{ id: 'clock', rect: { x: 100, y: 2, width: 60, height: 16 }, mod: 'clock' }]);
    check(
        'a view is put away as its anchor goes, and is not back as the anchor is until it is shown again',
        stood === 's1' && gone.on === '' && !gone.shown && (await on()) === '' && !told().shown,
        { stood, gone, back: await on() }
    );

    // One seat a toggle: the one whose input reached the view's mod last.
    await elsewhere(s1);
    await press(s1, onAnchor);
    await asks(s2);
    desk.desktop.togglePanel(view);
    const toggled = [await on()];
    for (const seat of [s1, s1, s2, s2]) {
        await asks(seat);
        desk.desktop.togglePanel(view);
        toggled.push(await on());
    }
    check(
        'a toggle is for the seat whose input reached its mod last: of two seats that pressed the band the later ' +
            "alone is shown the view, each keeps it by its own toggle, one's toggle leaves the other's, and a seat " +
            "that put it away does not get it by another's",
        JSON.stringify(toggled) === JSON.stringify(['s2', 's1,s2', 's2', '', 's2']),
        toggled
    );
    await elsewhere(s1);
    await press(s2, outside);
    const put = await on();
    desk.desktop.togglePanel(view);
    desk.desktop.orderFrontPanel(view);
    check(
        'a press down on the desktop ends what a seat handed: the view it put away so is shown for it by no toggle ' +
            'and no request that follows no input',
        put === '' && (await on()) === '',
        { put, on: await on() }
    );

    // The local seat: the machine's keyboard goes to the view shown for it and comes back as it is put away.
    const hostShown = desk.hostShown();
    await elsewhere(s1);
    desk.desktop.pressPanel(band);
    desk.request('bar', 'clock');
    desk.desktop.togglePanel(view);
    const mine = {
        on: await on(),
        drawn: drawn(),
        laid: laid(),
        key: desk.desktop.isKey(view),
        focused: desk.focused.at(-1)?.name,
        host: desk.hostShown() - hostShown,
        active: desk.desktop.control.active(),
    };
    desk.pagePointer('s1', 'chip', 'down', { x: 0, y: 0 });
    desk.pagePointer('s1', 'chip', 'up', { x: 0, y: 0 });
    const followed = { following: desk.page().following?.id, on: await on(), key: desk.desktop.isKey(view) };
    check(
        "a view shown for the local seat is laid and drawn on its screen and takes the machine's keyboard, the host " +
            'window coming up, and is put away as the local seat begins to follow another',
        mine.on === 'local' &&
            mine.drawn &&
            mine.laid === 'over' &&
            mine.key &&
            mine.focused === 'content-3' &&
            mine.host === 1 &&
            mine.active === 'clock' &&
            followed.following === 's1' &&
            followed.on === '' &&
            !followed.key,
        { mine, followed }
    );
    desk.leave(s1);
    desk.leave(s2);
}

function chipChecks({ SEATS }, check) {
    const { CHIP, chipsOf, partAt } = SEATS;
    const stage = { width: 1200, height: 800 };
    const chips = chipsOf(stage, ['s1', 's2'], ['ada']);
    const [first, second, ask] = chips;
    const right = (rect) => rect.x + rect.width;
    check(
        'the chips stand at the bottom right, one over another from the bottom, one that asks last',
        chips.map(({ kind, id }) => kind + ' ' + id).join() === 'seat s1,seat s2,ask ada' &&
            chips.every(({ rect }) => right(rect) === stage.width - CHIP.margin && rect.height === CHIP.height) &&
            first.rect.y + first.rect.height === stage.height - CHIP.margin &&
            second.rect.y + second.rect.height === first.rect.y - CHIP.gap &&
            ask.rect.y + ask.rect.height === second.rect.y - CHIP.gap,
        chips
    );
    const inside = (inner, outer) =>
        inner.x >= outer.x &&
        inner.y >= outer.y &&
        right(inner) <= right(outer) &&
        inner.y + inner.height <= outer.y + outer.height;
    check(
        'a chip that asks has its two answers inside it, apart, Allow at its end',
        inside(ask.allow, ask.rect) && inside(ask.deny, ask.rect) && right(ask.deny) < ask.allow.x && !first.allow,
        ask
    );
    const middle = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 });
    const parts = [first.rect, second.rect, ask.allow, ask.deny, { ...ask.rect, width: 8 }, { x: 0, y: 0 }].map(
        (rect) => partAt(chips, rect.width ? middle(rect) : rect)
    );
    check(
        'a point is on the chip of a seat, on an answer of one that asks, or on neither',
        JSON.stringify(parts) ===
            JSON.stringify([
                { part: 'chip', id: 's1' },
                { part: 'chip', id: 's2' },
                { part: 'allow', id: 'ada' },
                { part: 'deny', id: 'ada' },
                null,
                null,
            ]),
        parts
    );
}

// A user that asks to sit, put to the local seat: the chip the page is told of, and whose press answers it.
async function askChecks({ SEATS, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const other = desk.sit('s1');
    const middle = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 });
    const chipsNow = () =>
        SEATS.chipsOf(
            { width: 1200, height: 800 },
            ['s1'],
            desk.page().asks.map(({ id }) => id)
        );
    // The machine's pointer, told as the environment tells it, in the desktop's page.
    const machine = async (type, at) => {
        const buttons = type === 'down' ? [0] : [];
        desk.carried({ event: 'pointer', type, ...at, button: 0, buttons, page: desk.desktopPage, carried: true });
        await new Promise((resolve) => setTimeout(resolve));
    };
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const asking = (id) => {
        const control = new AbortController();
        const asked = { control, answer: undefined };
        desk.seats.served.onAsk({ user: { id, name: id } }, { signal: control.signal }).then((answer) => {
            asked.answer = answer;
        });
        return asked;
    };
    const ada = asking('ada');
    const [, chip] = chipsNow();
    const input = desk.laid().find(({ page }) => page === desk.desktopPage).input;
    check(
        'a user that asks to sit is told to the page, and its chip takes the pointer',
        JSON.stringify(desk.page().asks) === JSON.stringify([{ id: 1, user: 'ada', name: 'ada' }]) &&
            chip.kind === 'ask' &&
            input.some((rect) => JSON.stringify(rect) === JSON.stringify(chip.rect)),
        [desk.page().asks, input]
    );
    const over = [
        desk.enter(other, pointer('down', middle(chip.allow))),
        desk.enter(other, pointer('up', middle(chip.allow))),
    ];
    await machine('down', middle(chip.allow));
    await machine('up', middle(chip.deny));
    await machine('down', middle({ ...chip.rect, width: 16 }));
    await machine('up', middle({ ...chip.rect, width: 16 }));
    check(
        "an attached seat's press on Allow answers nothing, nor does a press let go off the answer it began on",
        ada.answer === undefined && desk.page().asks.length === 1 && over.every((answer) => answer.over === 'desktop'),
        [ada.answer, over]
    );
    await machine('down', middle(chip.allow));
    await machine('up', middle(chip.allow));
    check(
        "the local seat's press on Allow answers yes, and the ask is over",
        ada.answer === true && desk.page().asks.length === 0,
        [ada.answer, desk.page().asks]
    );
    const [grace, late] = [asking('grace'), asking('late')];
    const [, denied] = chipsNow();
    await machine('down', middle(denied.deny));
    await machine('up', middle(denied.deny));
    const left = desk.page().asks.map(({ user }) => user);
    late.control.abort();
    check(
        "the local seat's press on Deny answers no, and an ask no answer is waited for goes",
        grace.answer === false && late.answer === undefined && left.join() === 'late' && desk.page().asks.length === 0,
        [grace.answer, late.answer, left, desk.page().asks]
    );
}

// The cursors' surface: laid over every level of the stage and over what the pages present, while more than one seat
// is at the desktop, taking the pointer nowhere.
async function cursorChecks({ LAYOUT, createDesktop }, check) {
    const menu = { name: 'menu' };
    const full = { x: 0, y: 0, width: 1200, height: 800 };
    // The content of window 1 presents a menu, its overlay laid over the whole stage.
    const overlays = (layers) =>
        layers.some(({ page }) => page?.name === 'content-1')
            ? [{ page: menu, rect: full, input: [{ x: 0, y: 400, width: 100, height: 100 }] }]
            : [];
    const desk = desktopOver(createDesktop, { overlays });
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, mod, level) => {
        const page = { name: `page-${mod}`, mod };
        return {
            id,
            mod,
            name: `w${id}`,
            level,
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 200, height: 20 },
            minimum: { width: 0, height: 0 },
            bar: LAYOUT.DEFAULT_BAR,
        };
    };
    desk.desktop.open(windowOf(1, 'a', 'normal'));
    desk.openSurfaces(1);
    desk.desktop.openPanel(windowOf(2, 'b', 'panel'));
    desk.openCursors();
    const names = () => desk.laid().map(({ page }) => page?.name);
    const alone = names();
    const other = desk.sit('s1');
    const laid = desk.laid();
    check(
        "the cursors' surface is laid while more than one seat is at the desktop, not for the local seat alone",
        !alone.includes('cursors') && names().includes('cursors'),
        { alone, laid: names() }
    );
    check(
        "the cursors' surface covers the stage over every window, the desktop's page, the panel windows and what a " +
            'page presents over itself, and takes the pointer nowhere',
        names().slice(-4).join() === 'desktop,content-2,menu,cursors' &&
            JSON.stringify(laid.at(-1).rect) === JSON.stringify(full) &&
            JSON.stringify(laid.at(-1).input) === '[]',
        { laid: names(), cursors: laid.at(-1) }
    );
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const panel = desk.desktop.control.panels()[0].frame;
    const onPanel = { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 };
    const before = desk.puts.length;
    await desk.enter(other, pointer('down', onPanel));
    await desk.enter(other, pointer('up', onPanel));
    const reached = desk.puts.slice(before).map(({ page }) => page);
    check(
        "a seat's press under the cursors' surface reaches what is laid under it",
        reached.join() === 'content-2,content-2',
        reached
    );
    desk.leave(other);
    check("the cursors' surface is taken off as the last other seat leaves", !names().includes('cursors'), names());
}

// The local seat follows another: the host window shows that seat's view until the local seat presses or types.
async function followChecks({ SEATS, LAYOUT, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, mod) => {
        const page = { name: `page-${mod}`, mod };
        return {
            id,
            mod,
            name: `w${id}`,
            level: 'normal',
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 200, height: 200 },
            minimum: { width: 0, height: 0 },
            bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
        };
    };
    const all = [windowOf(1, 'a'), windowOf(2, 'b')];
    for (const window of all) {
        desk.desktop.open(window);
        desk.openSurfaces(window.id);
    }
    desk.desktop.control.hand.move(1, 100 - desk.frameOf(1).x, 300 - desk.frameOf(1).y);
    desk.desktop.control.hand.move(2, 500 - desk.frameOf(2).x, 300 - desk.frameOf(2).y);
    const [other, third] = [desk.sit('s1'), desk.sit('s2')];
    const middle = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 });
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const inWindow = (id) => middle(desk.desktop.control.windows().find((one) => one.id === id).frame);
    desk.enter(other, pointer('down', inWindow(1)));
    desk.enter(other, pointer('up', inWindow(1)));
    const machine = async (event) => {
        desk.carried({ page: desk.desktopPage, ...event, carried: true });
        await new Promise((resolve) => setTimeout(resolve));
    };
    const press = async (at, page = desk.desktopPage) => {
        await machine({ event: 'pointer', type: 'down', ...at, button: 0, buttons: [0], page });
        await machine({ event: 'pointer', type: 'up', ...at, button: 0, buttons: [], page });
    };
    const chipOf = (seat, shown = 'local') => {
        const others = ['local', 's1', 's2'].filter((id) => id !== shown);
        return middle(SEATS.chipsOf({ width: 1200, height: 800 }, others, []).find(({ id }) => id === seat).rect);
    };
    const view = () => {
        const { windows, seats, dock, following } = desk.page();
        return [
            following?.id ?? '',
            windows.map(({ id, key }) => id + (key ? '*' : '')).join(),
            seats.find(({ shown }) => shown).id,
            dock.active,
        ].join(' ');
    };
    const own = view();
    desk.enter(third, pointer('down', chipOf('s1')));
    desk.enter(third, pointer('up', chipOf('s1')));
    check("an attached seat's press on a chip follows no one", view() === own && own === ' 1,2* local b', [
        own,
        view(),
    ]);
    await press(chipOf('s1'));
    const full = { x: 0, y: 0, width: 1200, height: 800 };
    const takes = desk.laid().filter(({ page, input }) => page && (!input || input.length));
    check(
        "the local seat's press on a seat's chip shows that seat's view: its order, its key window, its active mod",
        view() === 's1 2,1* s1 a' && desk.page().following.name === 's1' && desk.page().following.colour === 'green',
        [view(), desk.page().following]
    );
    check(
        "while it follows, the machine's pointer and keyboard reach the desktop's page alone",
        desk.focused.at(-1) === desk.desktopPage &&
            JSON.stringify(desk.laid().find(({ page }) => page === desk.desktopPage).input) ===
                JSON.stringify([full]) &&
            takes.at(-1).page === desk.desktopPage,
        [desk.focused.at(-1), takes.map(({ page }) => page.name)]
    );
    const before = desk.told().length;
    await machine({ event: 'pointer', type: 'move', x: 300, y: 300, buttons: [] });
    const toldLocal = desk.told().slice(before);
    check(
        "a move does not end it, and the local seat's pointer is told as any other seat's is",
        view().startsWith('s1 ') && toldLocal.length === 1 && toldLocal[0].id === 'local' && toldLocal[0].x === 300,
        [view(), toldLocal]
    );
    await press({ x: 5, y: 5 }, all[0].surface);
    check(
        "the local seat's press ends it and does no more: the view is its own again, as it left it",
        view() === own && desk.focused.at(-1)?.name === 'content-2',
        [view(), desk.focused.at(-1)]
    );
    await press(chipOf('s1'));
    const closedBefore = desk.closed.length;
    const taken = desk.press('closeWindow', all[1].surface);
    const held = desk.press('closeWindow', all[1].surface);
    await machine({ event: 'key', type: 'up', code: 'KeyW', key: 'w' });
    check(
        'a key of the shell ends it and does no more, until it is let go',
        taken === true && held === true && view() === own && desk.closed.length === closedBefore,
        [taken, held, view(), desk.closed]
    );
    await press(chipOf('s1'));
    await machine({ event: 'key', type: 'down', code: 'KeyA', key: 'a' });
    await machine({ event: 'key', type: 'up', code: 'KeyA', key: 'a' });
    const byKey = view();
    await press(chipOf('s1'));
    desk.leave(other);
    check('a key ends it, and so does the seat it follows leaving', byKey === own && view() === own, [byKey, view()]);
}

function drawnChecks({ COLOURS, LAYOUT, createDesktop }, check) {
    const colours = COLOURS.createColours(['one', 'two']);
    const took = ['a', 'b', 'c', 'd'].map(colours.take);
    colours.give('a');
    check(
        'a seat takes the first colour the fewest seats have, and gives it back as it leaves',
        took.join() === 'one,two,one,two' && colours.take('e') === 'one' && colours.of('a') === null,
        took
    );

    const desk = desktopOver(createDesktop, {});
    const page = { name: 'page-a', mod: 'a' };
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    desk.desktop.open({
        id: 1,
        mod: 'a',
        name: 'w1',
        level: 'normal',
        page,
        surface: { name: 'content-1', of: page },
        size: { width: 200, height: 200 },
        minimum: { width: 0, height: 0 },
        bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
    });
    desk.openSurfaces(1);
    const pointer = (type, at, more = {}) => ({ event: 'pointer', type, ...at, button: 0, count: 1, ...more });
    const [first, second] = [desk.sit('s1'), desk.sit('s2')];
    const coloursNow = () => desk.page().seats.map(({ id, colour }) => `${id} ${colour}`);
    const sat = coloursNow();
    desk.leave(first);
    const third = desk.sit('s3');
    check(
        'each seat has a colour as it sits, the local one too, and one that leaves gives its colour to the next',
        sat.join() === 'local blue,s1 green,s2 orange' && coloursNow().join() === 'local blue,s2 orange,s3 green',
        [sat, coloursNow()]
    );

    const states = desk.states();
    const held = desk.page().windows[0].holder;
    desk.enter(second, pointer('move', { x: 10, y: 20 }));
    const { x, y, width, height } = desk.frameOf(1);
    const middle = { x: x + width / 2, y: y + height / 2 };
    check(
        'a move of a seat that is not shown is told to the page by itself, with no state',
        JSON.stringify(desk.told()) === '[{"id":"s2","type":"move","x":10,"y":20,"buttons":[]}]' &&
            desk.states() === states,
        [desk.told(), desk.states() - states]
    );
    desk.enter(second, pointer('down', middle));
    desk.enter(third, pointer('scroll', { x: 5, y: 6 }, { dx: 0, dy: 40 }));
    desk.carried({ event: 'pointer', type: 'move', x: 1, y: 2 });
    const seats = Object.fromEntries(desk.page().seats.map((seat) => [seat.id, seat]));
    check(
        "the page's state has each seat's name, colour, pointer, held buttons, idleness and whether it is shown",
        JSON.stringify(seats.s2) ===
            JSON.stringify({
                id: 's2',
                name: 's2',
                colour: 'orange',
                at: middle,
                buttons: [0],
                idle: false,
                shown: false,
                typing: null,
            }) &&
            seats.local.shown &&
            seats.local.colour === 'blue',
        desk.page().seats
    );
    check(
        'a press and a scroll are told as they come, the buttons held after each, and the shown seat is not told',
        desk
            .told()
            .slice(1)
            .map(({ id, type, buttons, dy }) => [id, type, buttons.join('+'), dy ?? ''].join(' '))
            .join() === 's2 down 0 ,s3 scroll  40',
        desk.told()
    );
    check(
        "a window's holder is told by its colour, and none where no seat holds it",
        held === null && desk.page().windows[0].holder === 'orange',
        [held, desk.page().windows]
    );
    desk.enter(second, pointer('up', middle));
    desk.leave(second);
    check(
        'a button let go is held no more, and a seat that left is not in the state',
        desk.told().at(-1).buttons.length === 0 && !desk.page().seats.some(({ id }) => id === 's2'),
        [desk.told().at(-1), desk.page().seats]
    );
}

// Where a seat types, as the desktop's page is told it: read of the page its keys go to after its input and as the
// reader tells that the page changed, and gone with its key window.
async function typingChecks({ LAYOUT, createDesktop }, check) {
    const hearing = [];
    const asked = [];
    // What has the focus is at the left edge of its page, where the window in front of the first one is not over it.
    const caret = { x: 4, y: 42, width: 1, height: 16 };
    const focus = { rect: { x: 2, y: 40, width: 16, height: 40 }, caret };
    let answer = focus;
    const read = {
        listen: (handler) => hearing.push(handler),
        outline: async (page) => {
            asked.push(page.name);
            const lines = answer ? [{ depth: 0, role: 'textbox', states: ['focused'], ref: '1.1' }] : [];
            return { document: 1, count: 1, width: 200, height: 172, lines };
        },
        node: async () => answer,
    };
    const desk = desktopOver(createDesktop, { read });
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    for (const id of [1, 2]) {
        const page = { name: `page-${id}`, mod: `m${id}` };
        desk.desktop.open({
            id,
            mod: page.mod,
            name: `w${id}`,
            level: 'normal',
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 200, height: 200 },
            minimum: { width: 0, height: 0 },
            bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
        });
        desk.openSurfaces(id);
    }
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const seat = desk.sit('s1');
    const typing = () => desk.page().seats.find(({ id }) => id === 's1').typing;
    const read1 = () => new Promise((done) => setTimeout(done, 60));
    // The seat's press in the content of the window `id`, at its left edge or its right, where the other window, laid
    // a step down and across from it, is never over it.
    const pressIn = (id) => {
        const { x, y, width, height } = desk.frameOf(id);
        const at = { x: id === 1 ? x + 10 : x + width - 10, y: y + height / 2 };
        desk.enter(seat, pointer('down', at));
        desk.enter(seat, pointer('up', at));
    };
    pressIn(1);
    const before = typing();
    await read1();
    const content = desk.laid().find(({ page }) => page.name === 'content-1');
    const first = typing();
    const moved = (rect) => ({ ...rect, x: content.rect.x + rect.x, y: content.rect.y + rect.y });
    check(
        'where a seat types is told once its page is read after its press: the focus and its caret, on the stage',
        before === null &&
            asked.join() === 'content-1' &&
            JSON.stringify(first) ===
                JSON.stringify({ ring: moved(answer.rect), bars: [moved(caret)], caret: true, over: false }) &&
            desk.page().seats.find(({ id }) => id === 'local').typing === null,
        JSON.stringify({ before, asked, first, content: content?.rect })
    );
    const selected = [
        { x: 4, y: 42, width: 10, height: 16 },
        { x: 2, y: 58, width: 8, height: 16 },
    ];
    answer = { ...answer, selected };
    for (const handler of hearing) handler({ page: content.page, document: 1, count: 2 });
    await read1();
    const second = typing();
    answer = null;
    desk.enter(seat, { event: 'key', type: 'down', code: 'KeyA', key: 'a' });
    await read1();
    const third = typing();
    check(
        'what is selected is told as the reader tells that the page changed, and nothing once nothing has the focus',
        JSON.stringify(second?.bars) === JSON.stringify(selected.map(moved)) &&
            second.caret === false &&
            third === null,
        JSON.stringify({ second, third })
    );
    answer = { rect: { x: 2, y: 40, width: 100, height: 40 }, caret };
    desk.enter(seat, { event: 'key', type: 'down', code: 'KeyB', key: 'b' });
    await read1();
    const covered = typing();
    answer = focus;
    desk.enter(seat, { event: 'key', type: 'down', code: 'KeyC', key: 'c' });
    await read1();
    const back = typing();
    pressIn(2);
    const atOnce = typing();
    await read1();
    const other = desk.laid().find(({ page }) => page.name === 'content-2');
    check(
        "a seat's typing is told of no focus a window in front covers, is gone as its key window changes, and comes of the new one",
        covered === null &&
            back !== null &&
            atOnce === null &&
            asked.at(-1) === 'content-2' &&
            typing()?.ring.x === other.rect.x + 2 &&
            typing().ring.y === other.rect.y + 40,
        JSON.stringify({ covered, back, atOnce, asked, now: typing(), other: other?.rect })
    );

    // A view under an anchor lies over the desktop's page: where a seat types in it is drawn over everything.
    const panelOf = (id, mod, more) => {
        const page = { name: `page-${mod}`, mod };
        return {
            id,
            mod,
            name: `w${id}`,
            level: 'panel',
            page,
            surface: { name: `content-${id}`, of: page },
            size: { width: 320, height: 200 },
            minimum: { width: 0, height: 0 },
            bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
            ...more,
        };
    };
    const band = panelOf(3, 'bar', { edge: 'top', size: { width: 200, height: 20 } });
    desk.desktop.openPanel(band);
    desk.desktop.setAnchors(band, [{ id: 'clock', rect: { x: 100, y: 2, width: 60, height: 16 }, mod: 'clock' }]);
    const view = panelOf(4, 'clock', { edge: null, anchor: { mod: 'bar', id: 'clock' } });
    const inBand = desk.laid().find(({ page }) => page.name === 'content-3').rect;
    const onAnchor = { x: inBand.x + 110, y: inBand.y + 10 };
    await desk.enter(seat, pointer('down', onAnchor));
    await desk.enter(seat, pointer('up', onAnchor));
    desk.request('bar', 'clock');
    desk.desktop.openPanel(view);
    desk.enter(seat, { event: 'key', type: 'down', code: 'KeyD', key: 'd' });
    await read1();
    const unseen = typing();
    desk.desktop.pressPanel(band);
    desk.request('bar', 'clock');
    desk.desktop.orderFrontPanel(view);
    desk.enter(seat, { event: 'key', type: 'down', code: 'KeyE', key: 'e' });
    await read1();
    const inView = typing();
    const laidView = desk.laid().find(({ page }) => page.name === 'content-4')?.rect;
    check(
        'a seat that types in a view under an anchor is told as drawn over everything where the view is on the ' +
            'screen shown, and not at all where it is not',
        unseen === null &&
            asked.at(-1) === 'content-4' &&
            inView?.over === true &&
            inView.ring.x === laidView.x + 2 &&
            inView.ring.y === laidView.y + 40,
        JSON.stringify({ unseen, inView, laidView, asked: asked.at(-1) })
    );
}

async function readingChecks({ LAYOUT, createDesktop }, check) {
    const reader = { heard: null, counts: new Map(), asked: [] };
    const numberOf = (page) => Number(page.name.split('-')[1]) + 3;
    const field = (document, more = {}) => ({
        depth: 1,
        role: 'textbox',
        name: 'Line',
        states: ['focused', 'text 5'],
        ref: `${document}.2`,
        ...more,
    });
    const gone = () => Promise.reject(Object.assign(new Error('gone'), { code: 'GONE' }));
    const read = {
        listen: (handler) => (reader.heard = handler),
        outline: async (page, knobs) => {
            reader.asked.push({ page: page.name, knobs });
            const document = numberOf(page);
            const toolbar = { depth: 0, role: 'toolbar', name: 'Tools', states: [], items: 40, inView: 2 };
            const button = { depth: 1, role: 'button', name: 'A long na', length: 31, states: ['pressed'] };
            const lines = [
                { ...toolbar, ref: `${document}.1` },
                field(document),
                { ...button, ref: `${document}.3` },
                { depth: 1, role: 'group', states: [], below: 12, ref: `${document}.4` },
            ];
            return { document, count: reader.counts.get(page.name) ?? 1, width: 200, height: 172, lines };
        },
        node: async (page, ref) => {
            if (!ref.endsWith('.2')) return gone();
            const lines = [{ depth: 1, role: 'text', name: 'hello' }];
            return {
                document: numberOf(page),
                count: reader.counts.get(page.name) ?? 1,
                line: field(numberOf(page), { depth: 0 }),
                rect: { x: 10, y: 20, width: 100, height: 30 },
                scroll: { top: 0, height: 900, left: 0, width: 100 },
                lines,
                more: 17,
                selection: { line: 1, column: 5, length: 0 },
            };
        },
        changes: async (page, { document, count }) => {
            const now = reader.counts.get(page.name) ?? 1;
            if (count > now) throw Object.assign(new Error('stale'), { code: 'STALE' });
            const entries = [{ kind: '~', ...field(document, { states: ['focused', 'text 6'] }) }];
            return { document, from: count, count: now, entries: count < now ? entries : [] };
        },
        place: async () => ({ x: 10, y: 20, width: 100, height: 30 }),
    };
    const desk = desktopOver(createDesktop, { read });
    const page = { name: 'page-a', mod: 'a' };
    const bar = { ...LAYOUT.DEFAULT_BAR, enabled: { close: true, minimize: true, zoom: false } };
    const windowOf = (id, more = {}) => ({
        id,
        mod: 'a',
        name: `w${id}`,
        level: 'normal',
        page,
        surface: { name: `content-${id}`, of: page },
        size: { width: 200, height: 200 },
        minimum: { width: 0, height: 0 },
        bar,
        ...more,
    });
    desk.dock.items = [
        { id: 'a', name: 'A', pinned: true, running: true },
        { id: 'b', name: 'B', pinned: true, running: false },
    ];
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const all = [windowOf(1), windowOf(2, { title: 'Second', bar: { ...bar, style: 'titled' } })];
    for (const [at, window] of all.entries()) {
        desk.desktop.open(window);
        desk.openSurfaces(window.id);
        const frame = desk.frameOf(window.id);
        desk.desktop.control.hand.move(window.id, 100 + 400 * at - frame.x, 300 - frame.y);
    }
    const me = desk.sit('s1');
    const { served } = desk.seats;
    const refused = (promise) =>
        Promise.resolve(promise).then(
            () => null,
            ({ kind = null }) => kind
        );
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    desk.enter(me, pointer('down', { x: 200, y: 400 }));
    desk.enter(me, pointer('up', { x: 200, y: 400 }));

    const first = await served.read(me, { of: 'desktop' });
    const golden = [
        `desktop 1200x800 mark ${first.mark}`,
        'seat local "Local" blue key w2',
        'seat s1 "s1" green at 200,400 key w1 (you)',
        'dock (2 items)',
        '  item "A" [running, active] dock.a',
        '  item "B" dock.b',
        'window w1 "A" a at 100,300 200x200 [key s1]',
        'window w2 "Second" a at 500,252 200x200 [key local]',
    ].join('\n');
    check(
        'a seat reads the desktop: the seats, the Dock and the windows in its order',
        first.text === golden,
        first.text
    );
    const asData = await served.read(me, { of: 'desktop', format: 'json' });
    check(
        'the desktop as data is what its lines say',
        asData.mark === first.mark &&
            asData.data.windows.map(({ id, key }) => [id, key]).join() === 'w1,s1,w2,local' &&
            asData.data.seats[1].you === true &&
            asData.data.dock[0].ref === 'dock.a',
        JSON.stringify(asData)
    );

    const window = await served.read(me, { of: 'window', window: 'w1', depth: 4 });
    const outline = [
        `window w1 "A" a at 100,300 200x200 [key s1] mark ${window.mark}`,
        '  button "Close" w1.close',
        '  button "Minimize" w1.minimize',
        '  button "Zoom" [disabled] w1.zoom',
        '  titlebar w1.bar',
        '  document 4 content 200x172',
        '    toolbar "Tools" (40 items, 2 in view) 4.1',
        '      textbox "Line" [focused s1, text 5] 4.2',
        '      button "A long na…" (31) [pressed] 4.3',
        '      group (12 elements below) 4.4',
    ].join('\n');
    check(
        'a window reads as its parts and its documents, focused naming the seat, and the knobs reach the reader',
        window.text === outline && window.mark > first.mark && reader.asked.at(-1).knobs.depth === 4,
        window.text
    );
    const other = await served.read(me, { of: 'window', window: 'w2' });
    check(
        'a titled window lists its title bar, and focused names the seat whose keys go there',
        other.text.includes('  titlebar "Second" w2.bar\n') && other.text.includes('[focused local, text 5] 5.2'),
        other.text
    );
    const node = await served.read(me, { of: 'node', ref: '4.2' });
    const under = [
        'textbox "Line" [focused s1, text 5] 4.2 at 110,320 100x30 scroll 0 of 900',
        '  text "hello"',
        '  ... 17 more',
        '  selection 1:5',
    ].join('\n');
    const part = await served.read(me, { of: 'node', ref: 'w1.close' });
    check(
        'a node reads where it is on the desktop, its lines and its selection, a part of the shell as one line',
        node.text === under && /^button "Close" w1\.close at \d+,\d+ 12x12$/.test(part.text),
        `${node.text}\n${part.text}`
    );
    check(
        'a ref no document has, a window none has and a level there is none of are refused',
        (await refused(served.read(me, { of: 'node', ref: '99.1' }))) === 'GONE' &&
            (await refused(served.read(me, { of: 'node', ref: '4.9' }))) === 'GONE' &&
            (await refused(served.read(me, { of: 'window', window: 'w9' }))) === 'NOT_FOUND' &&
            (await refused(served.read(me, { of: 'all' }))) === 'INVALID_ARGUMENT',
        ''
    );

    const from = (await served.read(me, { of: 'desktop' })).mark;
    const quiet = await served.read(me, { of: 'changes', since: from });
    reader.counts.set('content-1', 2);
    reader.heard({ page: all[0].surface, document: 4, count: 2 });
    const typed = await served.read(me, { of: 'changes', since: from });
    check(
        'what changed after a typed line is one line, and nothing where nothing did',
        quiet.text === `changes ${from} to ${from}` &&
            typed.text === `changes ${from} to ${from + 1}\n~ textbox "Line" [focused s1, text 6] 4.2`,
        `${quiet.text}\n${typed.text}`
    );
    desk.desktop.control.hand.button(2, 'minimize');
    const you = desk.sit('s2');
    const moved = await served.read(me, { of: 'changes', since: typed.mark });
    check(
        'the lines of the desktop that read otherwise are told as the seat reads them, a new one as new',
        moved.text ===
            [
                `changes ${typed.mark} to ${moved.mark}`,
                '~ seat local "Local" blue',
                '+ seat s2 "s2" orange',
                '~ window w2 "Second" a at 500,252 200x200',
            ].join('\n'),
        moved.text
    );
    desk.leave(you);
    const left = await served.read(me, { of: 'changes', since: moved.mark });
    check('what went is told by its ref', left.text === `changes ${moved.mark} to ${left.mark}\n- s2`, left.text);
    for (let count = 9; count < 409; count++) {
        reader.counts.set('content-1', count);
        reader.heard({ page: all[0].surface, document: 4, count });
    }
    const old = await served.read(me, { of: 'changes', since: left.mark });
    check(
        'what changed since a mark 400 marks old is answered, and a mark the desktop never had refused STALE',
        old.mark - left.mark >= 400 &&
            old.text.split('\n').slice(1).join() === '~ textbox "Line" [focused s1, text 6] 4.2' &&
            (await refused(served.read(me, { of: 'changes', since: old.mark + 5 }))) === 'STALE' &&
            (await refused(served.read(me, { of: 'changes', since: -1 }))) === 'STALE',
        JSON.stringify({ left: left.mark, old })
    );

    desk.puts.length = 0;
    const entering = async (event) => desk.enter(me, event);
    const byRef = (type, ref) => entering({ ...pointer(type, {}), ref });
    const acted = await byRef('down', '4.2');
    const lifted = await desk.enter(me, pointer('up', acted.at));
    const after = await served.read(me, { of: 'desktop' });
    check(
        'a pointer event at a ref goes to the middle of what shows of it, answered as one at that point with the point',
        acted.over === 1 &&
            acted.key === 'key' &&
            JSON.stringify(acted.at) === '{"x":160,"y":335}' &&
            lifted.over === 1 &&
            after.text.includes('seat s1 "s1" green at 160,335 key w1 (you)') &&
            desk.puts
                .map(({ page: to, event, source }) => [to, event.type, event.x, event.y, source].join())
                .join(' ') === 'content-1,down,60,35,of-s1 content-1,up,60,35,of-s1',
        JSON.stringify({ acted, lifted, puts: desk.puts, text: after.text })
    );
    desk.puts.length = 0;
    const order = await Promise.all([byRef('down', '4.2'), desk.enter(me, pointer('up', { x: 160, y: 335 }))]);
    check(
        "a seat's events keep their order: one that enters while one at a ref is placed waits its turn",
        desk.puts.map(({ event }) => event.type).join() === 'down,up' && order[1].over === 1,
        JSON.stringify({ order, puts: desk.puts })
    );
    const onDock = await byRef('down', 'dock.b');
    await desk.enter(me, pointer('up', onDock.at));
    check(
        'a press at an item of the Dock, by its ref, is the click of the seat on it',
        onDock.over === 'dock' && desk.dock.clicked.map(String).join(' ') === 'b,s1',
        JSON.stringify({ onDock, clicked: desk.dock.clicked })
    );
    check(
        'a move at a ref with no button held, a place that is neither a point nor a ref, and a ref gone are refused',
        (await refused(byRef('move', '4.2'))) === 'REFUSED' &&
            (await refused(entering({ ...pointer('down', { x: 1, y: 1 }), ref: '4.2' }))) === 'INVALID_ARGUMENT' &&
            (await refused(entering(pointer('down', {})))) === 'INVALID_ARGUMENT' &&
            (await refused(entering({ event: 'act', ref: '4.2', action: 'press' }))) === 'INVALID_ARGUMENT' &&
            (await refused(byRef('down', 'w9.close'))) === 'GONE',
        ''
    );

    const whole = await served.read(me, { of: 'picture', scale: 2 });
    const one = await served.read(me, { of: 'picture', window: 'w1' });
    const element = await served.read(me, { of: 'picture', ref: '4.2' });
    const [, alone, inWindow] = desk.pictures;
    check(
        "a picture is of the desktop in the seat's order, of one window alone, or of what a ref names",
        whole.width === 2400 &&
            whole.height === 1600 &&
            whole.at.x === 0 &&
            one.width === 200 &&
            one.at.x === 100 &&
            alone.pages.join() === 'frame-1,content-1,buttons-1' &&
            element.width === 100 &&
            element.at.y === 320 &&
            inWindow.pages.join() === alone.pages.join() &&
            typeof whole.png === 'string' &&
            (await refused(served.read(me, { of: 'picture', window: 'w1', ref: '4.2' }))) === 'INVALID_ARGUMENT',
        JSON.stringify(desk.pictures)
    );

    // A third window opens over the first, in front of it for every seat.
    const cover = windowOf(3, { title: 'Cover', bar: { ...bar, style: 'titled' } });
    desk.desktop.open(cover);
    desk.openSurfaces(3);
    desk.desktop.control.hand.move(3, 100 - desk.frameOf(3).x, 300 - desk.frameOf(3).y);
    desk.puts.length = 0;
    const covered = desk.enter(me, pointer('down', { x: 160, y: 335 }));
    desk.enter(me, pointer('up', { x: 160, y: 335 }));
    const raised = await byRef('down', '4.2');
    await desk.enter(me, pointer('up', raised.at));
    check(
        "a press at a ref of a window another covers in the seat's order brings its window to the front and lands on it",
        covered.over === 3 &&
            raised.over === 1 &&
            raised.key === 'key' &&
            desk.puts.map(({ page: to, event }) => `${to},${event.type}`).join(' ') ===
                'content-3,down content-3,up content-1,down content-1,up',
        JSON.stringify({ covered, raised, puts: desk.puts })
    );
    const listed = await served.read(me, { of: 'window', window: 'w3' });
    const onBar = await byRef('down', 'w3.bar');
    await desk.enter(me, pointer('up', onBar.at));
    const front = desk.enter(me, pointer('down', { x: 160, y: 335 }));
    desk.enter(me, pointer('up', { x: 160, y: 335 }));
    check(
        "a window's bar is listed with a ref, and a press there brings the window forward",
        listed.text.includes('  titlebar "Cover" w3.bar\n') && onBar.over === 3 && front.over === 3,
        JSON.stringify({ listed: listed.text, onBar, front })
    );
}

// `createDesktop` over stand-ins: `state` what the shell kept. Mods `a` and `b` load, named `A` and `B`. A stage 1200
// by 800 lays the pages; `laid()` is what it laid last, `resize(size)` sizes it again. `openSurfaces(id)` has the
// desktop's page open window `id`'s frame and buttons, `openCursors()` the cursors' surface, and `overlays(layers)` is
// what the pages laid present over themselves; `fromPage(name, payload)` sends a desktop channel as that page:
// `pagePointer(id, part, type, point, more)` what the pointer does on a part of window `id` at a point of the screen,
// `pagePress(id)` a press on its frame let go there, and `pageFrames(id, frame)` the drags of its corners that leave
// it at `frame`. `page()` is what it was told last, and `press(id, page)` presses the shell's key `id` in `page`,
// which the page did not handle. `request(from, to)` is a request of one mod of another as deckit tells it,
// `key(page)` a key pressed in a page and `chord(mod)` a chord told to a mod. `read` is what reads a page, and
// `pictures` each picture the stage was asked for.
function desktopOver(createDesktop, { state = {}, clock, read = { listen() {} }, overlays = () => [] }) {
    const handlers = {};
    const sent = [];
    const titles = [];
    const focused = [];
    const allowed = new Map(); // a surface's name -> its onOpen
    const pressed = new Map(); // a page -> what hears it take the keyboard
    const children = { runs: [], laid: new Map() }; // the children's runs, and where the regions lay them
    let laid = [];
    let size = { width: 1200, height: 800 };
    let resized = () => {};
    const desktopPage = { name: 'desktop' };
    const closed = []; // the ids of the windows the desktop asked the shell's windows to close
    const heard = { requests: null, monitor: null, chords: null, press: null, carried: null };
    // The seats as deckit keeps them: the local one, those `sit` opens, what the desktop serves, the seats judged
    // idle, what a seat was told of a window held, each event put in a page and each page kept from the keyboard.
    const local = { id: 'local', local: true, user: { id: 'local', name: 'Local' }, source: 'of-local' };
    const seats = { open: [local], opened: null, closed: null, served: null, idle: new Set(), held: [], told: [] };
    const machine = [];
    const puts = [];
    const reserved = new Map();
    const dock = { items: [], clicked: [] }; // the Dock's items, and each click on one with the seat it is of
    const KEY = {
        start: (press) => (heard.press = press),
        listen() {},
        monitor: (handler) => (heard.monitor = handler),
        onChord: (listener) => (heard.chords = listener),
        onUnhandled: (handler) => (heard.unhandled = handler),
    };
    const mods = [
        { id: 'a', name: 'A', uses: {} },
        { id: 'b', name: 'B', uses: {} },
    ];
    const deckit = {
        channels: {
            bind: (declared) => ({
                handle: (handler) => (handlers[declared.channel] = handler),
                on: (handler) => (handlers[declared.channel] = handler),
                send: (page, payload) => sent.push({ channel: declared.channel, page, payload }),
            }),
        },
        log: { warn() {}, error() {} },
        seats: {
            local,
            list: () => seats.open,
            onOpen: (listener) => (seats.opened = listener),
            onClose: (listener) => (seats.closed = listener),
            isIdle: (seat) => seats.idle.has(seat.id),
            input: async (seat, event) => seats.served.input(seat, { ...event, source: seat.source }),
            serve: (answers) => {
                seats.served = answers;
                return {
                    tell: (seat, { of, ...told }) => {
                        seats.told.push({ seat: seat.id, of, ...told });
                        if (of === 'held') seats.held.push({ seat: seat.id, ...told });
                    },
                };
            },
        },
        config: { name: 'Deckit' },
        core: { onDown() {} },
        pages: { whenEnds() {} },
        mods: {
            list: () => mods,
            runs: () => children.runs,
            fieldsOf: () => ({}),
            modOf: (page) => page?.mod ?? null,
            onRequest: (listener) => (heard.requests = listener),
            notifications: [],
            onChange() {},
            observe() {},
        },
    };
    const PAGES = {
        open: (_name, { surfaces }) => {
            for (const name of surfaces.names) allowed.set(name, (surface) => surfaces.onOpen(name, surface));
            return desktopPage;
        },
        allowSurface: (_page, name, onOpen) => allowed.set(name, onOpen),
        whenFocused: (page, listener) => pressed.set(page, listener),
        isAlive: () => true,
        focus: (page) => focused.push(page),
        close() {},
    };
    const pictures = [];
    const stage = {
        // A picture that is only its header: a PNG's size is read from there.
        capture: async (layers, { rect, scale }) => {
            pictures.push({ pages: layers.map(({ page }) => page.name), rect, scale });
            const png = Buffer.alloc(24);
            png.writeUInt32BE(rect.width * scale, 16);
            png.writeUInt32BE(rect.height * scale, 20);
            return png;
        },
        whenResized: (listener) => (resized = listener),
        size: () => size,
        lay: (layers) => (laid = layers),
        show() {},
        // The top page of `layers` that takes the pointer at `point`, as a stage reads it.
        hit: (layers, point) => {
            for (const { page, rect, input } of [...layers].reverse()) {
                if (!rect) continue;
                const at = { x: point.x - rect.x, y: point.y - rect.y };
                const holds = (one) =>
                    at.x >= one.x && at.y >= one.y && at.x < one.x + one.width && at.y < one.y + one.height;
                if (holds({ ...rect, x: 0, y: 0 }) && (!input || input.some(holds))) return { page, ...at };
            }
            return null;
        },
    };
    let hostShown = 0;
    const desktop = createDesktop({
        REGION: {
            onChange() {},
            show() {},
            laidOut: (parent) => children.laid.get(parent) ?? new Map(),
            shownElsewhere: () => false,
        },
        PAGES,
        OVERLAY: {
            onChange() {},
            withOverlays: (layers) => [...layers, ...overlays(layers)],
            ownerOf: (page) => page,
        },
        KEY,
        makeStage: () => stage,
        actionOnDoubleClick: () => 'zoom',
        input: {
            listen: (handler) => (heard.carried = handler),
            put: (page, { source, ...event }) => puts.push({ page: page.name, event, source }),
            machine: (source) => machine.push(source),
        },
        reserve: (page, on) => reserved.set(page.name, on),
        read,
        deckit,
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => (state[key] = value),
        },
        web: { pageFor: () => null, onPage() {} },
        host: { show: () => (hostShown += 1), desktopTitled: (title) => titles.push(title) },
        ...(clock ? { clock } : {}),
    });
    desktop.start({
        WINDOWS: {
            close: (window) => {
                closed.push(window.id);
                desktop.close(window);
            },
            keyOverlay: () => null,
            pageOf: (page) => page.of ?? page,
        },
        DOCK: { items: () => dock.items, hand: { click: (id, seat) => dock.clicked.push([id, seat]) } },
    });
    const backdrop = { name: 'backdrop' };
    allowed.get('backdrop')(backdrop);
    const frameOf = (id) => laid.find(({ page }) => page.name === `content-${id}`)?.rect ?? null;
    const fromPage = (name, payload) => handlers[`deckit-shell:desktop-${name}`](payload, desktopPage);
    const pagePointer = (id, part, type, { x, y }, more = {}) =>
        fromPage('pointer', { id, part, type, x, y, button: 0, ...(type === 'down' ? { count: 1 } : {}), ...more });
    return {
        desktop,
        desktopPage,
        state,
        titles,
        focused,
        hostShown: () => hostShown,
        laid: () => laid,
        frameOf,
        children,
        pressIn: (page) => pressed.get(page)?.(),
        backdrop,
        resize: (next) => {
            size = next;
            resized();
        },
        openSurfaces: (id) => {
            for (const name of [`frame-${id}`, `buttons-${id}`]) allowed.get(name)({ name });
        },
        openCursors: () => allowed.get('cursors')({ name: 'cursors' }),
        fromPage,
        pagePointer,
        pagePress: (id) => {
            pagePointer(id, 'top', 'down', { x: 0, y: 0 });
            pagePointer(id, 'top', 'up', { x: 0, y: 0 });
        },
        pageFrames: (id, to) => {
            const drag = (part, dx, dy) => {
                pagePointer(id, part, 'down', { x: 0, y: 0 });
                pagePointer(id, part, 'move', { x: dx, y: dy });
                pagePointer(id, part, 'up', { x: dx, y: dy });
            };
            const now = () => desktop.control.windows().find((one) => one.id === id).frame;
            const [right, bottom] = [to.x + to.width, to.y + to.height];
            const corner = (x, y) => drag('bottom-right', x - now().x - now().width, y - now().y - now().height);
            corner(Math.max(right, now().x + now().width), Math.max(bottom, now().y + now().height));
            drag('top-left', to.x - now().x, to.y - now().y);
            corner(right, bottom);
        },
        page: () => sent.filter(({ channel }) => channel === 'deckit-shell:desktop-state').at(-1).payload,
        press: (id, page, from) => heard.press(id, page, from),
        // A seat deckit opens, what a seat's devices did as the entry hands it, and what the machine's did.
        sit: (id) => {
            const seat = { id, local: false, user: { id, name: id }, source: `of-${id}` };
            seats.open.push(seat);
            seats.opened(seat);
            return seat;
        },
        leave: (seat) => seats.closed(seat),
        enter: (seat, event) => seats.served.input(seat, { ...event, source: seat.source }),
        machine,
        carried: (event) => heard.carried(event),
        seats,
        closed,
        puts,
        told: () => sent.filter(({ channel }) => channel === 'deckit-shell:desktop-seat').map(({ payload }) => payload),
        states: () => sent.filter(({ channel }) => channel === 'deckit-shell:desktop-state').length,
        pictures,
        reserved,
        dock,
        request: (from, to) => heard.requests({ from, to }),
        key: (page) => heard.monitor(page, { code: 'KeyA' }),
        chord: (mod) => heard.chords(mod),
        // A key `page` left unhandled, pressed by the seat `source` is of: answers whether the desktop took it.
        unhandled: (page, code, source) => heard.unhandled(page, { code }, source),
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
