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
// title bar the shell draws, its title told and its drag. Exits 1 with a line for each check that failed. The packages
// are ES modules, so they are imported as such.
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
            parts.buttons.width === LAYOUT.TITLE_BAR.controlsWidth,
        parts
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
    desk.fromPage('press', { id: 1 });
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
    desk.fromPage('press', { id: 2 });
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
    desk.fromPage('press', { id: 2 });

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

    desk.fromPage('resize', { id: 2, phase: 'ended', x: 300, y: 200, width: 500, height: 400 });
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
        "the desktop's page takes the pointer at the host's bar and the Dock's sliver, and all of the Dock while it is out",
        sliver.length === 2 &&
            sliver[0].height === 28 &&
            sliver[1].width === DOCK.SLIVER &&
            sliver[1].y === 28 &&
            out[1].width === DOCK.WIDTH,
        { sliver, out }
    );

    desk.desktop.zoom(two);
    desk.resize({ width: 1400, height: 900 });
    check(
        'a zoomed window fills the desktop again as it changes size',
        JSON.stringify(desk.frameOf(2)) ===
            JSON.stringify({ x: DOCK.SLIVER, y: 28, width: 1400 - DOCK.SLIVER, height: 900 - 28 }),
        desk.frameOf(2)
    );

    desk.fromPage('resize', { id: 3, phase: 'ended', x: 1300, y: 700, width: 300, height: 200 });
    desk.resize({ width: 800, height: 500 });
    const smaller = LAYOUT.desktopOf({ width: 800, height: 500 }, 28);
    check(
        'as the desktop shrinks, a window not zoomed is moved where its title bar can be reached, and a zoomed one fills it',
        JSON.stringify(desk.frameOf(3)) ===
            JSON.stringify(LAYOUT.kept({ x: 1300, y: 700, width: 300, height: 200 }, smaller)) &&
            JSON.stringify(desk.frameOf(2)) === JSON.stringify(LAYOUT.zoomedIn(smaller)),
        [desk.frameOf(3), desk.frameOf(2)]
    );

    const four = { ...windowOf(4, 'b', 'web'), title: 'Site' };
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
            JSON.stringify(framed.input.at(-1)) === JSON.stringify(LAYOUT.titleBarOf(titledFrame)),
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
    desk.fromPage('move', { id: 4, phase: 'began', dx: 0, dy: 0 });
    desk.fromPage('move', { id: 4, phase: 'changed', dx: -10, dy: 5 });
    desk.fromPage('move', { id: 4, phase: 'ended', dx: -10, dy: 5 });
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} desktop checks`);
    process.exit(0);
}

// `createDesktop` over stand-ins: `state` what the shell kept. Mods `a` and `b` load, named `A` and `B`. A stage
// 1200 by 800 lays the pages; `laid()` is what it laid last, `resize(size)` sizes it again. `openSurfaces(id)` has the
// desktop's page open window `id`'s frame and buttons; `fromPage(name, payload)` sends a desktop channel as that
// page, `page()` is what it was told last, and `press(id, page)` presses the shell's key `id` in `page`, which
// the page did not handle. `request(from, to)` is a request of one mod of another as deckit tells it, `key(page)` a
// key pressed in a page and `chord(mod)` a chord told to a mod.
function desktopOver(createDesktop, { state = {} }) {
    const handlers = {};
    const sent = [];
    const titles = [];
    const focused = [];
    const allowed = new Map(); // a surface's name -> its onOpen
    let laid = [];
    let size = { width: 1200, height: 800 };
    let resized = () => {};
    const desktopPage = { name: 'desktop' };
    const heard = { requests: null, monitor: null, chords: null, press: null };
    const KEY = {
        start: (press) => (heard.press = press),
        listen() {},
        monitor: (handler) => (heard.monitor = handler),
        onChord: (listener) => (heard.chords = listener),
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
        config: { name: 'Deckit' },
        core: { onDown() {} },
        pages: { whenEnds() {} },
        mods: {
            list: () => mods,
            runs: () => [],
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
        whenFocused() {},
        isAlive: () => true,
        focus: (page) => focused.push(page),
        close() {},
    };
    const stage = {
        whenResized: (listener) => (resized = listener),
        size: () => size,
        lay: (layers) => (laid = layers),
        show() {},
    };
    let hostShown = 0;
    const desktop = createDesktop({
        REGION: { onChange() {}, show() {}, laidOut: () => new Map(), shownElsewhere: () => false },
        PAGES,
        OVERLAY: { onChange() {}, withOverlays: (layers) => layers, ownerOf: (page) => page },
        KEY,
        makeStage: () => stage,
        actionOnDoubleClick: () => 'zoom',
        deckit,
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => (state[key] = value),
        },
        web: { pageFor: () => null },
        host: { show: () => (hostShown += 1), desktopTitled: (title) => titles.push(title) },
    });
    desktop.start({
        WINDOWS: {
            close: (window) => desktop.close(window),
            keyOverlay: () => null,
            pageOf: (page) => page.of ?? page,
        },
        DOCK: { items: () => [] },
    });
    allowed.get('backdrop')({ name: 'backdrop' });
    const frameOf = (id) => laid.find(({ page }) => page.name === `content-${id}`)?.rect ?? null;
    return {
        desktop,
        desktopPage,
        state,
        titles,
        focused,
        hostShown: () => hostShown,
        laid: () => laid,
        frameOf,
        resize: (next) => {
            size = next;
            resized();
        },
        openSurfaces: (id) => {
            for (const name of [`frame-${id}`, `buttons-${id}`]) allowed.get(name)({ name });
        },
        fromPage: (name, payload) => handlers[`deckit-shell:desktop-${name}`](payload, desktopPage),
        page: () => sent.filter(({ channel }) => channel === 'deckit-shell:desktop-state').at(-1).payload,
        press: (id, page) => heard.press(id, page),
        request: (from, to) => heard.requests({ from, to }),
        key: (page) => heard.monitor(page, { code: 'KeyA' }),
        chord: (mod) => heard.chords(mod),
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
