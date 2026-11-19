// The desktop's window manager (deckit-shell/shell/desktop/model/window-manager): the windows every seat shares and
// each seat's own order, key window and minimized windows, a window opened right behind each seat's key window, a
// window another seat holds left to it, the key window passed on as one closes or is minimized, a window ordered behind
// the key window, and a frame no smaller than its minimum; which mods may activate for a seat (model/activation): the
// mod its input reaches and those asked along the chain, until its next input, and the mods that ask for its attention;
// and where windows go (model/layout): a new one cascaded from the key window or centred, a restored one kept
// reachable, a resize held to the minimum, a drag kept under the host's strip as it goes, zoom to the desktop but the
// Dock's sliver, and the frame's parts; a seat's camera (model/camera): where it opens, its size, a pan, the points it
// reaches, the move to a window made key and what is laid on its screen; and the desktop (desktop/main) over stand-ins for what connect answers, the
// shell's pages and a stage: the pages laid in the local seat's order, no window key at start, the keyboard and the
// host's title following its key window, a window brought forward in front and key, the host window coming up, only by
// a mod that may activate, and right behind the key window, its mod asking for attention, by one that may not, a window
// ordered front or opened without taking the keyboard, the shell's keys, a frame restored and remembered by the
// window's name, a mod's windows brought in front for a seat from the Dock, the Dock's pointer room, a zoomed window
// and any other keeping its frame as the host window changes size, and a titled window's content under the
// title bar the shell draws, its title told and its drag, and the panel windows in the host's bar: placed right to left
// in the order they opened, laid over the desktop's page, told no title bar, never key, pressed with the key window
// left key, whatever edge it names; and the anchors a window's mod tells, with the panel
// windows that stand under them. Exits 1 with a line for each check that failed. The packages are ES modules, so they
// are imported as such.
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const WM = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'window-manager.js'));
    const ACTIVATION = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'activation.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'layout.js'));
    const CAMERA = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'camera.js'));
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
    const inCamera = LAYOUT.desktopOf({ x: 50, y: -200, width: 1000, height: 700 }, 40);
    check(
        "the desktop of a camera is the camera under the host's strip",
        JSON.stringify(inCamera) === JSON.stringify({ x: 50, y: -160, width: 1000, height: 660 }),
        inCamera
    );

    // A seat's camera, a rect of the desktop plane (model/camera).
    const camera = { x: 0, y: 0, width: 1280, height: 800 };
    const later = CAMERA.opened({ x: 30, y: 700, width: 1280, height: 800 });
    check(
        "a seat's camera opens at the local seat's camera's top left",
        JSON.stringify(later) === JSON.stringify({ x: 30, y: 700 }),
        later
    );
    const panned = CAMERA.panned(camera, 0, 100);
    check(
        'a scroll on the desktop moves the camera by its dx, dy',
        JSON.stringify(panned) === JSON.stringify({ x: 0, y: 100, width: 1280, height: 800 }),
        panned
    );
    const scrolls = [
        CAMERA.scrolled(camera, { x: 100, y: 300 }, { dx: 20, dy: -40 }, 28),
        CAMERA.scrolled(camera, { x: 100, y: 10 }, { dx: 20, dy: -40 }, 28),
        CAMERA.scrolled(camera, { x: 100, y: 900 }, { dx: 20, dy: -40 }, 28),
        CAMERA.scrolled(camera, { x: 100, y: 300 }, { dx: 0, dy: 0 }, 28),
    ];
    check(
        "a scroll on the desktop pans the camera, and one in the bar's band, outside the camera or of nothing does not",
        JSON.stringify(scrolls[0]) === JSON.stringify({ x: 20, y: -40, width: 1280, height: 800 }) &&
            scrolls.slice(1).every((one) => one === camera),
        scrolls
    );
    const resizedCamera = CAMERA.sized(panned, { width: 1000, height: 600 });
    check(
        "a screen's resize sizes its camera and keeps its top left",
        JSON.stringify(resizedCamera) === JSON.stringify({ x: 0, y: 100, width: 1000, height: 600 }),
        resizedCamera
    );
    check(
        "a screen's size is whole numbers of 1 or more",
        CAMERA.isScreen({ width: 1, height: 600 }) &&
            ![{ width: 0, height: 600 }, { width: 10.5, height: 6 }, { width: 10 }, { width: '10', height: 6 }].some(
                CAMERA.isScreen
            ),
        ''
    );
    check(
        'a point outside a camera reaches nothing, one in it does',
        CAMERA.reaches(panned, { x: 100, y: 150 }) &&
            !CAMERA.reaches(panned, { x: 100, y: 50 }) &&
            !CAMERA.reaches(panned, { x: 1280, y: 150 }),
        ''
    );
    check(
        'a frame meets a camera where some of it is in it',
        CAMERA.meets(panned, { x: 283, y: 50, width: 720, height: 51 }) &&
            !CAMERA.meets(panned, { x: 283, y: 900, width: 720, height: 480 }) &&
            !CAMERA.meets(panned, { x: -720, y: 150, width: 720, height: 480 }),
        ''
    );
    const away = { x: 0, y: 1000, width: 1280, height: 800 };
    const zoomOf = (one) => LAYOUT.zoomedIn(LAYOUT.desktopOf(one, 0));
    const main = { x: 283, y: 107, width: 720, height: 480 };
    const toMain = CAMERA.brought(away, main, zoomOf(away));
    check(
        'a window made key out of reach moves the camera the least way that brings it whole into the zoom area',
        JSON.stringify(toMain) === JSON.stringify({ x: 0, y: 107, width: 1280, height: 800 }),
        toMain
    );
    const below = CAMERA.brought(camera, { x: -100, y: 700, width: 300, height: 400 }, zoomOf(camera));
    check(
        'the camera moves across and down each on its own, to the frame left of it and below it',
        JSON.stringify(below) === JSON.stringify({ x: -106, y: 300, width: 1280, height: 800 }),
        below
    );
    const longer = CAMERA.brought(camera, { x: 2000, y: 2000, width: 2000, height: 300 }, zoomOf(camera));
    check(
        "along a way the frame is longer than the zoom area, its left goes to the zoom area's",
        JSON.stringify(longer) === JSON.stringify({ x: 1994, y: 1500, width: 1280, height: 800 }),
        longer
    );
    const still = CAMERA.brought(camera, main, zoomOf(camera));
    check('a frame whole in the zoom area moves no camera', JSON.stringify(still) === JSON.stringify(camera), still);
    const followed = CAMERA.centredOn({ x: 100, y: 100, width: 1000, height: 600 }, { width: 1280, height: 800 });
    check(
        "a camera of the host window's size is centred on the camera of the seat it follows",
        JSON.stringify(followed) === JSON.stringify({ x: -40, y: 0, width: 1280, height: 800 }),
        followed
    );
    const laid = CAMERA.laidOn(panned, [
        { page: 1, rect: { x: 283, y: 107, width: 720, height: 480 }, clip: { x: 283, y: 107, width: 10, height: 10 } },
        { page: 2, rect: { ...panned }, spread: { ...panned }, input: [{ x: 0, y: 0, width: 6, height: 800 }] },
    ]);
    check(
        "what is laid at the plane's rects is laid on a screen less its camera's top left, input as it is",
        JSON.stringify(laid) ===
            JSON.stringify([
                {
                    page: 1,
                    rect: { x: 283, y: 7, width: 720, height: 480 },
                    clip: { x: 283, y: 7, width: 10, height: 10 },
                },
                {
                    page: 2,
                    rect: { x: 0, y: 0, width: 1280, height: 800 },
                    spread: { x: 0, y: 0, width: 1280, height: 800 },
                    input: [{ x: 0, y: 0, width: 6, height: 800 }],
                },
            ]),
        laid
    );
    const onScreen = CAMERA.onScreen(panned, { x: 100, y: 150 });
    const onPlane = CAMERA.onPlane(panned, onScreen);
    check(
        "a point of the plane is on a screen less its camera's top left, and back",
        onScreen.y === 50 && onPlane.y === 150 && onPlane.x === 100,
        [onScreen, onPlane]
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
    const zoomedFrame = desk.frameOf(2);
    desk.resize({ width: 1400, height: 900 });
    check(
        "a zoomed window keeps its frame as the host window, the local seat's camera, changes size",
        JSON.stringify(desk.frameOf(2)) === JSON.stringify(zoomedFrame),
        desk.frameOf(2)
    );

    desk.pageFrames(3, { x: 1300, y: 700, width: 300, height: 200 });
    desk.resize({ width: 800, height: 500 });
    check(
        'as the host window shrinks, a frame out of reach stays where it is, and a zoomed one too',
        JSON.stringify(desk.frameOf(3)) === JSON.stringify({ x: 1300, y: 700, width: 300, height: 200 }) &&
            JSON.stringify(desk.frameOf(2)) === JSON.stringify(zoomedFrame),
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
    // A mod whose one window is a panel window, beside two whose front window is a normal one.
    const lonePanel = panelOf(23, 'c', { width: 40, height: 20 });
    desk.desktop.openPanel(lonePanel);
    const spreads = Object.fromEntries(
        desk
            .laid()
            .filter(({ page }) => /^(page|content)-/.test(page.name))
            .map(({ page, rect, spread = null }) => [page.name, { rect, spread }])
    );
    desk.desktop.closePanel(lonePanel);
    check(
        'a page whose front window is a panel window is laid at that panel with its overlay over the whole stage, ' +
            'what it presents not cut to the panel; a page with a normal window in front, and a content, has none',
        JSON.stringify(spreads['page-c']) ===
            JSON.stringify({
                rect: { x: 576, y: 4, width: 40, height: 20 },
                spread: { x: 0, y: 0, width: 800, height: 500 },
            }) &&
            Object.entries(spreads).every(([name, { spread }]) => name === 'page-c' || spread === null) &&
            'content-23' in spreads &&
            'page-a' in spreads,
        spreads
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
    const wider = LAYOUT.roomsIn([{ size: { width: 300, height: 200 } }, { size: { width: 900, height: 20 } }], {
        width: 800,
        bar: 28,
        controls: 70,
    });
    check(
        "a panel window in the bar is told its room there, the bar past the host's controls less 8 at each end and " +
            'what the other panel windows in it take, none where they take it all, told again as the controls ' +
            'change; any other window has none',
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
            JSON.stringify(wider) ===
                JSON.stringify([
                    { width: 0, height: 28 },
                    { width: 406, height: 28 },
                ]) &&
            desk.desktop.stateOf(desk.page().windows.map(({ id }) => ({ id }))[0] ?? {}).room === null,
        { rooms, roomsLess, wider }
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

    // A panel window that names another edge stands in the bar as any does, and takes no keyboard as it opens, as it
    // is ordered front or as it is pressed.
    const keyId = () => desk.page().windows.find(({ key }) => key)?.id ?? null;
    const edged = { ...panelOf(31, 'a', { width: 360, height: 100 }), edge: 'right' };
    desk.desktop.activation.input(desk.desktop.localSeat, 'a');
    const shownAtEdge = desk.hostShown();
    desk.desktop.openPanel(edged);
    desk.desktop.orderFrontPanel(edged);
    desk.desktop.control.hand.press(31);
    const edgedNow = desk.desktop.control.panels().find(({ id }) => id === 31);
    check(
        'a panel window that names an edge the shell has not stands in the bar, a capsule no higher than it, and ' +
            'takes no keyboard as it opens, is ordered front or is pressed',
        JSON.stringify(edgedNow?.frame) === JSON.stringify({ x: 364, y: 0, width: 360, height: 28 }) &&
            !('key' in edgedNow) &&
            desk.laid().find(({ page }) => page.name === 'content-31')?.clip.cornerRadius === 14 &&
            desk.desktop.stateOf(edged).key === false &&
            keyId() === keyBefore &&
            desk.focused.at(-1)?.name !== 'content-31' &&
            desk.hostShown() === shownAtEdge,
        { edgedNow, key: keyId(), focused: desk.focused.at(-1) }
    );
    desk.desktop.closePanel(edged);

    const { createOverlay } = await import(url('deckit-shell', 'shell', 'overlay', 'main.js'));
    overlayChecks(createOverlay, check);

    seatChecks({ LAYOUT, DOCK, createDesktop }, check);
    await dockChecks({ LAYOUT, DOCK, createDesktop }, check);
    await readingChecks({ LAYOUT, createDesktop }, check);
    await numberingChecks({ LAYOUT, createDesktop }, check);
    const COLOURS = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'colours.js'));
    drawnChecks({ COLOURS, LAYOUT, createDesktop }, check);
    routeChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'routes.js')), check);
    levelChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'levels.js')), check);
    const ANCHOR = await import(url('deckit-sdk', 'shell', 'window', 'model', 'anchor.js'));
    const ANCHORED = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'anchored.js'));
    anchoredChecks({ ANCHOR, ANCHORED }, check);
    await anchorChecks({ LAYOUT, createDesktop }, check);
    showingChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'showing.js')), check);
    dialogChecks(await import(url('deckit-shell', 'shell', 'desktop', 'model', 'dialog.js')), check);
    await webPageChecks({ LAYOUT, createDesktop }, check);
    await viewChecks({ LAYOUT, createDesktop }, check);
    await askChecks({ createDesktop }, check);
    await followChecks({ LAYOUT, createDesktop }, check);
    const ROSTER = await import(url('deckit-shell', 'shell', 'seats', 'model', 'roster.js'));
    const { createSeats } = await import(url('deckit-shell', 'shell', 'seats', 'main.js'));
    await memberChecks({ ROSTER, createSeats, createDesktop }, check);
    await cursorChecks({ LAYOUT, createDesktop }, check);
    await cameraChecks({ LAYOUT, createDesktop }, check);
    const MARKS = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'marks.js'));
    await typingChecks({ MARKS, LAYOUT, createDesktop }, check);
    await marksChecks({ MARKS, LAYOUT, DOCK, createDesktop }, check);

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
        'a move with no button held and a press where no window is reach the desktop',
        moved.over === 'desktop' && nowhere.over === 'desktop',
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
    desk.enter(you, pointer('down', { x: 600, y: 780 }));
    desk.enter(you, pointer('up', { x: 600, y: 780 }));
    told.push(toldKey());
    check(
        "a window's content is told key by the seat that holds it, the machine's as an attached seat's, and stays " +
            'so as that seat presses the desktop',
        holds.other !== null && holds.other !== holds.local && told.join(' ') === 'true,true true,true',
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

// The one recognizer of the Dock: an attached seat's pointer and the page's forward of the local seat's.
async function dockChecks({ LAYOUT, DOCK, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const me = desk.sit('s1');
    const pointer = (type, at, more = {}) => ({ event: 'pointer', type, ...at, button: 0, count: 1, ...more });
    desk.dock.items = [
        { id: 'a', pinned: true, running: true },
        { id: 'b', pinned: true, running: false },
        { id: 'c', pinned: false, running: true },
    ];
    const zone = LAYOUT.desktopOf({ width: 1200, height: 800 }, 28);
    const on = (id) => {
        const { x, y, width, height } = DOCK.tileOf(zone, desk.dock.items, id);
        return { x: x + width / 2, y: y + height / 2 };
    };
    const local = (type, at, more = {}) => desk.fromPage('pointer', { part: 'dock', type, ...at, button: 0, ...more });
    const key = (part, item, button = 0) =>
        ['down', 'up'].forEach((type) => desk.fromPage('pointer', { part, item, type, x: 0, y: 0, button }));
    desk.dock.clicked.length = 0;
    desk.enter(me, pointer('move', { x: 2, y: on('a').y }));
    desk.enter(me, pointer('down', on('a')));
    desk.enter(me, pointer('move', { x: on('a').x + 3, y: on('a').y + 3 }, { buttons: [0] }));
    const short = desk.dock.shown.length;
    desk.enter(me, pointer('move', on('b'), { buttons: [0] }));
    const dragging = { shown: desk.dock.shown.at(-1), held: desk.page().dock.held };
    const dropped = desk.enter(me, pointer('up', on('b')));
    check(
        "a seat's drag of a kept item past the slop shows the kept items in the order of its pointer, on the page " +
            'too, and its up leaves them so, with no click',
        short === 0 &&
            JSON.stringify(dragging) === '{"shown":["a",["b","a"]],"held":"a"}' &&
            dropped.over === 'dock' &&
            JSON.stringify(desk.dock.reordered) === '[["b","a"]]' &&
            desk.page().dock.held === null &&
            !desk.dock.clicked.length,
        JSON.stringify({ short, dragging, dropped, reordered: desk.dock.reordered, clicked: desk.dock.clicked })
    );
    local('down', on('a'), { count: 1 });
    local('move', on('b'));
    const localDragging = desk.page().dock.held;
    local('up', on('b'));
    check(
        "the local seat's drag, forwarded by the page, gives the same order",
        localDragging === 'a' && JSON.stringify(desk.dock.reordered) === '[["b","a"],["b","a"]]',
        JSON.stringify({ localDragging, reordered: desk.dock.reordered })
    );
    desk.enter(me, pointer('down', on('a')));
    desk.enter(me, pointer('move', on('b'), { buttons: [0] }));
    desk.enter(me, pointer('down', on('c')));
    desk.enter(me, pointer('move', { x: on('c').x + 9, y: on('c').y + 9 }, { buttons: [0] }));
    desk.enter(me, pointer('up', { x: on('c').x + 9, y: on('c').y + 9 }));
    check(
        'a drag a new press cuts short is given up, and an item that is not kept is not dragged: its press let go ' +
            'on it is a click',
        desk.dock.reordered.length === 2 &&
            JSON.stringify(desk.dock.shown.at(-1)) === '[null,[]]' &&
            desk.page().dock.held === null &&
            JSON.stringify(desk.dock.clicked) === '[["c","s1"]]',
        JSON.stringify({ shown: desk.dock.shown, clicked: desk.dock.clicked })
    );
    local('down', on('c'), { count: 1 });
    local('up', on('c'));
    key('dock', 'b');
    check(
        "the local seat's press on an item, and its keyboard's press of one, are its clicks",
        JSON.stringify(desk.dock.clicked.slice(1)) === '[["c","local"],["b","local"]]',
        JSON.stringify(desk.dock.clicked)
    );
    const menuOfC = DOCK.menuOf(zone, desk.dock.items, 'c');
    const entry = (id) => {
        const { x, y, width, height } = menuOfC.entries.find((each) => each.id === id).rect;
        return { x: x + width / 2, y: y + height / 2 };
    };
    desk.enter(me, pointer('down', on('c'), { button: 2 }));
    desk.enter(me, pointer('up', on('c'), { button: 2 }));
    const mine = desk.page().dock.menu;
    const read = (await desk.seats.served.read(me, { of: 'desktop' })).text;
    const offMenu = desk.enter(me, pointer('move', entry('keep')));
    const chose = desk.enter(me, pointer('down', entry('keep')));
    desk.enter(me, pointer('up', entry('keep')));
    const after = (await desk.seats.served.read(me, { of: 'desktop' })).text;
    check(
        "a seat's press of the second button on an item opens its menu for that seat alone, the Dock staying out " +
            'for it; the seat reads it, and its press on an entry chooses it and puts the menu away',
        mine === null &&
            read.includes('  menu "c"\n  menuitem "Show" dock-menu.open\n  menuitem "Keep in Dock" dock-menu.keep') &&
            offMenu.over === 'dock' &&
            chose.over === 'dock' &&
            JSON.stringify(desk.dock.chosen) === '[["c","keep","s1"]]' &&
            !after.includes('menu'),
        JSON.stringify({ mine, read, offMenu, chose, chosen: desk.dock.chosen })
    );
    desk.enter(me, pointer('down', on('c'), { button: 2 }));
    desk.enter(me, pointer('up', on('c'), { button: 2 }));
    const away = desk.enter(me, pointer('down', { x: 600, y: 700 }));
    desk.enter(me, pointer('up', { x: 600, y: 700 }));
    const late = desk.enter(me, pointer('down', entry('quit')));
    desk.enter(me, pointer('up', entry('quit')));
    check(
        'a press off the menu puts it away: a press where an entry stood then chooses nothing',
        away.over === 'desktop' && late.over !== 'dock' && desk.dock.chosen.length === 1,
        JSON.stringify({ away, late, chosen: desk.dock.chosen })
    );
    local('down', on('c'), { button: 2 });
    local('up', on('c'), { button: 2 });
    const drawn = desk.page().dock.menu;
    const takes = desk.laid().find(({ page: each }) => each === desk.desktopPage).input;
    // The machine's press is carried too, in the desktop's page, as the page forwards it.
    const machine = async (type, at) => {
        desk.carried({ page: desk.desktopPage, event: 'pointer', type, ...at, button: 0, carried: true });
        await new Promise((resolve) => setTimeout(resolve));
    };
    await machine('down', entry('quit'));
    const held = desk.page().dock.menu?.item;
    local('down', entry('quit'), { count: 1 });
    await machine('up', entry('quit'));
    local('up', entry('quit'));
    const gone = desk.page().dock.menu;
    key('dock', 'a', 2);
    const byKey = desk.page().dock.menu?.item;
    key('dock-menu', 'open');
    const opened = [desk.page().dock.menu, desk.dock.chosen.at(-1)];
    key('dock', 'a', 2);
    key('dock', '');
    const putAway = desk.page().dock.menu;
    key('dock', 'a', 2);
    desk.carried({
        page: { name: 'another' },
        event: 'pointer',
        type: 'down',
        x: 600,
        y: 500,
        button: 0,
        carried: true,
    });
    await new Promise((resolve) => setTimeout(resolve));
    check(
        "the local seat's context press on an item opens its menu on the page, as the Dock's model lays it, and the " +
            "page takes the pointer there; its press on an entry chooses it; the keyboard's presses open the menu, " +
            "choose an entry and put it away, and so does the machine's press in another page",
        JSON.stringify(drawn) === JSON.stringify(menuOfC) &&
            takes.some((rect) => JSON.stringify(rect) === JSON.stringify(menuOfC.frame)) &&
            held === 'c' &&
            gone === null &&
            byKey === 'a' &&
            JSON.stringify(opened) === '[null,["a","open","local"]]' &&
            putAway === null &&
            desk.page().dock.menu === null &&
            JSON.stringify(desk.dock.chosen[1]) === '["c","quit","local"]',
        JSON.stringify({ drawn, takes, held, gone, byKey, opened, chosen: desk.dock.chosen })
    );
    key('dock', 'a', 2);
    const open = desk.page().dock.menu?.item;
    await machine('down', { x: 600, y: 10 });
    const afterBar = desk.page().dock.menu;
    await machine('up', { x: 600, y: 10 });
    check(
        "the machine's press on the host's bar, in the desktop's page and on no part of the Dock, puts the menu away",
        open === 'a' && afterBar === null,
        JSON.stringify({ open, afterBar })
    );
    desk.enter(me, pointer('move', { x: 2, y: on('b').y }));
    const second = [
        desk.enter(me, pointer('down', on('b'), { button: 2 })),
        desk.enter(me, pointer('move', { x: on('b').x + 9, y: on('b').y }, { buttons: [2] })),
        desk.enter(me, pointer('up', on('b'), { button: 2 })),
        desk.enter(me, pointer('up', on('b'), { button: 2 })),
    ].map(({ over }) => over);
    const clicks = desk.dock.clicked.length;
    check(
        "a seat's up of the second button on an item answers the Dock its down reached, and is no click or drag",
        JSON.stringify(second) === '["dock","dock","dock",null]' &&
            clicks === desk.dock.clicked.length &&
            desk.page().dock.held === null,
        JSON.stringify({ second, clicked: desk.dock.clicked })
    );
    desk.enter(me, pointer('down', { x: 600, y: 700 }));
    desk.enter(me, pointer('up', { x: 600, y: 700 }));
    desk.enter(me, pointer('move', { x: 600, y: 700 }));
    const byRef = (type) => desk.enter(me, { event: 'pointer', type, ref: 'dock.b', button: 0, count: 1 });
    const pressed = await byRef('down');
    const letGo = await byRef('up');
    check(
        "a seat's down and up at the ref of an item, the Dock in before them, are its click on the item",
        pressed.over === 'dock' &&
            letGo.over === 'dock' &&
            JSON.stringify(pressed.at) === JSON.stringify(on('b')) &&
            JSON.stringify(desk.dock.clicked.at(-1)) === '["b","s1"]' &&
            desk.dock.clicked.length === clicks + 1,
        JSON.stringify({ pressed, letGo, clicked: desk.dock.clicked })
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
    manager.untile('me', 1);
    check(
        'a tiled window leaves its tile for the frame it had',
        same(manager.frameOf(1), own) && !manager.tileNameOf(1),
        { back: manager.frameOf(1) }
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
    const desk = desktopOver(createDesktop, {
        clock: { now: () => now, later: (next) => due.push(next), after() {} },
    });
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
    const { routeOf, placeOf, noCount, waits, hovers, hovered, raises } = ROUTING;
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
        'a count is an integer of 0 or more: the first key that holds another is named, one left out is none',
        noCount({ text: 0, depth: 30 }, ['text', 'depth', 'items']) === null &&
            noCount({ since: null }, ['since']) === null &&
            noCount({ text: 3, depth: -1, items: -2 }, ['text', 'depth', 'items']) === 'depth' &&
            noCount({ count: 1.5 }, ['button', 'count']) === 'count' &&
            noCount({ button: '0' }, ['button']) === 'button',
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
        'a move with no button held only moves, and a window comes forward only where another covers the place',
        hovers({ type: 'move', ref: '4.2' }, []) &&
            !hovers({ type: 'move', ref: '4.2' }, [0]) &&
            hovers({ type: 'move', x: 1, y: 2 }, []) &&
            !hovers({ type: 'down', ref: '4.2' }, []) &&
            raises(1, 3) &&
            !raises(1, 1) &&
            !raises(1, null) &&
            !raises(null, 3),
        ''
    );
    const into = hovered(
        [
            { page: 'a', seat: 's1' },
            { page: 'b', seat: 's2' },
        ],
        's1',
        'b'
    );
    const off = hovered(into.placed, 's1', null);
    check(
        "a page has one pointer, placed by the last move of any seat, and a seat's move leaves the pages it placed",
        JSON.stringify(into) === '{"placed":[{"page":"b","seat":"s1"}],"left":["a"]}' &&
            JSON.stringify(off) === '{"placed":[],"left":["b"]}' &&
            hovered(into.placed, 's2', 'a').left.length === 0,
        JSON.stringify({ into, off })
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
    const { VIEW, PLACES, isPlace, isView, toldBy, isForeign, sizeOf, placeOf, placedAt, standingOf } = ANCHORED;
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

    // The places, on that stage and on one with no bar over the desktop.
    const bare = { stage: { width: 800, height: 500 }, desktop: rect(0, 0, 800, 500) };
    const tight = { stage: { width: 200, height: 60 }, desktop: rect(0, 28, 200, 32) };
    const places = {
        right: placedAt(bounds, 'top-right', size),
        left: placedAt(bounds, 'top-left', size),
        bareRight: placedAt(bare, 'top-right', size),
        bareLeft: placedAt(bare, 'top-left', size),
    };
    check(
        "a view at the place top-right stands 8 under the desktop's top and 8 inside the stage's right side, one at " +
            "top-left 8 inside its left, under the host's bar and with none",
        written(places) ===
            written({
                right: rect(472, 36, 320, 200),
                left: rect(8, 36, 320, 200),
                bareRight: rect(472, 8, 320, 200),
                bareLeft: rect(8, 8, 320, 200),
            }),
        places
    );
    const held = [
        placedAt(bounds, 'top-right', { width: 100, height: 10 }),
        placedAt(bounds, 'top-right', { width: 900, height: 900 }),
        placedAt(bare, 'top-left', { width: 900, height: 900 }),
        placedAt(tight, 'top-right', size),
        placedAt(tight, 'top-left', size),
    ];
    check(
        'a view at a place is held to the sizes of a view under an anchor, so it stays 8 inside the stage and above ' +
            "the desktop's bottom",
        written(held) ===
            written([
                rect(552, 36, 240, 80),
                rect(312, 36, 480, 456),
                rect(8, 8, 480, 484),
                rect(8, 36, 184, 16),
                rect(8, 36, 184, 16),
            ]),
        held
    );
    const none = [null, undefined, '', 'bottom-right', 'right', 'toString', 7, {}];
    check(
        'the places are top-right and top-left and no other name is one, and a panel window with an anchor or a ' +
            'place is a view',
        Object.keys(PLACES).join() === 'top-right,top-left' &&
            Object.keys(PLACES).every(isPlace) &&
            none.every((name) => !isPlace(name)) &&
            isView({ anchor: null, place: 'top-right' }) &&
            isView({ anchor: { mod: 'bar', id: 'clock' }, place: null }) &&
            !isView({ anchor: null, place: null }) &&
            !isView({}),
        none.filter(isPlace)
    );
    // A view of `bell` at a place, which names an anchor in its own content for `clock`.
    const toast = {
        id: 7,
        mod: 'bell',
        anchors: [{ id: 'more', rect: rect(10, 20, 100, 30), mod: 'clock' }],
        content: null,
        anchor: null,
        place: 'top-right',
        size,
    };
    const placed = standingOf(bounds, [toast, view(8, 'clock', { mod: 'bell', id: 'more' })]);
    check(
        'a view at a place stands with no anchor told, and an anchor it tells stands in it with the view bound to it',
        written(placed.frames.get(7)) === written(rect(472, 36, 320, 200)) &&
            written(placed.anchors.map(({ window, rect: at }) => [window, at])) ===
                written([[7, rect(482, 56, 100, 30)]]) &&
            written(placed.frames.get(8)) === written(rect(262, 94, 320, 200)),
        { frames: [...placed.frames], anchors: placed.anchors }
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
    const viewPage = desk.laid().find(({ page }) => page?.name === 'page-clock');
    check(
        "a view's content is laid over the panel windows at an edge, cut to its corners, its material under it in " +
            "the desktop's page, and its mod's page at the view with its overlay over the whole stage",
        names().indexOf('content-3') > names().indexOf('content-4') &&
            names().indexOf('content-4') > names().indexOf('content-2') &&
            laid.clip.cornerRadius === 12 &&
            !('spread' in laid) &&
            written(viewPage?.rect) === written(standsAt()) &&
            written(viewPage?.spread) === written(rect(0, 0, 1200, 800)) &&
            written(drawnAt()) === written({ id: 3, edge: null, frame: standsAt(), radius: 12 }),
        { names: names(), laid, viewPage, drawn: drawnAt() }
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
            desk.desktop.stateOf(view).key === false,
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

    // A view of `bell` at the place top-right, opened activating for nobody.
    const toast = windowOf(5, 'bell', {
        level: 'panel',
        edge: null,
        anchor: null,
        place: 'top-right',
        size: { width: 300, height: 120 },
    });
    desk.desktop.openPanel(toast, { activates: false });
    const toastAt = () => desk.desktop.control.panels().find(({ id }) => id === 5)?.frame ?? null;
    const placed = {
        at: toastAt(),
        laid: desk.laid().find(({ page }) => page?.name === 'content-5'),
        drawn: desk.page().panels.find(({ id }) => id === 5),
        told: desk.desktop.stateOf(toast),
        names: names(),
    };
    check(
        "a view at the place top-right stands 8 under the bar and 8 inside the stage's right side with no anchor " +
            'told: its content is laid over the panel windows at an edge, cut to the corners of a view, taking the ' +
            'pointer over all of it, its material is drawn, and it is told it is shown and not key',
        written(placed.at) === written(rect(892, 36, 300, 120)) &&
            written(placed.laid?.rect) === written(placed.at) &&
            placed.laid.clip.cornerRadius === 12 &&
            placed.laid.input === undefined &&
            placed.names.indexOf('content-5') > placed.names.indexOf('content-4') &&
            written(placed.drawn) === written({ id: 5, edge: null, frame: placed.at, radius: 12 }) &&
            placed.told.shown === true &&
            placed.told.key === false &&
            placed.told.width === 300 &&
            placed.told.height === 120,
        placed
    );
    const guest = desk.sit('s2');
    const start = desk.puts.length;
    await desk.enter(guest, pointer('down', { x: 900, y: 100 }));
    await desk.enter(guest, pointer('up', { x: 900, y: 100 }));
    const taken = desk.puts.slice(start).map(({ page }) => page);
    await desk.enter(guest, pointer('down', { x: 600, y: 700 }));
    await desk.enter(guest, pointer('up', { x: 600, y: 700 }));
    const stays = written(toastAt());
    toast.size = { width: 900, height: 900 };
    desk.desktop.update();
    const regrown = toastAt();
    desk.leave(guest);
    desk.desktop.closePanel(toast);
    check(
        "a view at a place opened activating for nobody is on every seat's screen: the press of any reaches its " +
            'content, no press outside it puts it away, it is placed again at the size its mod asks, and it goes as ' +
            'it closes',
        taken.join() === 'content-5,content-5' &&
            stays === written(rect(892, 36, 300, 120)) &&
            written(regrown) === written(rect(712, 36, 480, 756)) &&
            toastAt() === null,
        { taken, stays, regrown, at: toastAt() }
    );
}

// What a seat reads of the desktop, over a reader that answers one document a page: the desktop, a window and a node
// as text and as data, what changed since a mark, a mark that is not kept, an act on a ref and a picture.
// What the desktop's page is told of the seats: each one's colour, where its pointer is and what it holds.
// A web page is of the window it shows in: a press in one laid in a window's content, or apart in a window, is a
// press on that window, not on its mod's other windows. A page's dialog is told whose it is, stands where the page
// shows, moves with a laid page, and is refused where the page is in no window; drawn over its place in the window,
// it takes the press there alone, and any seat answers it.
async function webPageChecks({ LAYOUT, createDesktop }, check) {
    const pages = { a: { name: 'page-a', mod: 'a' } };
    const laid = { name: 'web-laid', embedder: pages.a };
    const apart = { name: 'web-apart', embedder: pages.a };
    const surfaces = {};
    let laidIn = 1;
    let placed = null;
    const desk = desktopOver(createDesktop, {
        web: {
            pageFor: (page) => page?.embedder ?? null,
            placeOf: (page) =>
                page === laid ? { over: surfaces[laidIn], frame: { x: 10, y: 10, width: 100, height: 80 } } : null,
            onPlaced: (listener) => (placed = listener),
        },
    });
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, surface) => ({
        id,
        mod: 'a',
        name: `w${id}`,
        level: 'normal',
        page: pages.a,
        surface,
        size: { width: 300, height: 200 },
        minimum: { width: 0, height: 0 },
        bar: { ...LAYOUT.DEFAULT_BAR, style: 'titled', enabled: { close: true, minimize: true, zoom: true } },
    });
    for (const id of [1, 3]) surfaces[id] = { name: `content-${id}`, of: pages.a };
    const made = [windowOf(1, surfaces[1]), windowOf(2, apart), windowOf(3, surfaces[3])];
    for (const window of made) {
        desk.desktop.open(window);
        desk.openSurfaces(window.id);
    }
    const settled = () => new Promise((resolve) => setTimeout(resolve));
    const pressIn = async (page) => {
        for (const type of ['down', 'up'])
            desk.carried({ page, event: 'pointer', type, x: 5, y: 5, button: 0, carried: true });
        await settled();
        return made
            .filter((window) => desk.desktop.stateOf(window).key)
            .map(({ id }) => id)
            .join();
    };
    const keys = [await pressIn(laid), await pressIn(apart)];
    check(
        "a press in a web page laid in a window's content, or apart in a window, is a press on that window",
        keys.join(' ') === '1 2',
        keys
    );

    const { served, refused } = desk.dialogs;
    const lost = { name: 'lost' };
    const owners = [surfaces[1], laid, apart, lost].map((page) => served.whose(page));
    check(
        "a page's dialog is the mod's of the window whose content it is, or of the page that shows it as a web page",
        JSON.stringify(owners) ===
            JSON.stringify([{ mod: 'a', web: false }, { mod: 'a', web: true }, { mod: 'a', web: true }, null]),
        owners
    );
    const asks = [surfaces[1], laid, apart, lost];
    asks.forEach((page, at) =>
        served.asked({ ask: at + 1, page, kind: 'confirm', message: 'Sure?', value: '', from: 'A' })
    );
    const frameOf = (id) => desk.desktop.control.windows().find((one) => one.id === id).frame;
    const contentOf = (id) =>
        LAYOUT.contentOf({ x: 0, y: 0, width: frameOf(id).width, height: frameOf(id).height }, made[0].bar);
    const where = (id) => desk.desktop.dialogsIn(id).map(({ ask, rect, whole }) => ({ ask, rect, whole }));
    const content = contentOf(1);
    const standing = [where(1), where(2)];
    check(
        "a dialog stands over its window's content, or a laid page's rect in it, and only one in no window is refused",
        JSON.stringify(standing) ===
            JSON.stringify([
                [
                    { ask: 1, rect: content, whole: true },
                    { ask: 2, rect: { x: 10, y: content.y + 10, width: 100, height: 80 }, whole: false },
                ],
                [{ ask: 3, rect: contentOf(2), whole: true }],
            ]) && refused.join() === '4',
        { standing, refused }
    );
    laidIn = 3;
    placed(laid, null);
    const movedTo = [
        where(1)
            .map(({ ask }) => ask)
            .join(),
        where(3)
            .map(({ ask }) => ask)
            .join(),
    ];
    for (const ask of [1, 2, 3]) served.withdrawn(ask);
    check(
        "a laid page's dialog moves with it to the window it is laid in now, and is gone once withdrawn",
        movedTo.join(' ') === '1 2' && [1, 2, 3].every((id) => where(id).length === 0),
        movedTo
    );

    // Drawn in the window's dialog surface over its content and under its buttons, taking presses over its rect alone.
    const { answered } = desk.dialogs;
    const ask = (id, page, kind, value = '') =>
        served.asked({ ask: id, page, kind, message: 'Go on?', value, from: 'A' });
    ask(11, surfaces[3], 'confirm');
    const names = () => desk.laid().map(({ page }) => page?.name);
    const at = (name) => names().indexOf(name);
    const over = desk.laid().find(({ page }) => page?.name === 'dialog-3');
    const told = desk.page().windows.find(({ id }) => id === 3).dialogs[0];
    check(
        "a window's dialog is laid over its content and under its buttons, taking the press over its rect alone",
        at('content-3') < at('dialog-3') &&
            at('dialog-3') < at('buttons-3') &&
            JSON.stringify(over.input) === JSON.stringify([where(3).at(-1).rect]) &&
            told.kind === 'confirm' &&
            told.from === 'A' &&
            told.parts.buttons.map(({ label }) => label).join() === 'Cancel,OK',
        { names: names(), input: over?.input, told }
    );
    const seat = desk.sit('s1');
    const stageOf = (id, { x, y, width, height }) => ({
        x: frameOf(id).x + x + width / 2,
        y: frameOf(id).y + y + height / 2,
    });
    const click = async (point) => {
        for (const type of ['down', 'up'])
            await desk.enter(seat, { event: 'pointer', type, ...point, button: 0, count: 1 });
    };
    const okOf = (id) =>
        desk
            .page()
            .windows.find((one) => one.id === id)
            .dialogs[0].parts.buttons.at(-1).rect;
    await click(stageOf(3, okOf(3)));
    ask(12, surfaces[3], 'prompt', 'a');
    await click(stageOf(3, desk.page().windows.find(({ id }) => id === 3).dialogs[0].parts.field));
    await desk.enter(seat, { event: 'text', type: 'insert', text: 'bc' });
    await desk.enter(seat, { event: 'key', type: 'down', key: 'Enter', code: 'Enter' });
    ask(13, apart, 'leave');
    desk.pagePointer(2, 'dialog-stay', 'down', { x: 0, y: 0 }, { ask: 13 });
    desk.pagePointer(2, 'dialog-stay', 'up', { x: 0, y: 0 }, { ask: 13 });
    check(
        "any seat answers a dialog: a press on its button, a prompt's text typed and Return, the host window's press",
        JSON.stringify(answered) ===
            JSON.stringify([
                [11, true],
                [12, 'abc'],
                [13, false],
            ]),
        answered
    );
    const pressed = (point) => {
        desk.puts.length = 0;
        return click(point).then(() => desk.puts.map(({ page }) => page).join());
    };
    ask(14, laid, 'alert');
    const rect = where(3)[0].rect;
    const inside = await pressed(stageOf(3, rect));
    const beside = await pressed(stageOf(3, { x: rect.x + rect.width + 20, y: rect.y, width: 0, height: 0 }));
    check(
        "a laid page's dialog takes the press over its rect, and the rest of its window still takes the hand",
        inside === '' && beside.split(',').includes('content-3') && answered.length === 3,
        { inside, beside }
    );
}

// Where a page's dialog stands (model/dialog.js): over the whole content of a window, over a page shown in a part of
// it cut to what shows it, nowhere for a page in no window or one shown outside what shows it, moved as its page is,
// kept where it was while its page shows nowhere, and up until it is withdrawn.
function dialogChecks({ createDialogs, partsOf, partAt, answerOf, keyed, covers }, check) {
    const dialogs = createDialogs();
    const content = { x: 0, y: 28, width: 400, height: 300 };
    const asked = (ask, kind = 'confirm') => ({ ask, kind, message: 'Sure?', value: '', from: 'A' });
    const whole = dialogs.ask(asked(1), { window: 7, content });
    check(
        "a window's content's dialog stands over the whole content, in the window's coordinates",
        JSON.stringify(whole) === JSON.stringify({ ask: 1, window: 7, rect: content, whole: true, ...asked(1) }) &&
            Object.isFrozen(whole),
        whole
    );
    const laid = dialogs.ask(asked(2, 'alert'), {
        window: 7,
        content,
        rect: { x: 350, y: -10, width: 100, height: 60 },
    });
    const region = dialogs.ask(asked(3), {
        window: 8,
        content: { x: 20, y: 48, width: 200, height: 100 },
        rect: { x: 10, y: 10, width: 50, height: 40 },
    });
    check(
        'a page laid in a part of a window has its dialog over its rect, cut to what shows it',
        JSON.stringify(laid?.rect) === JSON.stringify({ x: 350, y: 28, width: 50, height: 50 }) &&
            laid.whole === false &&
            JSON.stringify(region?.rect) === JSON.stringify({ x: 30, y: 58, width: 50, height: 40 }) &&
            region.whole === false,
        { laid, region }
    );
    const nowhere = [
        dialogs.ask(asked(4), null),
        dialogs.ask(asked(5), { window: 7, content, rect: { x: 500, y: 0, width: 10, height: 10 } }),
        dialogs.ask(asked(6), { window: 7, content, rect: null }),
        dialogs.ask(asked(7), { window: 7, content: { x: 0, y: 28, width: 0, height: 0 } }),
        dialogs.ask(asked(1), { window: 9, content }),
    ];
    check(
        'a dialog stands nowhere for a page in no window, one shown outside what shows it, or one asked twice',
        nowhere.every((one) => one === null) &&
            dialogs
                .inWindow(7)
                .map(({ ask }) => ask)
                .join() === '1,2' &&
            dialogs
                .inWindow(8)
                .map(({ ask }) => ask)
                .join() === '3',
        { nowhere, in7: dialogs.inWindow(7), in8: dialogs.inWindow(8) }
    );
    const moved = dialogs.move(2, { window: 8, content, rect: { x: 0, y: 0, width: 40, height: 30 } });
    const stays = dialogs.move(2, null);
    const unknown = dialogs.move(9, { window: 7, content });
    check(
        'a dialog moves with its page, stays where it was while its page shows nowhere, and none moves that is not up',
        JSON.stringify(moved?.rect) === JSON.stringify({ x: 0, y: 28, width: 40, height: 30 }) &&
            moved.window === 8 &&
            moved.kind === 'alert' &&
            stays === moved &&
            unknown === null &&
            dialogs
                .inWindow(7)
                .map(({ ask }) => ask)
                .join() === '1' &&
            dialogs
                .inWindow(8)
                .map(({ ask }) => ask)
                .join() === '2,3',
        { moved, stays, unknown }
    );
    const withdrawn = [dialogs.withdraw(2), dialogs.withdraw(2)];
    check(
        'a dialog withdrawn is up no more, once',
        withdrawn.join() === 'true,false' && dialogs.of(2) === null && dialogs.of(3) === region,
        { withdrawn, of: dialogs.of(2) }
    );

    const prompt = dialogs.ask({ ...asked(8, 'prompt'), value: 'a' }, { window: 7, content });
    const parts = partsOf(prompt);
    const inside = (rect, part) => rect.x >= part.x && rect.y >= part.y && rect.x + rect.width <= part.x + part.width;
    const middle = ({ x, y, width, height }) => ({ x: x + width / 2, y: y + height / 2 });
    check(
        "a dialog's card stands at the top centre of its rect, holding who asks, the message, a prompt's field and " +
            'its buttons, Cancel then OK',
        parts.card.x - content.x === content.x + content.width - parts.card.x - parts.card.width &&
            parts.card.y > content.y &&
            [parts.from, parts.message, parts.field, ...parts.buttons.map(({ rect }) => rect)].every((rect) =>
                inside(rect, parts.card)
            ) &&
            parts.buttons.map(({ label }) => label).join() === 'Cancel,OK' &&
            partAt(prompt, middle(parts.buttons[1].rect)) === 'dialog-ok' &&
            partAt(prompt, middle(parts.field)) === 'dialog-field' &&
            partAt(prompt, { x: content.x + 1, y: content.y + content.height - 1 }) === 'dialog',
        parts
    );
    const typed = dialogs.type(8, 'abc');
    const answers = [
        answerOf(typed, 'dialog-ok'),
        answerOf(typed, 'dialog-cancel'),
        answerOf(dialogs.of(3), 'dialog-ok'),
        answerOf(dialogs.of(3), 'dialog-leave'),
        answerOf({ kind: 'leave' }, 'dialog-stay'),
        answerOf({ kind: 'alert' }, 'dialog-ok'),
        answerOf(typed, 'dialog'),
    ];
    const keys = [keyed(typed, 'Enter'), keyed(typed, 'Escape'), keyed({ kind: 'leave' }, 'Enter')];
    const more = [keyed({ kind: 'alert' }, 'Escape'), dialogs.type(3, 'x')];
    check(
        "a dialog's buttons and keys answer it: OK true or the prompt's text typed, Cancel false or null, Leave and Stay",
        JSON.stringify(answers) ===
            JSON.stringify([
                { value: 'abc' },
                { value: null },
                { value: true },
                null,
                { value: false },
                { value: true },
                null,
            ]) &&
            keys.join() === 'dialog-ok,dialog-cancel,dialog-leave' &&
            more.every((one) => one === null),
        { answers, keys, more }
    );
    const covered = [covers({ whole: true }, false), covers({ whole: false }, true), covers({ whole: false }, false)];
    check(
        "a content's dialog covers every page laid over it, a laid page's the page that asked it alone",
        covered.join() === 'true,true,false',
        covered
    );
}

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
    const stack = createShowing();
    for (const seat of ['me', 'you']) stack.addSeat(seat);
    stack.open(1, { seat: 'me' });
    stack.open(2, { activates: false });
    stack.open(3, { activates: false });
    stack.show(3, 'you');
    const stacked = [stack.stackedOn('me', [1, 2, 3]), stack.stackedOn('you', [2, 3]), stack.stackedOn(null, [1, 2])];
    check(
        "on a seat's screen the view shown for it by activation lies over those shown for every seat, which lie in " +
            'the order they opened',
        JSON.stringify(stacked) === '[[2,3,1],[2,3],[1,2]]',
        stacked
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
    await asks(desk.seats.open[0]);
    desk.desktop.togglePanel(view);
    const handed = [await on()];
    desk.desktop.control.hand.press(3);
    handed.push(await on());
    desk.desktop.control.hand.press(1);
    handed.push(await on());
    check(
        "the hand's press is the local seat's press down: in its view it spares the view, in a window it puts it away",
        JSON.stringify(handed) === JSON.stringify(['local', 'local', '']),
        handed
    );
    const gestured = [];
    for (const gesture of [
        () => desk.desktop.control.hand.move(1, 0, 0),
        () => desk.desktop.control.hand.resize(1, 'right', 0, 0),
        () => desk.desktop.control.hand.button(1, 'zoom'),
        () => desk.desktop.control.hand.doubleClick(1),
    ]) {
        await asks(desk.seats.open[0]);
        desk.desktop.togglePanel(view);
        const shown = await on();
        gesture();
        gestured.push(`${shown}>${await on()}`);
    }
    check(
        "the hand's move, resize, button and double click on a window are the local seat's press down: each puts " +
            'its view away',
        JSON.stringify(gestured) === JSON.stringify(Array(4).fill('local>')),
        gestured
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

    // A view of `bell` at a place, shown for every seat, which covers where the view of `clock` stands.
    const toast = windowOf(7, 'bell', {
        level: 'panel',
        edge: null,
        anchor: null,
        place: 'top-right',
        size: { width: 480, height: 300 },
    });
    desk.desktop.openPanel(toast, { activates: false });
    await asks(s1);
    desk.desktop.togglePanel(view);
    const stacks = {
        over: (await press(s1, inView)).over,
        under: (await press(s2, inView)).over,
        on: await on(),
    };
    await press(s1, outside);
    desk.desktop.closePanel(toast);
    check(
        "a view shown for a seat by activation lies over a view at a place on that seat's screen, though it opened " +
            'first: its press there reaches it, and that of a seat it is not shown for reaches the view at the place',
        stacks.over === 3 && stacks.under === 7 && stacks.on === 's1' && (await on()) === '',
        stacks
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
    desk.desktop.seats.follow('s1');
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
    const left = {
        following: desk.page().following,
        drawn: desk.page().seats.map(({ id }) => id),
        told: desk.desktop.seats.now().seats.map(({ id, following }) => `${id} ${following}`),
    };
    check(
        'a seat the local seat follows leaves as deckit closes it, which answers nothing of it from then on: the ' +
            "host window shows the local seat's view again, and the seat is drawn and told no more",
        left.following === null && left.drawn.join() === 'local,s2' && left.told.join() === 'local false,s2 false',
        left
    );
    desk.leave(s2);
}

// A user that asks to sit, as the desktop tells it to what hears the seats: it waits until it is answered, once, or
// no answer is waited for, and the desktop's page neither draws it nor takes the pointer for it.
async function askChecks({ createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    desk.sit('s1');
    const { seats } = desk.desktop;
    let heard = 0;
    const off = seats.onChange(() => heard++);
    const settled = () => new Promise((resolve) => setTimeout(resolve));
    const input = () => JSON.stringify(desk.laid().find(({ page }) => page === desk.desktopPage).input);
    const asking = (id) => {
        const control = new AbortController();
        const asked = { control, answer: undefined };
        desk.seats.served.onAsk({ user: { id, name: id } }, { signal: control.signal }).then((answer) => {
            asked.answer = answer;
        });
        return asked;
    };
    const alone = input();
    const ada = asking('ada');
    const waiting = seats.now().asks;
    check(
        "a user that asks to sit is told to what hears the seats, and the desktop's page is told no ask and takes " +
            'the pointer nowhere for one',
        JSON.stringify(waiting) === JSON.stringify([{ id: 1, name: 'ada' }]) &&
            heard === 1 &&
            ada.answer === undefined &&
            !('asks' in desk.page()) &&
            input() === alone,
        [waiting, heard, Object.keys(desk.page()), input()]
    );
    const allowed = seats.answer(waiting[0].id, true);
    const twice = seats.answer(waiting[0].id, false);
    await settled();
    check(
        'an answer of yes lets the user sit, and the ask is over: a second answer of it answers nothing',
        allowed === true && twice === false && ada.answer === true && seats.now().asks.length === 0 && heard === 2,
        [allowed, twice, ada.answer, seats.now().asks, heard]
    );
    const [grace, late] = [asking('grace'), asking('late')];
    const denied = seats.answer(seats.now().asks[0].id, false);
    await settled();
    const left = seats.now().asks.map(({ name }) => name);
    late.control.abort();
    await settled();
    off();
    check(
        'an answer of no refuses the user, and an ask no answer is waited for goes',
        denied === true &&
            grace.answer === false &&
            late.answer === undefined &&
            left.join() === 'late' &&
            seats.now().asks.length === 0,
        [denied, grace.answer, late.answer, left, seats.now().asks]
    );
}

// What a mod with deckit.seats is told of the seats, and what it does to them, whichever seat's press made it ask.
async function memberChecks({ ROSTER, createSeats, createDesktop }, check) {
    const roster = ROSTER.createRoster();
    const seat = (id, more = {}) => ({
        id,
        name: `user ${id}`,
        colour: 'blue',
        idle: false,
        following: false,
        ...more,
    });
    const both = roster.told({ seats: [seat('local'), seat('s1', { idle: true })], asks: [{ id: 1, name: 'Ada' }] });
    const ids = [...both.seats, ...both.asks].map(({ id }) => id);
    check(
        "a mod is told each seat and each ask as plain data in its order, under an id of the roster's own",
        JSON.stringify(both.seats.map(({ id, ...rest }) => rest)) ===
            JSON.stringify([
                { name: 'user local', colour: 'blue', idle: false, following: false },
                { name: 'user s1', colour: 'blue', idle: true, following: false },
            ]) &&
            JSON.stringify(both.asks.map(({ id, ...rest }) => rest)) === '[{"name":"Ada"}]' &&
            new Set(ids).size === 3 &&
            ids.every((id) => typeof id === 'string' && !['local', 's1'].includes(id)) &&
            roster.seatOf(both.seats[1].id) === 's1' &&
            roster.askOf(both.asks[0].id) === 1,
        both
    );
    const again = roster.told({ seats: [seat('local'), seat('s1')], asks: [] });
    const alone = roster.told({ seats: [seat('local')], asks: [] });
    const back = roster.told({ seats: [seat('local'), seat('s1')], asks: [] });
    check(
        'an id holds while its seat sits, names nothing once it left, and a seat that sits again has a new one',
        again.seats[1].id === both.seats[1].id &&
            alone.seats[0].id === both.seats[0].id &&
            roster.askOf(both.asks[0].id) === null &&
            back.seats[1].id !== both.seats[1].id &&
            roster.seatOf(both.seats[1].id) === null &&
            roster.seatOf(back.seats[1].id) === 's1' &&
            roster.seatOf('local') === null,
        [again, alone, back]
    );

    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const SEATS = createSeats({ deckit: desk.deckit, DESKTOP: desk.desktop });
    SEATS.start();
    const page = { name: 'page-seats', mod: 'seats' };
    const asked = (channel, payload = {}) => desk.handlers[`deckit-shell:seats-${channel}`](payload, page);
    const changes = () => desk.sent.filter(({ channel }) => channel === 'deckit-shell:seats-changed');
    asked('watch');
    const other = desk.sit('s1');
    const third = desk.sit('s2');
    const sat = asked('read');
    check(
        'the member answers who sits: its name, the name of its colour, idle or not, followed or not',
        JSON.stringify(sat.seats.map(({ id, ...rest }) => rest)) ===
            JSON.stringify([
                { name: 'Local', colour: 'blue', idle: false, following: false },
                { name: 's1', colour: 'green', idle: false, following: false },
                { name: 's2', colour: 'orange', idle: false, following: false },
            ]) &&
            sat.asks.length === 0 &&
            changes().length === 2 &&
            changes().every((told) => told.page === page && JSON.stringify(told.payload) === '{}'),
        [sat, changes()]
    );
    const untold = SEATS.untaken();
    changes()[0].taken();
    await new Promise((resolve) => setTimeout(resolve));
    const one = SEATS.untaken();
    changes()[1].gone(new Error('the page is gone'));
    await new Promise((resolve) => setTimeout(resolve));
    check(
        "a change told a mod's page is untaken until the page answers it heard it, and a page gone takes none",
        untold === 2 && one === 1 && SEATS.untaken() === 0,
        [untold, one, SEATS.untaken()]
    );
    const asking = (id) => {
        const control = new AbortController();
        const waits = { control, answer: undefined };
        desk.seats.served.onAsk({ user: { id, name: `user ${id}` } }, { signal: control.signal }).then((answer) => {
            waits.answer = answer;
        });
        return waits;
    };
    const settled = () => new Promise((resolve) => setTimeout(resolve));
    const [ada, grace] = [asking('ada'), asking('grace')];
    const waiting = asked('read').asks;
    const told = changes().length;
    const allowed = asked('answer', { ask: waiting[0].id, allow: true });
    const twice = asked('answer', { ask: waiting[0].id, allow: false });
    await settled();
    check(
        'an ask that waits is told by its name, and an answer of allow lets its user sit, whoever pressed for it',
        JSON.stringify(waiting.map(({ name }) => name)) === '["user ada","user grace"]' &&
            told === 4 &&
            allowed === true &&
            twice === false &&
            ada.answer === true &&
            grace.answer === undefined &&
            asked('read').asks.length === 1 &&
            changes().length === 5,
        [waiting, allowed, twice, ada.answer, grace.answer, changes().length]
    );
    const denied = asked('answer', { ask: waiting[1].id, allow: false });
    await settled();
    check(
        'an answer of deny refuses its user, and an ask that is not told answers nothing',
        denied === true && grace.answer === false && asked('answer', { ask: 'none', allow: true }) === false,
        [denied, grace.answer]
    );
    const followed = asked('follow', { seat: sat.seats[1].id });
    const shows = desk.page().following?.id;
    const marks = asked('read').seats.map(({ following }) => following);
    const ended = asked('follow', { seat: null });
    const own = desk.page().following;
    const local = asked('follow', { seat: sat.seats[0].id });
    const unknown = asked('follow', { seat: 'none' });
    check(
        "following a seat shows its view in the host window and marks it, and following none ends it; the host's " +
            'own seat and a seat that is not told are followed by no one',
        followed === true &&
            shows === 's1' &&
            marks.join() === 'false,true,false' &&
            ended === false &&
            own === null &&
            local === false &&
            unknown === false &&
            desk.page().following === null,
        [followed, shows, marks, ended, own, local, unknown]
    );
    desk.seats.idle.add('s2');
    desk.enter(other, { event: 'pointer', type: 'move', x: 10, y: 10, button: 0, count: 1 });
    const idle = asked('read').seats.map(({ idle }) => idle);
    asked('follow', { seat: sat.seats[2].id });
    desk.leave(third);
    const left = asked('read').seats;
    check(
        'a seat whose devices gave nothing for the idle time is told idle, and one that leaves is told no more',
        idle.join() === 'false,false,true' &&
            left.map(({ name, following }) => `${name} ${following}`).join() === 'Local false,s1 false' &&
            left[1].id === sat.seats[1].id,
        [idle, left]
    );
    const last = Math.max(...[...sat.seats, ...waiting].map(({ id }) => Number(id)));
    const unread = asking('lin');
    const blind = asked('answer', { ask: String(last + 1), allow: true });
    await settled();
    check(
        'an ask has its id from the moment it waits, the next count, whether or not any mod read it',
        blind === true && unread.answer === true,
        [last, blind, unread.answer]
    );
}

// The cursors' surface: laid over every level of the stage and over what the pages present, while more than one seat
// is at the desktop, taking the pointer nowhere.
// The camera at the desktop's edge: the machine's scroll, carried in the page it was delivered to.
async function cameraChecks({ LAYOUT, createDesktop }, check) {
    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const page = { name: 'page-a', mod: 'a' };
    const content = { name: 'content-1', of: page };
    desk.desktop.open({
        id: 1,
        mod: 'a',
        name: 'w1',
        level: 'normal',
        page,
        surface: content,
        size: { width: 200, height: 200 },
        minimum: { width: 0, height: 0 },
        bar: LAYOUT.DEFAULT_BAR,
    });
    desk.openSurfaces(1);
    const local = desk.seats.open[0];
    const cameraNow = async () => (await desk.seats.served.read(local, { of: 'desktop', format: 'json' })).data.desktop;
    const scroll = async (on, x, y) => {
        desk.carried({ page: on, event: 'pointer', type: 'scroll', x, y, dx: 0, dy: 100, buttons: [], carried: true });
        await new Promise((resolve) => setTimeout(resolve));
        return cameraNow();
    };
    const window = desk.frameOf(1);
    const before = await cameraNow();
    const onWindow = await scroll(content, 10, 10);
    const onBar = await scroll(desk.desktopPage, 600, 10);
    const onDesktop = await scroll(desk.backdrop, 5, 700);
    check(
        "the machine's scroll on the backdrop pans the local seat's camera, and one in a window's page or on the " +
            "desktop's page does not",
        before.y === 0 && onWindow.y === 0 && onBar.y === 0 && onDesktop.y === 100 && onDesktop.x === 0,
        { before, onWindow, onBar, onDesktop, window }
    );
}

async function cursorChecks({ LAYOUT, createDesktop }, check) {
    const menu = { name: 'menu' };
    const full = { x: 0, y: 0, width: 1200, height: 800 };
    // The content of window 1 presents a menu, its overlay laid over the whole stage.
    const overlays = (layers) =>
        layers.some(({ page }) => page?.name === 'content-1')
            ? [{ page: menu, rect: full, input: [{ x: 0, y: 400, width: 100, height: 100 }] }]
            : [];
    // The menu is the overlay of the page of the mod `a`.
    const pages = { a: { name: 'page-a', mod: 'a' }, b: { name: 'page-b', mod: 'b' } };
    const desk = desktopOver(createDesktop, { overlays, ownerOf: (page) => (page === menu ? pages.a : page) });
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    const windowOf = (id, mod, level) => {
        const page = pages[mod];
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
    const onMenu = { x: 50, y: 450 };
    const answered = await desk.enter(other, pointer('down', onMenu));
    await desk.enter(other, pointer('up', onMenu));
    const inMenu = desk.puts.slice(before + 2).map(({ page, event }) => `${page} ${event.type} ${event.x},${event.y}`);
    check(
        "a seat's press on what a mod's page presents over itself is put in that overlay, and is a press on the " +
            "page's front window",
        answered?.over === 1 && inMenu.join() === 'menu down 50,450,menu up 50,450',
        { answered, inMenu }
    );
    desk.leave(other);
    check("the cursors' surface is taken off as the last other seat leaves", !names().includes('cursors'), names());
}

// The local seat follows another: the host window shows that seat's view until the local seat presses or types.
async function followChecks({ LAYOUT, createDesktop }, check) {
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
    const other = desk.sit('s1');
    desk.sit('s2');
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
    // The host window shows the view of `seat`, as the seats' member asks it for whichever seat pressed.
    const follow = (seat) => desk.desktop.seats.follow(seat);
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
    const began = follow('s1');
    const full = { x: 0, y: 0, width: 1200, height: 800 };
    const takes = desk.laid().filter(({ page, input }) => page && (!input || input.length));
    check(
        "following a seat shows that seat's view in the host window: its order, its key window, its active mod",
        began === true &&
            own === ' 1,2* local b' &&
            view() === 's1 2,1* s1 a' &&
            desk.page().following.name === 's1' &&
            desk.page().following.colour === 'green',
        [began, own, view(), desk.page().following]
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
    follow('s1');
    const closedBefore = desk.closed.length;
    const taken = desk.press('closeWindow', all[1].surface);
    const held = desk.press('closeWindow', all[1].surface);
    await machine({ event: 'key', type: 'up', code: 'KeyW', key: 'w' });
    check(
        'a key of the shell ends it and does no more, until it is let go',
        taken === true && held === true && view() === own && desk.closed.length === closedBefore,
        [taken, held, view(), desk.closed]
    );
    follow('s1');
    await machine({ event: 'key', type: 'down', code: 'KeyA', key: 'a' });
    await machine({ event: 'key', type: 'up', code: 'KeyA', key: 'a' });
    const byKey = view();
    follow('s1');
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
        JSON.stringify(desk.told().map(({ under: _, ...event }) => event)) ===
            '[{"id":"s2","type":"move","x":10,"y":20,"buttons":[],"named":true,"glide":false}]' &&
            Array.isArray(desk.told()[0].under) &&
            desk.states() === states,
        [desk.told(), desk.states() - states]
    );
    desk.enter(second, pointer('down', middle));
    desk.enter(third, pointer('scroll', { x: 5, y: 6 }, { dx: 0, dy: 40 }));
    desk.carried({ event: 'pointer', type: 'move', x: 1, y: 2 });
    const seats = Object.fromEntries(desk.page().seats.map((seat) => [seat.id, seat]));
    const { under: covers, ...plain } = seats.s2;
    check(
        "the page's state has each seat's name, colour, pointer, held buttons, whether it is shown, what covers its " +
            'cursor and whether its name shows, and no more',
        JSON.stringify(plain) ===
            JSON.stringify({
                id: 's2',
                name: 's2',
                colour: 'orange',
                at: middle,
                buttons: [0],
                shown: false,
                named: true,
                typing: null,
            }) &&
            Array.isArray(covers) &&
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

// What marks a seat on the viewer's screen: the model's answers, and what the desktop's page is told of them.
async function marksChecks({ MARKS, LAYOUT, DOCK, createDesktop }, check) {
    const rect = (x, y, width, height) => ({ x, y, width, height });
    const [back, front] = [
        { id: 1, frame: rect(0, 0, 100, 100) },
        { id: 2, frame: rect(50, 0, 100, 100) },
    ];
    check(
        'what is in front at a point of a stack is the last of it the point is in, and nothing where none is',
        MARKS.topAt([back, front], { x: 60, y: 10 }) === 2 &&
            MARKS.topAt([front, back], { x: 60, y: 10 }) === 1 &&
            MARKS.topAt([back, front], { x: 10, y: 10 }) === 1 &&
            MARKS.topAt([back, front], { x: 150, y: 10 }) === null &&
            MARKS.topAt([], { x: 0, y: 0 }) === null,
        [MARKS.topAt([back, front], { x: 60, y: 10 }), MARKS.topAt([back, front], { x: 150, y: 10 })]
    );
    // Two windows, the band of the host's bar and a view over it, as a screen's stack holds them.
    const [lower, upper] = [
        { ...back, radius: 16 },
        { ...front, radius: 16 },
    ];
    const band = { id: 'band', frame: rect(0, 0, 400, 28), radius: 0 };
    const view = { id: 9, frame: rect(300, 4, 80, 120), radius: 12 };
    const cover = { ...upper.frame, radius: 16 };
    const holds = ({ x, y, width, height }, at) => at.x >= x && at.y >= y && at.x < x + width && at.y < y + height;
    const [whole, half] = [
        { x: 60, y: 40 },
        { x: 45, y: 40 },
    ];
    const answers = {
        whole: MARKS.underOf(whole, [upper, lower], [lower, upper]),
        half: MARKS.underOf(half, [upper, lower], [lower, upper]),
        clear: MARKS.underOf(whole, [lower, upper], [lower, upper]),
        own: MARKS.underOf({ x: 310, y: 60 }, [lower, band, view], [lower, band]),
        away: MARKS.underOf(whole, [upper, lower], [upper]),
        band: MARKS.underOf({ x: 310, y: 10 }, [lower, band], [lower, band, view]),
        bare: MARKS.underOf({ x: 200, y: 300 }, [lower, band], [lower, upper, band, view]),
        plain: MARKS.underOf(whole, [upper, lower], [lower, { id: 2, frame: upper.frame }]),
        nowhere: MARKS.underOf(null, [lower], [upper]),
    };
    const written = (answer) => JSON.stringify(answer);
    check(
        "a cursor over a window of its seat's order is under the windows over that one on the viewer's screen: " +
            'where one of them holds its point it is covered whole, and beside that one its edge cuts it',
        written(answers.whole) === written([cover]) &&
            holds(answers.whole[0], whole) &&
            written(answers.half) === written([cover]) &&
            !holds(answers.half[0], half) &&
            answers.half[0].x - half.x === 5,
        answers
    );
    check(
        "a cursor over what is in front on the viewer's screen too is under nothing, and one whose pointer is " +
            'nowhere yet is under nothing',
        written(answers.clear) === '[]' && written(answers.nowhere) === '[]',
        answers
    );
    check(
        "a cursor over what is not on the viewer's screen, a view shown for its seat alone or a window the viewer " +
            'put away, is not seen at all',
        answers.own === null && answers.away === null,
        answers
    );
    check(
        "a cursor over the band of the host's bar is under a view the viewer has over it, and over no window",
        written(answers.band) === written([{ ...view.frame, radius: 12 }]),
        answers
    );
    check(
        "a cursor over the bare desktop is under all that stands on the viewer's screen, each with the radius of its " +
            'corners, none for what names none',
        written(answers.bare) ===
            written([
                { ...lower.frame, radius: 16 },
                cover,
                { ...band.frame, radius: 0 },
                { ...view.frame, radius: 12 },
            ]) && answers.plain[0].radius === 0,
        answers
    );

    const desk = desktopOver(createDesktop, {});
    desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    desk.desktop.control.show();
    for (const [id, mod] of [
        [1, 'a'],
        [2, 'b'],
    ]) {
        const page = { name: `page-${mod}`, mod };
        desk.desktop.open({
            id,
            mod,
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
    desk.desktop.control.hand.move(1, 100 - desk.frameOf(1).x, 300 - desk.frameOf(1).y);
    desk.desktop.control.hand.move(2, 200 - desk.frameOf(2).x, 300 - desk.frameOf(2).y);
    const pointer = (type, at) => ({ event: 'pointer', type, ...at, button: 0, count: 1 });
    const other = desk.sit('s1');
    // The window at the back of the local seat's order, where the other covers it and where it shows alone.
    const [under, over] = desk.page().windows.map(({ id }) => id);
    const [low, high] = [desk.frameOf(under), desk.frameOf(over)];
    const covered = { x: Math.max(low.x, high.x) + 20, y: low.y + 100 };
    const alone = { x: under === 1 ? low.x + 20 : low.x + low.width - 20, y: low.y + 100 };
    const of = (seat) => desk.page().seats.find(({ id }) => id === seat);
    desk.enter(other, pointer('down', alone));
    desk.enter(other, pointer('up', alone));
    desk.enter(other, pointer('move', covered));
    const moved = desk.told().at(-1);
    desk.enter(other, pointer('down', covered));
    desk.enter(other, pointer('up', covered));
    const pressed = of('s1');
    desk.enter(other, pointer('move', alone));
    const away = desk.told().at(-1);
    desk.enter(other, pointer('move', covered));
    desk.pagePress(under);
    const lifted = of('s1');
    const { frame } = desk.page().windows.find(({ id }) => id === over);
    const inFront = JSON.stringify({ ...frame, radius: LAYOUT.RADIUS });
    const covering = (told, at) => told.under.filter((each) => holds(each, at)).map((each) => JSON.stringify(each));
    check(
        'the page is told what covers a cursor over a window of its own order that the shown seat has under ' +
            'another, in the event and in the state: the window in front holds its point, not where the window ' +
            'shows alone, and no more once the shown seat has it in front',
        covering(moved, covered).join() === inFront &&
            covering(pressed, covered).join() === inFront &&
            covering(away, alone).length === 0 &&
            away.under.some((each) => JSON.stringify(each) === inFront) &&
            covering(lifted, covered).length === 0,
        { moved, pressed, away, lifted, windows: desk.page().windows }
    );
    const stage = desk.page().seats.find(({ id }) => id === 's1').under;
    check(
        "what covers a cursor on a window holds what the desktop's page draws over the windows: the band of the " +
            "host's bar, square, and the Dock, round by its card's corners and in but for its sliver",
        stage.some(({ x, y, height, radius }) => x === 0 && y === 0 && height === 28 && radius === 0) &&
            stage.some(
                ({ x, width, radius }) => radius === DOCK.RADIUS && x + width === DOCK.SLIVER && width > DOCK.WIDTH
            ),
        stage
    );
    // The local seat opens the menu of an item; the other seat points at its middle, then again once it is shut.
    desk.dock.items = [{ id: 'a', pinned: true, running: true }];
    const dockPress = (item) =>
        ['down', 'up'].forEach((type) =>
            desk.fromPage('pointer', { part: 'dock', item, type, x: 0, y: 0, button: item ? 2 : 0 })
        );
    dockPress('a');
    const menu = desk.page().dock.menu;
    const middle = menu && { x: menu.frame.x + menu.frame.width / 2, y: menu.frame.y + menu.frame.height / 2 };
    desk.enter(other, pointer('move', middle ?? { x: 0, y: 0 }));
    const overMenu = [desk.told().at(-1), of('s1')];
    dockPress('');
    desk.enter(other, pointer('move', { x: (middle?.x ?? 0) + 1, y: middle?.y ?? 0 }));
    const menuShut = [desk.told().at(-1), of('s1')];
    check(
        "a seat's cursor over the menu of an item open for the seat the page shows is drawn over that menu, cut by " +
            'what covers it with the menu shut and nothing more',
        menu !== null &&
            desk.page().dock.menu === null &&
            overMenu.every((told) => told.under !== null && covering(told, middle).length === 0) &&
            JSON.stringify(overMenu.map((told) => covering(told, middle))) ===
                JSON.stringify(menuShut.map((told) => covering(told, middle))),
        { menu, overMenu, menuShut }
    );
    const card = DOCK.cardOf(rect(0, 28, 800, 600), []);
    const [out, drawnIn] = [
        DOCK.coverOf(rect(0, 28, 800, 600), true, []),
        DOCK.coverOf(rect(0, 28, 800, 600), false, []),
    ];
    check(
        "the Dock covers its card while it is out and the card's sliver while it is in, its frame reaching past the " +
            "desktop's left edge by its corners' radius",
        out.radius === DOCK.RADIUS &&
            out.frame.x === -DOCK.RADIUS &&
            out.frame.x + out.frame.width === card.x + card.width &&
            out.frame.y === card.y &&
            out.frame.height === card.height &&
            drawnIn.frame.x + drawnIn.frame.width === DOCK.SLIVER,
        { card, out, drawnIn }
    );

    // The rules the desktop's page writes for a seat's cursor, each by its selector.
    const style = fs.readFileSync(
        path.join(__dirname, '..', '..', 'deckit', 'deckit-shell', 'shell', 'desktop', 'frame.js'),
        'utf8'
    );
    const ruleOf = (selector) => style.split(`\n    ${selector} {`)[1]?.split('}\n')[0] ?? '';
    const glide = 'transform var(--deckit-move)';
    check(
        'a cursor glides only by how its place was named: at a ref, and at once at a point',
        MARKS.glides('ref') && !MARKS.glides('point') && !MARKS.glides(null),
        [MARKS.glides('ref'), MARKS.glides('point')]
    );
    check(
        "the page's style places a cursor with no transition of its place but where it glides, dims none, and folds " +
            'its name but where it shows',
        ruleOf('.deckit-seat-cursor').includes('transition: opacity') &&
            !ruleOf('.deckit-seat-cursor').includes(glide) &&
            ruleOf('.deckit-seat-cursor[data-glide]').includes(glide) &&
            !style.includes('data-dimmed') &&
            style.includes('clipPath') &&
            ruleOf('.deckit-seat-name').includes('opacity: 0') &&
            ruleOf('.deckit-seat-cursor[data-named] .deckit-seat-name').includes('opacity: 1') &&
            ruleOf('.deckit-seat-focus').includes('var(--deckit-seat)'),
        ['.deckit-seat-cursor', '.deckit-seat-cursor[data-glide]', '.deckit-seat-name'].map(ruleOf)
    );

    const { NAME } = MARKS;
    const left = [
        MARKS.nameLeft(null, 5000),
        MARKS.nameLeft(100, 100),
        MARKS.nameLeft(100, 99 + NAME),
        MARKS.nameLeft(100, 100 + NAME),
        MARKS.nameLeft(100, 9000),
    ];
    check(
        "a cursor's name shows for a set time from its pointer's last act, and not for a pointer that did nothing",
        NAME > 0 && left.join() === `0,${NAME},1,0,0`,
        left
    );
    // The desktop over a clock of its own: what is due after a time runs as the clock reaches it.
    let now = 0;
    const timers = [];
    const timed = desktopOver(createDesktop, {
        clock: { now: () => now, later() {}, after: (next, ms) => timers.push({ next, at: now + ms }) },
    });
    const run = (to) => {
        for (now = Math.min(now, to); now <= to; now += 1)
            for (const due of timers.filter(({ at }) => at <= now)) {
                timers.splice(timers.indexOf(due), 1);
                due.next();
            }
        now = to;
    };
    timed.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
    timed.desktop.control.show();
    const guest = timed.sit('s1');
    const stateOf = () => timed.page().seats.find(({ id }) => id === 's1');
    const sat = stateOf().named;
    const types = () =>
        timed
            .told()
            .map(({ type, named }) => `${type} ${named}`)
            .join();
    timed.enter(guest, pointer('move', { x: 10, y: 20 }));
    run(NAME - 500);
    timed.enter(guest, pointer('down', { x: 30, y: 40 }));
    const second = timed.sit('s2');
    const shown = stateOf().named;
    timed.enter(guest, pointer('up', { x: 30, y: 40 }));
    run(NAME);
    const early = types();
    run(2 * NAME - 501);
    const before = types();
    run(2 * NAME - 500);
    const rest = timed.told().at(-1);
    run(4 * NAME);
    const after = types();
    timed.leave(second);
    const folded = stateOf().named;
    timed.enter(guest, pointer('scroll', { x: 30, y: 40 }));
    check(
        "the page is told a seat's name shows with each thing its pointer does, and once that the pointer rests, the " +
            'name folded, when the time passed since the last of them; the state says the same',
        sat === false &&
            shown === true &&
            early === 'move true,down true,up true' &&
            before === early &&
            JSON.stringify({ ...rest, under: null }) ===
                '{"id":"s1","type":"rest","x":30,"y":40,"buttons":[],"under":null,"named":false,"glide":false}' &&
            after === `${early},rest false` &&
            folded === false &&
            types() === `${after},scroll true`,
        { sat, shown, early, before, rest, after, folded, told: types() }
    );
}

// Where a seat types, as the desktop's page is told it: read of the page its keys go to after its input and as the
// reader tells that the page changed, and gone with its key window.
async function typingChecks({ MARKS, LAYOUT, createDesktop }, check) {
    const { room, line, radius } = MARKS.RING;
    const round = [
        MARKS.ringOf({ x: 10, y: 20, width: 100, height: 30 }),
        MARKS.ringOf({ x: 0, y: 0, width: 8, height: 8 }, 6),
    ];
    check(
        'the ring round a field leaves a little room off it on every side, is a thin line, and its corners go round ' +
            "the field's where their radius is known, and are a little round where not",
        room === 2 &&
            line < 2 &&
            JSON.stringify(round[0]) ===
                JSON.stringify({
                    x: 10 - room - line,
                    y: 20 - room - line,
                    width: 100 + 2 * (room + line),
                    height: 30 + 2 * (room + line),
                    radius: 4,
                    line,
                }) &&
            round[1].radius === 6 + room + line &&
            radius === 4,
        round
    );
    const out = room + line;
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
                JSON.stringify({
                    ring: MARKS.ringOf(moved(answer.rect)),
                    bars: [moved(caret)],
                    caret: true,
                    over: false,
                }) &&
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
            typing()?.ring.x === other.rect.x + 2 - out &&
            typing().ring.y === other.rect.y + 40 - out,
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
            inView.ring.x === laidView.x + 2 - out &&
            inView.ring.y === laidView.y + 40 - out,
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
        `desktop at 0,0 1200x800 mark ${first.mark}`,
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
        '  document 1 content 200x172',
        '    toolbar "Tools" (40 items, 2 in view) 1.1',
        '      textbox "Line" [focused s1, text 5] 1.2',
        '      button "A long na…" (31) [pressed] 1.3',
        '      group (12 elements below) 1.4',
    ].join('\n');
    check(
        'a window reads as its parts and its documents, focused naming the seat, and the knobs reach the reader',
        window.text === outline && window.mark > first.mark && reader.asked.at(-1).knobs.depth === 4,
        window.text
    );
    const other = await served.read(me, { of: 'window', window: 'w2' });
    check(
        'a titled window lists its title bar, and focused names the seat whose keys go there',
        other.text.includes('  titlebar "Second" w2.bar\n') && other.text.includes('[focused local, text 5] 2.2'),
        other.text
    );
    const node = await served.read(me, { of: 'node', ref: '1.2' });
    const under = [
        'textbox "Line" [focused s1, text 5] 1.2 at 110,320 100x30 scroll 0 of 900',
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
            (await refused(served.read(me, { of: 'node', ref: '1.9' }))) === 'GONE' &&
            (await refused(served.read(me, { of: 'window', window: 'w9' }))) === 'NOT_FOUND' &&
            (await refused(served.read(me, { of: 'all' }))) === 'INVALID_ARGUMENT',
        ''
    );
    check(
        'a window read with no window and a node read with no ref are a key missing',
        (await refused(served.read(me, { of: 'window' }))) === 'INVALID_ARGUMENT' &&
            (await refused(served.read(me, { of: 'node' }))) === 'INVALID_ARGUMENT',
        ''
    );
    const negative = [
        { of: 'window', window: 'w1', text: -1 },
        { of: 'window', window: 'w1', depth: -1 },
        { of: 'window', window: 'w1', items: -1 },
        { of: 'node', ref: 'w1.bar', lines: -1 },
        { of: 'changes', since: -1 },
    ];
    const refusedCounts = [];
    for (const query of negative) refusedCounts.push(await refused(served.read(me, query)));
    for (const count of [{ button: -1 }, { count: -1 }])
        refusedCounts.push(
            await refused((async () => desk.enter(me, { ...pointer('down', { x: 5, y: 5 }), ...count }))())
        );
    check(
        'a negative number where a reading or a pointer event takes a count is refused as no count',
        refusedCounts.every((kind) => kind === 'INVALID_ARGUMENT') &&
            (await served.read(me, { of: 'window', window: 'w1', text: 0, depth: 0, items: 0 })).mark >= 0,
        refusedCounts.join()
    );

    const from = (await served.read(me, { of: 'desktop' })).mark;
    const quiet = await served.read(me, { of: 'changes', since: from });
    reader.counts.set('content-1', 2);
    reader.heard({ page: all[0].surface, document: 4, count: 2 });
    const typed = await served.read(me, { of: 'changes', since: from });
    check(
        'what changed after a typed line is one line, and nothing where nothing did',
        quiet.text === `changes ${from} to ${from}` &&
            typed.text === `changes ${from} to ${from + 1}\n~ textbox "Line" [focused s1, text 6] 1.2`,
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
            old.text.split('\n').slice(1).join() === '~ textbox "Line" [focused s1, text 6] 1.2' &&
            (await refused(served.read(me, { of: 'changes', since: old.mark + 5 }))) === 'STALE',
        JSON.stringify({ left: left.mark, old })
    );

    desk.puts.length = 0;
    const entering = async (event) => desk.enter(me, event);
    const byRef = (type, ref) => entering({ ...pointer(type, {}), ref });
    const toldBefore = desk.told().length;
    const acted = await byRef('down', '1.2');
    const lifted = await desk.enter(me, pointer('up', acted.at));
    const glided = desk
        .told()
        .slice(toldBefore)
        .map(({ type, glide }) => `${type} ${glide}`)
        .join();
    check(
        'the page is told a cursor glides to where an event at a ref puts it, and is there at once by one at a point',
        glided === 'down true,up false',
        glided
    );
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
    const order = await Promise.all([byRef('down', '1.2'), desk.enter(me, pointer('up', { x: 160, y: 335 }))]);
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
    desk.puts.length = 0;
    const hovering = await byRef('move', '1.2');
    const away = await desk.enter(me, pointer('move', { x: 5, y: 790 }));
    const hovered = desk.puts.map(({ page: to, event }) => [to, event.type, event.x, event.y].join()).join(' ');
    check(
        'a move at a ref with no button held reaches the page there, and the page hears it leave as it moves off',
        hovering.over === 1 && away.over !== 1 && hovered === 'content-1,move,60,35 content-1,move,-1,-1',
        JSON.stringify({ hovering, away, puts: desk.puts })
    );
    check(
        'a place that is neither a point nor a ref, and a ref gone are refused',
        (await refused(entering({ ...pointer('down', { x: 1, y: 1 }), ref: '1.2' }))) === 'INVALID_ARGUMENT' &&
            (await refused(entering(pointer('down', {})))) === 'INVALID_ARGUMENT' &&
            (await refused(entering({ event: 'act', ref: '1.2', action: 'press' }))) === 'INVALID_ARGUMENT' &&
            (await refused(byRef('down', 'w9.close'))) === 'GONE',
        ''
    );

    const whole = await served.read(me, { of: 'picture', scale: 2 });
    const one = await served.read(me, { of: 'picture', window: 'w1' });
    const element = await served.read(me, { of: 'picture', ref: '1.2' });
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
            (await refused(served.read(me, { of: 'picture', window: 'w1', ref: '1.2' }))) === 'INVALID_ARGUMENT',
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
    const raised = await byRef('down', '1.2');
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
    desk.puts.length = 0;
    const onCover = await desk.enter(me, pointer('move', { x: 160, y: 335 }));
    desk.desktop.close(cover);
    await desk.enter(me, pointer('move', { x: 5, y: 790 }));
    const toCover = desk.puts.filter(({ page }) => page === 'content-3').map(({ event }) => `${event.x},${event.y}`);
    check(
        "a page whose window closes under a seat's pointer hears no leave once it is gone",
        onCover.over === 3 && toCover.length === 1 && toCover[0] !== '-1,-1',
        JSON.stringify({ onCover, puts: desk.puts })
    );
}

// A document's number as a seat reads it, the same whichever of two pages the environment heard first and answers
// first: the window read first lists 1, and a number stays across readings.
async function numberingChecks({ LAYOUT, createDesktop }, check) {
    const once = async (first) => {
        const heard = { 'content-1': first ? 6 : 7, 'content-2': first ? 7 : 6 };
        const asked = [];
        const read = {
            listen() {},
            outline: async (page) => {
                if (page.name === 'content-1') await new Promise((done) => setTimeout(done, 20));
                const document = heard[page.name];
                const lines = [{ depth: 0, role: 'textbox', name: 'Line', states: [], ref: `${document}.2` }];
                return { document, count: 1, width: 200, height: 172, lines };
            },
            node: async (page, ref) => {
                asked.push(`${page.name} ${ref}`);
                const line = { depth: 0, role: 'textbox', name: 'Line', states: [], ref };
                return {
                    document: heard[page.name],
                    count: 1,
                    line,
                    rect: { x: 0, y: 0, width: 9, height: 9 },
                    lines: [],
                };
            },
        };
        const desk = desktopOver(createDesktop, { read });
        desk.desktop.control.present({ titleBar: { height: 28, controlsWidth: 70 } });
        desk.desktop.control.show();
        for (const id of [1, 2]) {
            const page = { name: `page-${id}`, mod: 'a' };
            const surface = { name: `content-${id}`, of: page };
            const [size, minimum, bar] = [{ width: 200, height: 200 }, { width: 0, height: 0 }, LAYOUT.DEFAULT_BAR];
            desk.desktop.open({ id, mod: 'a', name: `w${id}`, level: 'normal', page, surface, size, minimum, bar });
            desk.openSurfaces(id);
        }
        const me = desk.sit('s1');
        const documentsOf = async (window) =>
            (await desk.seats.served.read(me, { of: 'window', window, format: 'json' })).data.documents
                .map(({ document, lines }) => `${document} ${lines[0].ref}`)
                .join();
        const both = await Promise.all([documentsOf('w2'), documentsOf('w1')]);
        const again = await documentsOf('w2');
        const node = (await desk.seats.served.read(me, { of: 'node', ref: '2.2', format: 'json' })).data.node.ref;
        return { both, again, node, asked };
    };
    const runs = [await once(true), await once(false)];
    check(
        'a document is numbered as a reading first lists it, whichever page was heard or answered first, and keeps it',
        runs.every(
            ({ both, again, node }) => both.join(' ') === '1 1.2 2 2.2' && again === '1 1.2' && node === '2.2'
        ) &&
            runs[0].asked.join() === 'content-1 6.2' &&
            runs[1].asked.join() === 'content-1 7.2',
        JSON.stringify(runs)
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
// `pictures` each picture the stage was asked for. `web` stands in for members of what the web engine answered, and
// `dialogs` is what the desktop served of the dialogs and the asks it refused.
function desktopOver(
    createDesktop,
    { state = {}, clock, read = { listen() {} }, overlays = () => [], ownerOf = (page) => page, web = {} }
) {
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
    // What the desktop served deckit of the dialogs, the asks it refused, which nothing withdraws here, and those it
    // answered, `[ask, value]`, each withdrawn then as deckit does.
    const dialogs = { served: null, refused: [], answered: [] };
    // The seats as deckit keeps them: the local one, those `sit` opens, what the desktop serves, the seats judged
    // idle, what a seat was told of a window held, each event put in a page and each page kept from the keyboard.
    const local = { id: 'local', local: true, user: { id: 'local', name: 'Local' }, source: 'of-local' };
    const seats = { open: [local], opened: null, closed: null, served: null, idle: new Set(), held: [], told: [] };
    const machine = [];
    const puts = [];
    const reserved = new Map();
    // The Dock's items, the item dragged, and what the desktop handed it: each click on an item and each entry chosen
    // with the seat it is of, each order shown while an item is dragged, and each order the items were let go in.
    const dock = { items: [], held: null, clicked: [], chosen: [], shown: [], reordered: [] };
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
                // Asked of a page: answered, or refused as the page goes, by `taken` or `gone` of what is sent.
                invoke: (page, payload) =>
                    new Promise((taken, gone) => sent.push({ channel: declared.channel, page, payload, taken, gone })),
            }),
        },
        log: { warn() {}, error() {} },
        seats: {
            local,
            list: () => seats.open,
            onOpen: (listener) => (seats.opened = listener),
            onClose: (listener) => (seats.closed = listener),
            // As deckit answers: nothing of a seat it closed.
            isIdle: (seat) => {
                if (!seats.open.includes(seat)) throw new Error('no such seat is open');
                return seats.idle.has(seat.id);
            },
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
        pages: {
            whenEnds() {},
            dialogs: (served) => {
                dialogs.served = served;
                return {
                    answer: (ask, value) => {
                        dialogs.answered.push([ask, value]);
                        served.withdrawn(ask);
                    },
                    refuse: (ask) => dialogs.refused.push(ask),
                };
            },
        },
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
            ownerOf,
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
        web: { pageFor: () => null, placeOf: () => null, onPlaced() {}, onPage() {}, ...web },
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
        DOCK: {
            items: () => dock.items,
            dragged: () => dock.held,
            hand: {
                click: (id, seat) => dock.clicked.push([id, seat]),
                choose: (id, entry, seat) => dock.chosen.push([id, entry, seat]),
                // The Dock has the desktop drawn again as what it shows changes.
                drag: (id = null, ids = []) => {
                    dock.held = id;
                    dock.shown.push([id, ids]);
                    desktop.update();
                },
                reorder: (ids) => {
                    dock.held = null;
                    dock.reordered.push(ids);
                    desktop.update();
                },
            },
        },
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
        deckit,
        handlers,
        sent,
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
            for (const name of [`frame-${id}`, `buttons-${id}`, `dialog-${id}`]) allowed.get(name)({ name });
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
        leave: (seat) => {
            seats.open.splice(seats.open.indexOf(seat), 1);
            seats.closed(seat);
        },
        enter: (seat, event) => seats.served.input(seat, { ...event, source: seat.source }),
        machine,
        carried: (event) => heard.carried(event),
        dialogs,
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
