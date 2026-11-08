// The desktop's window manager (deckit-shell/shell/desktop/model/window-manager): the windows every seat shares and
// each seat's own order, key window and minimized windows, a window another seat holds left to it, the key window
// passed on as one closes or is minimized, and a frame no smaller than its minimum; and where windows go
// (model/layout): a new one cascaded from the key window or centred, a restored one kept reachable, a resize held to
// the minimum, zoom to the desktop but the Dock's sliver, and the frame's parts. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const WM = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'window-manager.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'desktop', 'model', 'layout.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'dock', 'model', 'dock.js'));
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
    const opened = manager.open('me', 1, { frame: at(0), minimum });
    manager.open('me', 2, { frame: at(10), minimum });
    check(
        'a window opens in front for every seat, the key window of the seat that opened it',
        opened === WM.KEY && order('me') === '1,2' && order('you') === '1,2' && manager.keyOf('me') === 2,
        { me: order('me'), you: order('you'), key: manager.keyOf('me') }
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
    manager.open('me', 3, { frame: at(20), minimum }, { activates: false });
    check(
        'a window opened without activating leaves the key window where it is',
        manager.keyOf('me') === 2 && order('me') === '2,1,3',
        { key: manager.keyOf('me'), order: order('me') }
    );
    manager.orderFront('me', 3);
    check('making another window key lets go of the one before', !manager.isKey(2) && manager.keyOf('me') === 3, '');

    manager.minimize('me', 3);
    check(
        "a seat's minimized window leaves its view alone, and its key window is the next it does not minimize",
        order('me') === '2,1' &&
            order('you') === '2,1,3' &&
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} desktop checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
