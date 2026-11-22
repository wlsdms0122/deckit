import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LAYOUT from './model/layout.js';
import * as CAMERA from './model/camera.js';
import * as ANCHORED from './model/anchored.js';
import * as LEVELS from './model/levels.js';
import * as MARKS from './model/marks.js';
import * as PAGE from './model/page-name.js';
import * as WM from './model/window-manager.js';
import * as MOTION from './model/motion.js';
import * as ACTIVATION_MODEL from './model/activation.js';
import * as SHOWING_MODEL from './model/showing.js';
import * as DIALOG_MODEL from './model/dialog.js';
import * as DOCK_MODEL from '../dock/model/dock.js';
import * as MODS from '../mods/index.js';
import * as COLOURS_MODEL from './model/colours.js';
import { SEAT_COLOURS } from '../../../deckit-sdk/shell/ui/token/index.js';
import * as ROUTING from './model/routes.js';
import * as SERVED from './model/served.js';
import { createReading } from './reading.js';

// How many frames a second a window's motion is drawn at.
const FRAMES = 120;
// The parts of the Dock a seat's pointer is on: an item, and an item's menu.
const DOCK_PARTS = Object.freeze(['dock', 'dock-menu']);
// Whether a point is in a rect.
const within = ({ x, y, width, height }, point) =>
    point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
// What of the rect `one` is in the rect `other`, or null where nothing is.
const cut = (one, other) => {
    const [x, y] = [Math.max(one.x, other.x), Math.max(one.y, other.y)];
    const width = Math.min(one.x + one.width, other.x + other.width) - x;
    const height = Math.min(one.y + one.height, other.y + other.height) - y;
    return width > 0 && height > 0 ? { x, y, width, height } : null;
};
// How long after it is asked where a seat types is read again, in ms: a frame, by which the page took the input.
const REREAD = 16;

// `deckit` is what connect answered, `state` the shell's own state, `web` what the web engine answered (`pageFor`,
// `placeOf`, `onPlaced`), `host` the app's answers, `REGION` the regions mods give their children, `PAGES` the shell's
// pages, `OVERLAY` their overlays, `KEY` the keys of the app, `makeStage()` a stage to lay them on (environment:
// SHELL.stage), `actionOnDoubleClick()` what the person set a double click on a title bar to do (environment: SHELL),
// `input` what tells the machine's input and puts a seat's in a page (environment: SHELL `input`), `read` what reads
// a page (environment: SHELL `read`), and
// `clock` what tells time: `now()` in ms, `later(next)`, next called once the next frame is due, and `after(next, ms)`,
// next called once `ms` passed.
export function createDesktop({
    REGION,
    PAGES,
    OVERLAY,
    KEY,
    makeStage,
    actionOnDoubleClick,
    input: INPUT,
    read: READ,
    deckit,
    state: STATE,
    web,
    host,
    clock = {
        now: () => performance.now(),
        later: (next) => setTimeout(next, 1000 / FRAMES),
        after: (next, ms) => setTimeout(next, ms),
    },
}) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const FRAMES = 'window-frames';
    // The seat at the host window, whose view it shows: `deckit.seats.local`, by its id, as every seat is named here.
    let LOCAL = 'local';
    const seated = new Map(); // seat id -> the seat as deckit tells it, while it is open
    const sources = new Map(); // a seat's source, the word its devices' events carry -> its id
    // seat id -> what its hand holds: `moving`, `{ id, from, grab, pointer }`, the window a drag of its title bar or
    // its content's drag regions moves, from the frame it had at the press, `grab` where the press was in that frame,
    // and where the pointer is on the stage now; `dropping`, the tile that window takes let go now, or null; `pointer`,
    // where its pointer is on the desktop, or null; `reach`, `{ id, edge }`, the side or corner of the window `id` in
    // whose reach that pointer is (reaching), or null; `down`, where its press went until it lets go, a page of the
    // window `id` with `inside`, the page's top left from that window's frame, or a `part` of the window `id` with its
    // `grip`, the Dock's item `id`, its `part` 'dock', pressed at `from` and dragged once `drags`, or the entry `id` of
    // an item's menu, its `part` 'dock-menu'; `dock`, whether the Dock is out for it, as the desktop's page tells of
    // the seat it shows and as its pointer says of any other; `menu`, the id of the Dock's item whose menu is open for
    // it, or null; and `keys`, `{ id, page }`, the page of the window `id` that took its last press there, where its
    // keys and text go while that window holds its keyboard, or null for the window's content, the local seat's being
    // the machine's; `buttons`, those of its pointer that are held now; `key`, its key window as update() last saw it;
    // `waits`, a promise of the turn of its last event that is not done, or null; `acted`, when on the clock its
    // pointer last did something while the page drew its cursor, or null; `rests`, whether the fold of its name is due;
    // `camera`, the top left `{ x, y }` of its camera (cameraOf); `screenSize`, the size its screen told, or null; and
    // `pressed`, the window its last press made key, which moves no camera. The view shown for it is SHOWING's.
    const hands = new Map();
    // `[{ page, seat }]`: each page whose one pointer a seat's move placed last (ROUTING.hovered).
    let pointers = [];
    const COLOURS = COLOURS_MODEL.createColours(SEAT_COLOURS); // the colour each seat here is told apart by
    let tells = null; // what deckit answered the shell's serving with: what tells a seat
    // seat id -> where it types, as the reader last answered of the page its keys go to: `{ page, ring, bars, caret }`,
    // `ring` the rect of what has the focus there, or null with nothing focused, and `bars` the rects of what is
    // selected in it or, `caret` true, the one its caret is at, each in the page.
    const typings = new Map();
    const unread = new Set(); // the seats whose typing is read again as the next frame is due
    // The seat whose view the host window shows in the local seat's place, by its id, the local seat following it; or
    // null, the view the local seat's own.
    let followed = null;
    let ended = false; // whether the key that ended a follow is still down: what it would do is not done
    const seatListeners = new Set(); // what hears who sits and who is followed change
    let seatsTold = ''; // what they were told of last, written
    const MANAGER = WM.createWindowManager();
    const ACTIVATION = ACTIVATION_MODEL.createActivation();
    // On which seats' screens each view is, and the seats whose keyboard it holds.
    const SHOWING = SHOWING_MODEL.createShowing();
    // What each of the shell's keys does, by its id, to the key window of the seat that pressed it. Close Window puts
    // away the view shown for that seat where there is one, and closes nothing then.
    const KEY_ACTIONS = Object.freeze({
        closeWindow: (seat) => putAway(seat) || (keyWindow(seat) && clicked(seat, keyWindow(seat), 'close')),
        minimizeWindow: (seat) => keyWindow(seat) && clicked(seat, keyWindow(seat), 'minimize'),
        cycleWindows,
        tileLeft: (seat) => tileKey(seat, 'left'),
        tileRight: (seat) => tileKey(seat, 'right'),
        tileFill: (seat) => tileKey(seat, 'fill'),
        tileTopLeft: (seat) => tileKey(seat, 'top-left'),
        tileTopRight: (seat) => tileKey(seat, 'top-right'),
        tileBottomLeft: (seat) => tileKey(seat, 'bottom-left'),
        tileBottomRight: (seat) => tileKey(seat, 'bottom-right'),
        restoreWindow: (seat) => keyWindow(seat) && restore(seat, keyWindow(seat)),
    });
    // Which mods may activate for a seat, as its input and the requests mods make of one another hand it on.
    const activation = Object.freeze({
        input: ACTIVATION.input,
        request: ACTIVATION.request,
        mayActivate: ACTIVATION.mayActivate,
    });
    const windows = new Map(); // id -> a normal window, as WINDOWS made it, while it is open
    const panels = new Map(); // id -> a panel window, as WINDOWS made it, while it is open, in the order they opened
    const inPanels = new Set(); // the children's pages the panel windows' regions show, as last laid
    const anchors = new Map(); // a window's id -> the anchors its mod told (ANCHORED), while it is open
    const heard = new WeakSet(); // the children's pages whose presses are heard
    const listeners = new Set();
    // The desktop's page, the documents it opened by name, and what it was last told.
    const desktop = { page: null, surfaces: new Map(), sent: '' };
    let WINDOWS = null;
    let DOCK = null;
    let stage = null; // where the pages are laid, which the host app places
    let frames = {}; // mod id -> window name -> the frame it was left at, `{ level, x, y, width, height }`
    const pressers = new Map(); // window id -> the seat that pressed it last, which what its content asks is done for
    const inWindows = new Map(); // a child's page -> the window or panel window whose region shows it, as last laid
    const fronts = new Map(); // a mod's page -> its front window or panel window, where its overlay lies, as last laid
    // the dialogs the pages ask, where each stands in its window, and the day it is at the machine, yyyy-mm-dd
    const DIALOGS = DIALOG_MODEL.createDialogs({
        today: () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
    });
    const asking = new Map(); // a dialog's ask -> the page that asked it, while it is up
    let answering = null; // `{ answer(ask, value), refuse(ask) }`, what deckit answered as the dialogs were served
    const onDesktop = new Map(); // a page laid in the host window's view -> its rect on the desktop, as last laid
    // id -> what is drawn of a window: `{ window, motion, value, velocity, late, leaving, gone }`, `value` its frame
    // and opacity as drawn last, `leaving` 'closed' or 'minimized' while it goes, `gone()` once a closed one has
    const drawn = new Map();
    const handHeld = new Set(); // the windows whose frame follows the hand now, drawn where it is at once
    // Whether the system asks for reduced motion, as the desktop's page tells it, or null until it does: a frame is
    // then drawn where it is at once.
    let reduced = null;
    let ticking = false; // whether the next frame of a motion is due
    let atOnce = false; // whether what is laid now is drawn where it is at once, as the desktop changes size
    let focused = null; // the key window the machine's keyboard was last given to
    let focusedContent = false; // whether the keyboard was given to its content, which may open after it
    let shown = false;
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let strip = { height: 0, controlsWidth: 0 }; // the host's bar over the desktop's top
    let glass = []; // the materials laid under the desktop's page, as it last told
    // What a seat reads of the desktop, from what is kept here.
    const READING = createReading({
        READ,
        OVERLAY,
        web,
        deckit,
        desk: {
            MANAGER,
            ACTIVATION,
            windows,
            panels,
            hands,
            seated,
            colourOf: COLOURS.of,
            stage: () => stage,
            dock: () => DOCK,
            dockMenu: menuOf,
            tells: () => tells,
            area,
            cameraOf,
            panelFrames: panelsOf,
            keyboardsOf,
            laidFor,
            laidOfWindow,
            windowAt,
            typingIn,
            dialogsIn: (id) => DIALOGS.inWindow(id),
            waits: (page) =>
                [...asking].some(([ask, asker]) => asker === page && DIALOG_MODEL.waitsOn(DIALOGS.of(ask))),
        },
    });

    // MARK: - Initializer
    // MARK: - Public
    // The desktop in the host window, the local seat's view of it: the backdrop, the normal windows `WINDOWS` opens in
    // the seat's order, each its content between the frame under it and the buttons over it with the children its
    // regions show, and the Dock and the host's bar over them, `DOCK` giving the Dock's items, and the panel windows in
    // that bar. Each mod's page with a window there is laid under the backdrop, at its front window, so what its
    // overlay draws for a window lands over that window. The machine's keyboard is the local seat's: a key pressed in a
    // page reaches the mod whose page it is, a chord the mod that took it, for the seat that pressed it. Every seat
    // deckit opens sits here, and what a seat's devices do enters through `deckit.seats.input`, the machine's as the
    // local seat's. The shell names to deckit the kinds of device and the outputs of model/served.js, and tells a seat
    // the text a key of its copied or cut. The host window shows the local seat's view, or that of the seat the local
    // one follows (follow).
    function start(given) {
        WINDOWS = given.WINDOWS;
        DOCK = given.DOCK;
        frames = STATE.read(FRAMES, {});
        LOCAL = deckit.seats.local?.id ?? LOCAL;
        sit({ id: LOCAL });
        for (const seat of deckit.seats.list()) sit(seat);
        deckit.seats.onOpen(sit);
        deckit.seats.onClose(leave);
        tells = deckit.seats.serve({
            input: entered,
            events: SERVED.EVENTS,
            read: READING.read,
            reads: SERVED.READS,
            tells: SERVED.TELLS,
        });
        if (deckit.seats.local?.source) INPUT.machine(deckit.seats.local.source);
        INPUT.copied(copied);
        READ.listen(({ page }) => {
            for (const [seat, typing] of typings) if (typing.page === page) reread(seat);
        });
        READING.start();
        answering = deckit.pages.dialogs({ whose, asked: dialogAsked, withdrawn: dialogWithdrawn });
        web.onPlaced(dialogMoved);
        INPUT.listen(carried);
        deckit.mods.onRequest(({ from, to }) => ACTIVATION.request(from, to));
        KEY.monitor((page, _keystroke, source) => ACTIVATION.input(seatOf(source), modAt(page)));
        KEY.onChord((mod, source) => ACTIVATION.input(seatOf(source), mod));
        KEY.onUnhandled(escaped);
        KEY.start(pressKey);
        stage = makeStage();
        stage.whenResized(resized);
        listen();
        makePage();
        deckit.mods.onChange(update);
        for (const name of deckit.mods.notifications) deckit.mods.observe(name, update);
        REGION.onChange(update);
        OVERLAY.onChange(() => layout());
        // With the core down nothing on deckit works, so the desktop's page covers it and asks for a restart.
        deckit.core.onDown((why) => {
            down = why;
            update();
            if (shown) focus();
        });
    }

    // A normal window opens in the camera of the seat its mod acts for, the local seat's where none: where its mod last
    // left a normal window of its name, or cascaded from that seat's key window, or its front window on screen where
    // none is key, either where it meets the zoom area, where it left none or one of that name is open, placed at its
    // size no smaller than its minimum, brought forward as orderFront brings it. Its `bar` is its title bar
    // (LAYOUT.barOf): the shell draws the bar of a titled one, holding its `title`, over its content.
    function open(window, { activates = true } = {}) {
        const seat = ACTIVATION.causeOf(window.mod) ?? LOCAL;
        const desktopNow = area(seat);
        const zoomArea = LAYOUT.zoomedIn(desktopNow);
        const key = keyWindow(seat);
        const keyFrame = key && MANAGER.frameOf(key.id);
        const front = MANAGER.viewOf(seat).findLast(({ frame }) => CAMERA.meets(zoomArea, frame))?.frame ?? null;
        const after = keyFrame && CAMERA.meets(zoomArea, keyFrame) ? keyFrame : front;
        const twin = [...windows.values()].some(({ mod, name }) => mod === window.mod && name === window.name);
        const restored = (!twin && keptFrameOf(window)) || null;
        const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
        const size = {
            width: Math.max(window.size.width, minimum.width),
            height: Math.max(window.size.height, minimum.height),
        };
        const frame = LAYOUT.placed({ size, restored, after, desktop: desktopNow, bar: window.bar.height });
        windows.set(window.id, window);
        for (const name of [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)])
            PAGES.allowSurface(desktop.page, name, (surface) => openSurface(name, surface));
        // The dialog's surface keeps the keyboard it takes, for a prompt's field.
        PAGES.allowSurface(desktop.page, PAGE.dialogOf(window.id), (surface) => {
            desktop.surfaces.set(PAGE.dialogOf(window.id), surface);
            update();
        });
        MANAGER.open(null, window.id, { frame, minimum });
        orderFront(window, { activates });
    }

    // A panel window stands at its edge, or as a view under the anchor it binds by (`anchor`) or at the place it names
    // (`place`, ANCHORED), where panelFrames() places it, in front of every normal window: its content lies on the
    // material the desktop's page draws for it, cut to its frame rounded as radiusOf has it. One in the bar is never
    // key. A view is on the screens it
    // is shown for (SHOWING): with `activates` false every seat's, else that of the seat its mod acts for, as
    // orderFrontPanel shows.
    function openPanel(window, { activates = true } = {}) {
        panels.set(window.id, window);
        if (ANCHORED.isView(window)) SHOWING.open(window.id, { activates });
        if (!orderFrontPanel(window, { activates })) update();
    }

    function closePanel(window) {
        if (!panels.delete(window.id)) return;
        anchors.delete(window.id);
        SHOWING.close(window.id);
        update();
    }

    // A panel window in the bar stands where it is. A view is shown, where `activates` is true, for the seat its mod
    // acts for. Answers whether the desktop was laid again for it.
    function orderFrontPanel(window, { activates = true } = {}) {
        if (!panels.has(window.id) || !activates || !ANCHORED.isView(window)) return false;
        return shownBy(window, SHOWING.show);
    }

    // A view, for the seat its mod acts for: put away where it is shown by activation, shown where it is not. Nothing
    // for any other window.
    function togglePanel(window) {
        if (panels.has(window.id) && ANCHORED.isView(window)) shownBy(window, SHOWING.toggle);
    }

    // A view shown or toggled, `rule` of SHOWING, for the seat its mod acts for (ACTIVATION.causeOf), and for none
    // where it may activate for no seat; the mod is told no seat. The host window comes up where the view has the
    // local seat's keyboard after it. Answers true.
    function shownBy(window, rule) {
        rule(window.id, ACTIVATION.causeOf(window.mod));
        update();
        if (SHOWING.of(LOCAL) === window.id) host.show();
        return true;
    }

    // The view shown for `seat` by activation is put away for it, its keyboard back with its key window. Answers
    // whether one was.
    function putAway(seat) {
        if (!SHOWING.putAway(seat)) return false;
        update();
        return true;
    }

    // Escape a page left unhandled, pressed in the view shown for the seat that pressed it: the view is put away for
    // that seat. Answers whether it was.
    function escaped(page, { code, meta, control, alt, shift }, source) {
        if (code !== 'Escape' || meta || control || alt || shift || !shown) return false;
        const seat = seatOf(source);
        const view = SHOWING.of(seat);
        return view !== null && windowAt(page)?.id === view && putAway(seat);
    }

    // `seat` pressed in a panel window: its input reached the window's mod. One in the bar, or a view shown for every
    // seat, leaves the seat's keyboard with its key window, or with the view that holds it; a view shown for the seat
    // by activation holds its keyboard already.
    function pressPanel(seat, window) {
        if (!panels.has(window.id)) return;
        ACTIVATION.input(seat, window.mod);
        if (SHOWING.of(seat) === window.id) update();
        else if (seat === LOCAL) giveBack();
    }

    // The local seat pressed a child's view shown in a panel window: as a press in the panel window, its input reached
    // the child's mod, and the keyboard stays with the key window.
    function pressPanelChild(page) {
        if (!inPanels.has(page)) return;
        ACTIVATION.input(LOCAL, deckit.mods.modOf(page));
        giveBack();
    }

    // The rects the mod of a window or of a panel window names in its content, `told` as the shell's windows hold them
    // (deckit-sdk shell/window/model/anchor.js heldTo), in place of those it told before: kept while the window is
    // open, each standing on the stage where the window's content is (standing).
    function setAnchors(window, told) {
        if (!windows.has(window.id) && !panels.has(window.id)) return;
        if (JSON.stringify(anchors.get(window.id) ?? []) === JSON.stringify(told)) return;
        anchors.set(window.id, told);
        update();
    }

    // A mod left with no window open asks for no seat's attention.
    function close(window) {
        if (!windows.delete(window.id)) return;
        anchors.delete(window.id);
        MANAGER.close(null, window.id);
        pressers.delete(window.id);
        pointers = pointers.filter(({ page }) => windowAt(page));
        if (![...windows.values()].some(({ mod }) => mod === window.mod)) ACTIVATION.cancelAttention(window.mod);
        for (const [seat, hand] of hands) {
            if (hand.moving?.id === window.id) endDrag(seat);
            if (hand.down?.id === window.id) hand.down = null;
        }
        const surfaces = [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id), PAGE.dialogOf(window.id)].map((name) => {
            const surface = desktop.surfaces.get(name);
            desktop.surfaces.delete(name);
            return surface;
        });
        const gone = () => surfaces.forEach((surface) => surface && PAGES.close(surface));
        const shown = drawn.get(window.id);
        if (shown && !shown.leaving && reduced !== null) {
            shown.gone = gone;
            shown.surfaces = surfaces;
        } else {
            drawn.delete(window.id);
            gone();
        }
        update();
    }

    // Brought forward as its mod asks, for each seat, the local one first: where the mod may activate for the seat, in
    // front, and its key window unless `activates` is false, the host window coming up for the local seat; where it
    // may not, right behind the seat's key window, not key, its mod asking for the seat's attention unless `activates`
    // is false, or in front where the seat has no key window to hold it behind.
    function orderFront(window, { activates = true } = {}) {
        if (!windows.has(window.id)) return;
        for (const seat of hands.keys()) {
            if (ACTIVATION.mayActivate(seat, window.mod)) MANAGER.orderFront(seat, window.id, { activates });
            else holdBack(seat, [window.id], window.mod, { activates });
        }
        const shows = activates && ACTIVATION.mayActivate(LOCAL, window.mod);
        update();
        if (shows) host.show();
    }

    // `seat` pressed in the window, on its frame or in its content: its input reached the window's mod, and the
    // window comes in front in its order, as its key window, whichever other seats' key window it is.
    function press(seat, window) {
        if (!windows.has(window.id)) return;
        ACTIVATION.input(seat, window.mod);
        MANAGER.orderFront(seat, window.id);
        pressers.set(window.id, seat);
        const hand = hands.get(seat);
        if (hand) hand.pressed = window.id;
        update();
    }

    function minimize(seat, window) {
        MANAGER.minimize(seat, window.id);
        update();
    }

    function zoom(seat, window) {
        MANAGER.zoom(seat, window.id, LAYOUT.tiledIn(area(seat)));
        update();
    }

    // In the tile `name` of the tile area (LAYOUT.TILES), where the window is resizable: the frame it had before is
    // kept for its return, and what the person left it at stays that frame.
    function tile(seat, window, name) {
        if (!window.bar.enabled.zoom || !windows.has(window.id)) return;
        MANAGER.tile(seat, window.id, name, LAYOUT.tileOf(name, LAYOUT.tiledIn(area(seat))));
        update();
    }

    // Out of its tile, back at the frame it had before it took one; nothing for a window in none.
    function restore(seat, window) {
        if (MANAGER.tileNameOf(window.id) === null) return;
        MANAGER.untile(seat, window.id);
        update();
    }

    // A shell key that tiles the seat's key window.
    function tileKey(seat, name) {
        const key = keyWindow(seat);
        if (key) tile(seat, key, name);
    }

    // A mod's resize of its window: the size set, its top left where it was, brought into reach in the camera of the
    // seat the mod acts for, the local seat's where none.
    function resize(window, { width, height }) {
        const frame = MANAGER.frameOf(window.id);
        if (!frame) return;
        const seat = ACTIVATION.causeOf(window.mod) ?? LOCAL;
        MANAGER.setFrame(seat, window.id, LAYOUT.sizedIn(frame, { width, height }, area(seat), window.bar.height));
        remember(window);
        update();
    }

    // `seat`'s drag of the content's drag regions, or of the title bar of a titled window, `dx`, `dy` from the press,
    // `grab`
    // `{ x, y }` where it pressed in the frame, the middle of its title bar where it is not told: the window follows,
    // its edges landing on those it comes within LAYOUT.SNAP of, never over the host's bar, and is left where its
    // title bar can be reached. A tiled one leaves its tile as it starts to move, at the frame it had before, the
    // pointer held where it grabbed it across the title bar. With the pointer at a side of the tile area, the tile it
    // takes there is shown, and the window takes it as it is let go.
    function move(seat, window, phase, dx, dy, grab = null) {
        const hand = hands.get(seat);
        if (!hand) return;
        if (phase === 'began') {
            const from = MANAGER.frameOf(window.id);
            const at = grab ?? { x: Math.round(from.width / 2), y: Math.round(window.bar.height / 2) };
            hand.moving = { id: window.id, from, grab: at, pointer: { x: from.x + at.x, y: from.y + at.y } };
            press(seat, window);
            return;
        }
        const { moving } = hand;
        if (moving?.id !== window.id) return;
        const { from, grab: at } = moving;
        moving.pointer = { x: from.x + at.x + dx, y: from.y + at.y + dy };
        if ((dx || dy) && MANAGER.tileNameOf(window.id) !== null) {
            const before = MANAGER.standardFrameOf(window.id);
            const across = Math.round((at.x * before.width) / from.width);
            moving.from = { ...before, x: from.x + at.x - across, y: from.y };
            moving.grab = { x: across, y: at.y };
            moving.pointer = { x: from.x + at.x + dx, y: from.y + at.y + dy };
            MANAGER.untile(seat, window.id, moving.from);
        }
        const tileArea = LAYOUT.tiledIn(area(seat));
        const others = MANAGER.viewOf(seat)
            .filter(({ id }) => id !== window.id)
            .map(({ frame }) => frame);
        const goes = { ...moving.from, x: moving.from.x + dx, y: moving.from.y + dy };
        const snapped = LAYOUT.snapped(goes, ['top', 'bottom', 'left', 'right'], others, tileArea);
        const frame = LAYOUT.underBar(snapped, area(seat), { moved: true });
        const drop = window.bar.enabled.zoom ? LAYOUT.dropAt(moving.pointer, tileArea) : null;
        handHeld.add(window.id);
        if (phase !== 'ended') {
            hand.dropping = drop;
            MANAGER.setFrame(seat, window.id, frame);
            return update();
        }
        endDrag(seat);
        if (drop) MANAGER.tile(seat, window.id, drop, LAYOUT.tileOf(drop, tileArea));
        else MANAGER.setFrame(seat, window.id, LAYOUT.kept(frame, area(seat), window.bar.height));
        remember(window);
        update();
    }

    // The drag by which `seat` moves a window ends: its frame goes on drawn by its motion, and no tile is shown.
    function endDrag(seat) {
        const hand = hands.get(seat);
        if (!hand) return;
        if (hand.moving) handHeld.delete(hand.moving.id);
        hand.moving = null;
        hand.dropping = null;
        undrag(hand);
    }

    // A double click on the title bar does what the person set it to, where the window's button for it is enabled.
    function doubleClick(seat, window) {
        const action = actionOnDoubleClick();
        if (action === 'zoom' || action === 'minimize') clicked(seat, window, action);
    }

    // Each of the mod's windows brought forward for `seat`, in the order it had them, those it minimized too, as
    // orderFront brings one: in front, the front one key, where the mod may activate for the seat. Answers whether
    // the mod has any.
    function activate(seat, mod) {
        const ids = MANAGER.orderOf(seat).filter((id) => windows.get(id).mod === mod);
        if (!ids.length) return false;
        if (ACTIVATION.mayActivate(seat, mod)) {
            for (const id of ids) MANAGER.orderFront(seat, id);
        } else holdBack(seat, ids, mod);
        update();
        return true;
    }

    // What a window's content is told of it: `shown` on some seat's screen with the host window up, `key` while it
    // holds the keyboard of any seat (keyboardsOf), its size, and where its buttons stand over its top; a panel window
    // has no buttons, and a view is shown only while it stands on some seat's screen, told the size it would stand at
    // while it does not. A panel window in the host's bar is told its `room` there (LAYOUT.roomsIn), any other window
    // none. A content is one page under every seat that looks at it, with one focus: it is key from the first seat
    // whose keyboard it comes to hold until the last it holds no more.
    function stateOf(window) {
        const key = keyboardsOf(window.id).length > 0;
        if (panels.has(window.id)) {
            const frame = panelFrameOf(window.id);
            const { width, height } = frame ?? ANCHORED.sizeOf(bounds(), window.size);
            return { shown: shown && !!frame, key, width, height, titleBar: null, room: roomOf(window.id) };
        }
        const frame = MANAGER.frameOf(window.id);
        return {
            shown: shown && MANAGER.isShown(window.id),
            key,
            width: frame?.width ?? 0,
            height: frame?.height ?? 0,
            titleBar: LAYOUT.guideOf(window.bar),
            room: null,
        };
    }

    // The room the panel window `id` has in the host's bar, or null for one that stands at no edge.
    function roomOf(id) {
        const atEdge = [...panels.values()].filter((window) => !ANCHORED.isView(window));
        const rooms = LAYOUT.roomsIn(
            atEdge.map(({ edge, size }) => ({ edge, size })),
            { ...stage.size(), bar: strip.height, controls: strip.controlsWidth }
        );
        return rooms[atEdge.findIndex((window) => window.id === id)] ?? null;
    }

    // Whether the window is the local seat's key window, which an overlay window or a view holding the keyboard gives
    // it back to; or the view that holds it.
    function isKey(window) {
        if (panels.has(window.id)) return keyPanel()?.id === window.id;
        return MANAGER.keyOf(LOCAL) === window.id;
    }

    // The panel window that holds the machine's keyboard, or null: the view shown for the local seat by activation.
    function keyPanel() {
        return panels.get(SHOWING.of(LOCAL)) ?? null;
    }

    // The title a titled window's title bar holds now.
    function setTitle(window, title) {
        if (!windows.has(window.id)) return;
        window.title = String(title);
        update();
    }

    // Hears each change to the windows: answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // Laid again, the desktop's page told, the keyboard given to a new key window, the host's title and each listener.
    function update() {
        if (!stage) return;
        settleViews();
        for (const [seat, hand] of hands) {
            const panel = seat === LOCAL ? (keyPanel() ?? WINDOWS.keyOverlay()) : panels.get(SHOWING.of(seat));
            ACTIVATION.setActive(seat, panel?.mod ?? keyWindow(seat)?.mod ?? null);
            // The keyboard of a seat comes to a window it did not press at its content.
            if (hand.keys && hand.keys.id !== keyboardOf(seat)?.id) hand.keys = null;
            // Where a seat types is drawn of the page its keys go to now, and of no other.
            const page = typingPageOf(seat);
            if ((typings.get(seat)?.page ?? null) === page) continue;
            typings.delete(seat);
            if (page) reread(seat);
        }
        layout();
        tellPage();
        tellSeats();
        const key = keyPanel() ?? keyWindow(LOCAL);
        // A panel window's content may open after it took the keyboard.
        if (key !== focused || (key && key === keyPanel() && !focusedContent && key.surface)) {
            focusedContent = !!key?.surface;
            focused = key;
            if (shown) focus();
        }
        const title = titleOf(keyWindow(LOCAL));
        if (title !== titled) host.desktopTitled((titled = title));
        READING.settle();
        for (const listener of [...listeners]) listener();
    }

    // The frame a window of the mod and the name of `window` was left at, `{ x, y, width, height }`, where it was left
    // at the level `window` opens at; or null, as for a window with no name.
    function keptFrameOf(window) {
        if (window.name === null) return null;
        const kept = frames[window.mod]?.[window.name];
        if (kept?.level !== window.level) return null;
        const { x, y, width, height } = kept;
        return { x, y, width, height };
    }

    // The frame `window` was left at, by its mod and its name, at its level: a normal window's, zoomed, the one zoom
    // left; an overlay window's, `frame`, as the host app tells it, in the machine's screen coordinates. A window
    // with no name leaves none.
    function remember(window, frame = MANAGER.standardFrameOf(window.id)) {
        if (window.name === null) return;
        const { x, y, width, height } = frame;
        frames = {
            ...frames,
            [window.mod]: { ...frames[window.mod], [window.name]: { level: window.level, x, y, width, height } },
        };
        keep(FRAMES, frames);
    }

    // Whether the desktop keeps a frame a window of the mod `mod` was left at.
    function keepsFramesOf(mod) {
        return Object.hasOwn(frames, mod);
    }

    // The frames the windows of the mod `mod` were left at, forgotten once deckit has kept that. Answers a promise that
    // rejects where deckit refused the write.
    async function forgetFramesOf(mod) {
        if (!keepsFramesOf(mod)) return;
        const { [mod]: _forgotten, ...next } = frames;
        await STATE.write(FRAMES, next);
        frames = next;
    }

    // MARK: - Private
    // A seat deckit opened sits at the desktop: it sees every window open and holds none.
    function sit(seat) {
        if (seat.user) seated.set(seat.id, seat);
        if (seat.source) sources.set(seat.source, seat.id);
        if (hands.has(seat.id)) return;
        MANAGER.addSeat(seat.id);
        ACTIVATION.addSeat(seat.id);
        SHOWING.addSeat(seat.id);
        COLOURS.take(seat.id);
        hands.set(seat.id, {
            buttons: [],
            moving: null,
            dropping: null,
            pointer: null,
            reach: null,
            down: null,
            dock: false,
            menu: null,
            keys: null,
            key: null,
            waits: null,
            acted: null,
            rests: false,
            camera: CAMERA.opened(hands.get(LOCAL)?.camera ?? { x: 0, y: 0 }),
            screenSize: null,
            pressed: null,
        });
        update();
    }

    // The views put away as what they stand by changes: one whose anchor went, for every seat it was shown for by
    // activation, and a seat's as a window becomes its key window. A window that becomes a seat's key window, but by
    // its press, while its frame is out of reach of that seat's camera moves the camera to it (CAMERA.brought).
    function settleViews() {
        const { frames } = standing();
        for (const { id, anchor } of panels.values()) if (anchor && !frames.has(id)) SHOWING.unanchored(id);
        for (const [seat, hand] of hands) {
            const key = MANAGER.keyOf(seat);
            if (key !== null && key !== hand.key) SHOWING.putAway(seat);
            if (key !== null && key !== hand.key && key !== hand.pressed) bringInto(seat, hand, key);
            hand.key = key;
            hand.pressed = null;
        }
    }

    // The camera of `seat` moves to the window `id` where its frame is out of reach there.
    function bringInto(seat, hand, id) {
        const frame = MANAGER.frameOf(id);
        const desktopNow = area(seat);
        if (!frame || !windows.has(id)) return;
        const kept = LAYOUT.kept(frame, desktopNow, windows.get(id).bar.height);
        if (kept.x === frame.x && kept.y === frame.y) return;
        const { x, y } = CAMERA.brought(cameraOf(seat), frame, LAYOUT.zoomedIn(desktopNow));
        hand.camera = { x, y };
    }

    // The seat whose view the host window shows.
    function shownSeat() {
        return shownScreen().seat;
    }

    // The host window shows the view of `seat`, the local seat following it: the stage is laid in that seat's order,
    // the desktop's page is told what is so of it, and the machine's keyboard and pointer reach the desktop's page
    // alone, the pages lying in another seat's order. With null, or the local seat, the view is the local seat's own
    // again. The view shown for the local seat is put away as it begins to follow.
    function follow(seat) {
        const next = seat !== LOCAL && hands.has(seat) ? seat : null;
        if (next === followed) return;
        followed = next;
        if (next !== null) SHOWING.putAway(LOCAL);
        update();
        if (shown) focus();
    }

    // A seat deckit closed leaves: no window or view holds its keyboard, and a view that followed it is the local
    // seat's again.
    // It is out of what is kept here before the desktop is laid again, as deckit answers nothing of a seat it closed.
    function leave(seat) {
        if (seat.id === LOCAL || !hands.has(seat.id)) return;
        endDrag(seat.id);
        MANAGER.removeSeat(seat.id);
        ACTIVATION.removeSeat(seat.id);
        SHOWING.removeSeat(seat.id);
        COLOURS.give(seat.id);
        hands.delete(seat.id);
        pointers = pointers.filter((one) => one.seat !== seat.id);
        typings.delete(seat.id);
        seated.delete(seat.id);
        for (const [source, id] of sources) if (id === seat.id) sources.delete(source);
        for (const [id, by] of pressers) if (by === seat.id) pressers.delete(id);
        if (followed === seat.id) follow(null);
        else update();
    }

    // Who sits, as plain data: `seats`, each `{ id, name, colour, idle, following }` in the order they sat, `name` its
    // user's, `colour` the name of the colour it is told apart by, `following` whether the host window shows its view.
    function seatsNow() {
        return {
            seats: [...hands.keys()].map((id) => ({
                id,
                name: seated.get(id)?.user.name ?? id,
                colour: COLOURS.of(id),
                idle: seated.has(id) && deckit.seats.isIdle(seated.get(id)),
                following: id === followed,
            })),
        };
    }

    // Each listener hears that what seatsNow answers changed, once for a change.
    function tellSeats() {
        const written = JSON.stringify(seatsNow());
        if (written === seatsTold) return;
        seatsTold = written;
        for (const listener of [...seatListeners]) listener();
    }

    // A press down of `seat` in `page`, or in none: the view shown for it is put away unless the press spares it
    // (sparedBy). One in the desktop's page, on the Dock, or on its backdrop, in no window, reached no mod:
    // what the seat handed is over. One anywhere but on a window's dialog surface puts every picker up away.
    function pressedDown(seat, hand, page) {
        if (page && [desktop.page, desktop.surfaces.get(PAGE.BACKDROP)].includes(page)) ACTIVATION.input(seat, null);
        if (![...windows.keys()].some((id) => desktop.surfaces.get(PAGE.dialogOf(id)) === page)) unpicked();
        if (SHOWING.pressed(seat, sparedBy(page, hand.pointer))) update();
    }

    // The views a press down in `page` at the stage's `point` spares: the one the page is of, its content, a child it
    // shows or what it presents over itself, and each whose anchor the point is on.
    function sparedBy(page, point) {
        const inside = page ? windowAt(page)?.id : undefined;
        const on = point ? standing().anchors.filter(({ rect }) => within(rect, point)) : [];
        const names = (anchor, mod) =>
            on.some((one) => one.owner === anchor.mod && one.id === anchor.id && one.mod === mod);
        const under = [...panels.values()].filter(({ anchor, mod }) => anchor && names(anchor, mod));
        return [...(inside === undefined ? [] : [inside]), ...under.map(({ id }) => id)];
    }

    // The seat that pressed the window last, or the one the host window shows where none did.
    function presserOf(window) {
        return pressers.get(window.id) ?? LOCAL;
    }

    // What the machine's devices did, as the environment tells it, in the page it was delivered to: the local seat's
    // input, a pointer's point of the desktop where that page is laid here, and no point where it is not.
    function carried(event) {
        const local = seated.get(LOCAL);
        if (!local) return;
        const { x, y, ...told } = event;
        const rect = event.page ? onDesktop.get(event.page) : shownCamera();
        const at = event.event === 'pointer' && rect ? { x: x + rect.x, y: y + rect.y } : {};
        Promise.resolve(deckit.seats.input(local, { ...told, ...at })).catch((error) =>
            deckit.log.error("the machine's input was not taken", error)
        );
    }

    // The entry, as deckit hands it: what the devices of `seat` did, an event with the seat's `source`. It goes by the
    // route of its kind (ROUTING.ROUTES). An event the environment carried is in its page already, and the local
    // seat's press or key that ends its following of another seat does no more; any other is read against what is
    // laid for the seat and put in the page it reaches. A pointer answers `{ over, key, at }`: `over` the window it
    // reached, 'desktop' for the desktop where no window is, or null, for a press on a window `key`, whether the
    // seat's keys go to that window after it, and `at`, the desktop's point it went to. A key, text or paste
    // answers `{ to }`, the window it went to, or null where the seat has no key window. Nothing is put while the
    // host window is hidden, where no page takes input: that is refused HIDDEN. A seat's events keep their order: one
    // placed by a ref takes time, and what enters meanwhile waits its turn (ROUTING.waits).
    function entered(seat, event) {
        const route = { place, keyboard, sizing }[ROUTING.routeOf(event)];
        if (!route)
            throw refusal(
                'INVALID_ARGUMENT',
                "what a seat's devices do is a pointer, key, text, clipboard or screen event"
            );
        const turn = () => {
            const hand = hands.get(seat.id);
            if (!hand) throw refusal('NOT_FOUND', 'the seat is not at the desktop');
            if (!event.carried && !shown) throw refusal('HIDDEN', 'the desktop is hidden: nothing of it takes input');
            return route(seat.id, hand, event);
        };
        const hand = hands.get(seat.id);
        if (!hand || !ROUTING.waits(event, hand.waits !== null)) return turn();
        const answer = (hand.waits ?? Promise.resolve()).then(turn);
        const done = answer.then(
            () => {},
            () => {}
        );
        hand.waits = done;
        done.then(() => hand.waits === done && (hand.waits = null));
        return answer;
    }

    // The route of a pointer event: to its place, the desktop's point or what a reading named.
    function place(seat, hand, event) {
        if (event.carried) return arrived(seat, hand, event);
        const named = ROUTING.placeOf(event);
        if (!named) throw refusal('INVALID_ARGUMENT', 'a pointer event is at a point, x and y, or at a ref');
        if (ROUTING.noCount(event, ['button', 'count']))
            throw refusal('INVALID_ARGUMENT', 'a button and a count are integers of 0 or more');
        if (named === 'ref') return placed(seat, hand, event);
        return { ...pointed(seat, hand, event), at: { x: event.x, y: event.y } };
    }

    // The route of a screen event: the size of the seat's screen, and so of its camera, which it answers, the windows
    // tiled or zoomed in it taking their tiles again. The local seat's screen is the host window, which no event sizes.
    function sizing(seat, hand, { type, width, height }) {
        if (type !== 'resize' || !CAMERA.isScreen({ width, height }))
            throw refusal('INVALID_ARGUMENT', "a screen's resize is a width and a height of 1 or more");
        if (seat !== LOCAL) hand.screenSize = { width, height };
        retaken();
        update();
        return cameraOf(seat);
    }

    // The text a key of a seat's copied or cut, told to that seat.
    function copied({ text, source }) {
        const seat = seated.get(sources.get(source));
        if (seat) tells.tell(seat, { of: 'clipboard', text });
    }

    // The route of a key, of text or of a paste: to what holds the seat's keyboard.
    function keyboard(seat, hand, event) {
        if (!event.carried) return typed(seat, event);
        if (event.event === 'key' && seat === LOCAL) unfollowed(event.type);
        if (event.page) dialogKeyed(seat, event, event.page);
        return { to: keyWindow(seat)?.id ?? null };
    }

    // A pointer event placed by `ref`, what a reading named: the pointer goes to the middle of what shows of it, an
    // item of the Dock by way of the Dock's sliver while the Dock is in for the seat, and the event enters there as one
    // at that point does. Where another window covers that place in the seat's order, the window the ref is of comes to
    // the front of that order first, as the seat's press on it brings it, but for a move with no button held, which
    // presses nothing and reaches what lies there.
    async function placed(seat, hand, { ref, ...event }) {
        const { at, by, window } = await READING.place({ id: seat }, ref);
        if (hands.get(seat) !== hand) throw refusal('NOT_FOUND', 'the seat is not at the desktop');
        if (!shown) throw refusal('HIDDEN', 'the desktop is hidden: nothing of it takes input');
        const lone = ROUTING.hovers(event, hand.buttons);
        if (!lone && windows.has(window) && ROUTING.raises(window, windowUnder(seat, at)))
            press(seat, windows.get(window));
        if (by && !hand.dock)
            pointed(seat, hand, { event: 'pointer', type: 'move', source: event.source, ...by }, 'ref');
        return { ...pointed(seat, hand, { ...event, ...at }, 'ref'), at };
    }

    // The id of the window a press at `point` reaches in what is laid for `seat`, its content or a part the shell
    // draws of it; or null where it reaches the desktop, the Dock or nothing.
    function windowUnder(seat, point) {
        const hit = stage.hit(laidFor(seat), point);
        if (!hit) return null;
        const part = partAt(hit);
        if (part) return windows.has(part.id) && hit.page !== desktop.page ? part.id : null;
        return windowAt(hit.page)?.id ?? null;
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { stage: 'call', kind });
    }

    // A pointer event the environment carried: the pointer is there, a press in a window's page is the seat's press on
    // that window, and a scroll on the backdrop, the desktop where nothing else takes the pointer, pans its camera.
    function arrived(seat, hand, event) {
        if (Number.isFinite(event.x)) hand.pointer = { x: event.x, y: event.y };
        reaching(seat, hand);
        if (ROUTING.hovers(event, hand.buttons))
            pointers = ROUTING.hovered(pointers, seat, event.page && windowAt(event.page) ? event.page : null).placed;
        moved(seat, hand, event);
        if (followed !== null) {
            if (event.type === 'down') follow(null);
            return { over: null };
        }
        if (event.type === 'down') pressedDown(seat, hand, event.page);
        if (event.type === 'scroll' && event.page && event.page === desktop.surfaces.get(PAGE.BACKDROP))
            scrolled(seat, hand, event);
        // A press on the Dock or its menu is forwarded by the desktop's page (listen), and gesture puts the menu away
        // or keeps it; a press anywhere else, the host's bar in that page too, puts it away.
        const onDock =
            event.page === desktop.page && hand.pointer && partAt({ page: event.page, ...hand.pointer }, seat);
        if (event.type === 'down' && !onDock) unmenu(seat, hand);
        const window = event.type === 'down' ? windowAt(event.page) : null;
        if (!window || !windows.has(window.id) || MANAGER.isMinimized(seat, window.id)) return { over: null };
        return reached(seat, window);
    }

    // A pointer event to be carried. A press and a scroll go where `stage.hit` finds a page in what is laid for the
    // seat; a move with a button held and the up that ends it go where the press went, at the pointer's point of that
    // page where its window is now, so a window its content's drag moves stays under the pointer. A press on the
    // desktop or the Dock leaves the seat's keyboard with its key window. A move with none held
    // reaches what lies at its point as a press does and presses nothing: a window's page it reaches hears it as the
    // machine's moving pointer, and the pages it left hear the pointer leave (pointedAlone). The Dock comes out for
    // the seat as its pointer reaches the Dock's sliver, and stays out while it is there or on the Dock's card, or an
    // item's menu is open for it; a press off the Dock and that menu puts the menu away. `how` is how the seat named
    // the place (ROUTING.placeOf).
    function pointed(seat, hand, event, how = 'point') {
        const { type } = event;
        const point = { x: event.x, y: event.y };
        if (!['move', 'down', 'up', 'scroll'].includes(type) || ![point.x, point.y].every(Number.isFinite))
            throw refusal('INVALID_ARGUMENT', 'a pointer event is a move, down, up or scroll at a point');
        hand.pointer = point;
        reaching(seat, hand);
        moved(seat, hand, event, how);
        const [sliver, card] = DOCK_MODEL.inputOf(area(seat), true, DOCK.items());
        const out = () => within(sliver, point) || (hand.dock && within(card, point)) || hand.menu !== null;
        hand.dock = out();
        const lone = ROUTING.hovers(event, hand.buttons);
        const reaches = CAMERA.reaches(cameraOf(seat), point);
        const hit = (type === 'move' && !lone) || !reaches ? null : stage.hit(laidFor(seat), point);
        const part = hit && partAt(hit, seat);
        if (lone) pointedAlone(seat, part || !hit || !windowAt(hit.page) ? null : hit.page, event.source);
        if (type === 'down' && !DOCK_PARTS.includes(part?.part)) {
            unmenu(seat, hand);
            hand.dock = out();
        }
        if ((type === 'move' && !lone) || type === 'up') {
            const held = hand.down;
            if (!held) return { over: null };
            if (held.part) gesture(seat, type, point, part);
            else {
                const frame = frameOn(held.id, seat);
                if (type === 'up' || !frame) hand.down = null;
                const at = frame && { x: point.x - frame.x - held.inside.x, y: point.y - frame.y - held.inside.y };
                if (at) INPUT.put(held.page, { ...event, ...at });
                reread(seat);
            }
            return { over: DOCK_PARTS.includes(held.part) ? 'dock' : held.id };
        }
        if (type === 'down') pressedDown(seat, hand, hit?.page ?? null);
        if (!hit) return { over: null };
        if (part) {
            const docks = DOCK_PARTS.includes(part.part);
            if (type === 'down') gesture(seat, type, point, part, { count: event.count, button: event.button });
            if (type === 'down') backToKey(hand);
            if (docks) return { over: 'dock' };
            return { over: part.id, ...(type === 'down' ? { key: keyboardOf(seat)?.id === part.id } : {}) };
        }
        const window = windowAt(hit.page);
        if (!window) {
            if (type === 'down') backToKey(hand);
            if (type === 'scroll' && desktop.page) scrolled(seat, hand, event);
            return { over: desktop.page ? 'desktop' : null };
        }
        const answer = { over: window.id };
        if (type === 'down') {
            const frame = frameOn(window.id, seat);
            const inside = { x: point.x - hit.x - frame.x, y: point.y - hit.y - frame.y };
            hand.down = { id: window.id, page: hit.page, inside };
            if (panels.has(window.id)) pressPanel(seat, window);
            else press(seat, window);
            answer.key = keyboardOf(seat)?.id === window.id;
            if (answer.key) hand.keys = { id: window.id, page: hit.page };
        }
        INPUT.put(hit.page, { ...event, x: hit.x, y: hit.y });
        reread(seat);
        return answer;
    }

    // The side or corner of a window whose reach the pointer of `seat` is in, as a press there takes it (partAt), kept
    // as the hand's `reach`: the page is told anew as it changes, each window showing a handle at each reach a seat's
    // pointer is in.
    function reaching(seat, hand) {
        const hit =
            hand.pointer && CAMERA.reaches(cameraOf(seat), hand.pointer) && stage.hit(laidFor(seat), hand.pointer);
        const part = hit ? partAt(hit, seat) : null;
        const reach = LAYOUT.EDGES.includes(part?.part) ? { id: part.id, edge: part.part } : null;
        if (reach?.id === hand.reach?.id && reach?.edge === hand.reach?.edge) return;
        hand.reach = reach;
        update();
    }

    // A scroll of `seat` on the desktop, where no window, the Dock, the bar or a view lies, moves its camera by its
    // `dx`, `dy`, and the desktop's page hears none.
    function scrolled(seat, hand, { x, y, dx, dy }) {
        const camera = cameraOf(seat);
        const next = CAMERA.scrolled(camera, { x, y }, { dx, dy }, strip.height);
        if (next === camera) return;
        hand.camera = { x: next.x, y: next.y };
        update();
    }

    // The one pointer of each page goes where a move of `seat` with no button held went, into `page` or into none:
    // each page whose pointer the seat's move placed and that this one left hears it leave, by a move off the page. A
    // page no window shows any more is left out: it is gone.
    function pointedAlone(seat, page, source) {
        const { placed, left } = ROUTING.hovered(
            pointers.filter((one) => windowAt(one.page)),
            seat,
            page
        );
        pointers = placed;
        for (const each of left) INPUT.put(each, { event: 'pointer', type: 'move', x: -1, y: -1, buttons: [], source });
    }

    // A key, text or paste to be carried: put in the page that took the seat's last press in the window that holds its
    // keyboard, the view shown for it by activation or its key window, a child or a web page laid over the content as
    // the content itself, while that page is laid there; in the window's content where it pressed none. That the
    // window holds another seat's keyboard too changes nothing of it.
    function typed(seat, event) {
        const key = keyboardOf(seat);
        if (!key?.surface) return { to: null };
        if (dialogKeyed(seat, event, keysPageOf(seat))) return { to: key.id };
        ACTIVATION.input(seat, key.mod);
        INPUT.put(keysPageOf(seat), event);
        reread(seat);
        return { to: key.id };
    }

    // The page the keys and text of `seat` go to, as typed puts them; or null where no window holds its keyboard.
    function keysPageOf(seat) {
        const key = keyboardOf(seat);
        if (!key?.surface) return null;
        const hand = hands.get(seat);
        const pressed = hand.keys?.id === key.id ? hand.keys.page : null;
        const there = pressed && laidFor(seat).some(({ page }) => page === pressed) && windowAt(pressed) === key;
        return there ? pressed : key.surface;
    }

    // The page where `seat` types that the desktop's page draws its focus and its caret over: the one its keys go to,
    // for a seat whose key window does not have the machine's keyboard, which is every seat but the local one, and
    // the local one too while the host window shows another seat's view; or null.
    function typingPageOf(seat) {
        if (seat === LOCAL && followed === null) return null;
        return keysPageOf(seat);
    }

    // Where `seat` types is read again as the next frame is due, once however often it is asked before.
    function reread(seat) {
        if (!unread.size) setTimeout(readTypings, REREAD);
        unread.add(seat);
    }

    // The reader's answer of where each seat that waits for it types: what has the focus in the page its keys go to,
    // and its caret or what is selected in it. A page that reads as nothing, or is gone, leaves nothing drawn.
    async function readTypings() {
        const seats = [...unread].filter((seat) => hands.has(seat));
        unread.clear();
        await Promise.all(
            seats.map(async (seat) => {
                const page = typingPageOf(seat);
                if (!page) return typings.delete(seat);
                const read = await (async () => {
                    const { lines } = await READ.outline(page, {});
                    const focused = lines.findLast(({ states }) => states?.includes('focused'));
                    return focused ? READ.node(page, focused.ref, { lines: 0 }) : null;
                })().catch(() => null);
                // The seat's keys went to another page while this one was read: that one is read after.
                if (typingPageOf(seat) !== page || !hands.has(seat)) return;
                const bars = read?.selected ?? (read?.caret ? [read.caret] : []);
                typings.set(seat, { page, ring: read?.rect ?? null, bars, caret: !read?.selected && bars.length > 0 });
            })
        );
        tellPage();
    }

    // Where `seat` types as the host window shows it, `{ ring, bars, caret, over }` on its screen, or null: the ring
    // round what has the focus (MARKS.ringOf; the reader answers no radius of its corners) and what shows in its page
    // of the rects the reader answered, from where the page lies in its window, and nothing where a window in front
    // of that one for the shown seat covers a part of what has the focus. `over` is whether it is drawn over
    // everything, with the cursors: so for a panel window, whose content lies over the desktop's page.
    function typingOf(seat) {
        const typing = typings.get(seat);
        const window = typing?.ring && windowAt(typing.page);
        if (!window) return null;
        const on = laidOfWindow(window.id).find(({ page }) => page === typing.page)?.rect;
        if (!on) return null;
        const moved = ({ x, y, width, height }) => cut({ x: on.x + x, y: on.y + y, width, height }, on);
        const ring = moved(typing.ring);
        if (!ring) return null;
        const over = panels.has(window.id);
        if (over && !panelFrames(shownScreen()).some(({ window: each }) => each === window)) return null;
        const view = MANAGER.viewOf(shownSeat());
        const at = view.findIndex(({ id }) => id === window.id);
        if (windows.has(window.id) && (at < 0 || view.slice(at + 1).some(({ frame }) => cut(frame, ring)))) return null;
        const shownAt = (rect) => CAMERA.onScreen(shownCamera(), rect);
        const bars = typing.bars.flatMap((bar) => moved(bar) ?? []).map(shownAt);
        return { ring: shownAt(MARKS.ringOf(ring)), bars, caret: typing.caret, over };
    }

    // What the pointer of `seat` just did where it is: the buttons it holds are kept, and the desktop's page is told of
    // a seat it draws the cursor of, any but the one whose view it shows, that event alone, `{ id, type, x, y, buttons,
    // under, named, glide }` and for a scroll `dx`, `dy`, `glide` by how the seat named the place, `how`. The seat's
    // name shows from then, and its fold is due once.
    function moved(seat, hand, { type, button = 0, dx = 0, dy = 0 }, how = 'point') {
        if (type === 'down' && !hand.buttons.includes(button)) hand.buttons = [...hand.buttons, button];
        if (type === 'up') hand.buttons = hand.buttons.filter((each) => each !== button);
        if (!isDrawn(seat, hand)) return;
        hand.acted = clock.now();
        if (!hand.rests) clock.after(() => foldDue(seat, hand), MARKS.NAME);
        hand.rests = true;
        tellSeat(seat, hand, type, { glide: MARKS.glides(how), ...(type === 'scroll' ? { dx, dy } : {}) });
    }

    // Whether the desktop's page draws the cursor of `seat`: of any but the one whose view it shows, once its pointer
    // is somewhere.
    function isDrawn(seat, hand) {
        return seat !== shownSeat() && !!hand.pointer && !!desktop.page && PAGES.isAlive(desktop.page);
    }

    // The desktop's page is told what the pointer of `seat` did where it is, and how its cursor is drawn there: under
    // what covers what it is over, or as a mark at the edge of the camera shown where it is outside it
    // (MARKS.cursorOn), with its name or without.
    function tellSeat(seat, hand, type, more) {
        const { at, under } = MARKS.cursorOn(shownCamera(), hand.pointer, stackOf(screenOf(seat)), viewedStack());
        const { x, y } = at;
        const named = MARKS.nameLeft(hand.acted, clock.now()) > 0;
        PROTOCOL.seat.send(desktop.page, { id: seat, type, x, y, buttons: hand.buttons, under, named, ...more });
    }

    // The fold of the name of `seat` is due: it waits on where the pointer did something since, and the page is told
    // the pointer rests once the name shows no longer.
    function foldDue(seat, hand) {
        if (hands.get(seat) !== hand) return;
        const left = MARKS.nameLeft(hand.acted, clock.now());
        if (left > 0) return clock.after(() => foldDue(seat, hand), left);
        hand.rests = false;
        if (isDrawn(seat, hand)) tellSeat(seat, hand, 'rest', { glide: false });
    }

    // What stands on the screen `seatScreen` (screenOf, shownScreen), `[{ id, frame, radius }]` from the back, as the
    // stage's levels lie (model/levels.js): its seat's windows in its order; what the desktop's page draws over them in
    // its camera, the band of the host's bar and the Dock, out or in as the seat `docked` has it; the panel windows at
    // an edge; then the views there as they lie. What a page presents over itself, and the menu of a Dock's item, is in
    // none: a cursor is drawn over a menu.
    function stackOf(seatScreen, docked = seatScreen.seat) {
        const { seat, camera } = seatScreen;
        const frames = panelFrames(seatScreen);
        const views = frames.filter(({ window }) => ANCHORED.isView(window));
        const panes = [...frames.filter(({ window }) => !ANCHORED.isView(window)), ...stackedFor(seat, views)];
        const out = hands.get(docked)?.dock ?? false;
        return [
            ...MANAGER.viewOf(seat).map(({ id, frame }) => ({ id, frame, radius: LAYOUT.RADIUS })),
            { id: 'band', frame: { ...camera, height: strip.height }, radius: 0 },
            { id: 'dock', ...DOCK_MODEL.coverOf(desktopIn(camera), out, DOCK.items()) },
            ...panes.map(({ window, frame }) => ({ id: window.id, frame, radius: radiusOf(window, frame) })),
        ];
    }

    // What stands on the screen the host window shows, with the Dock as the local seat has it.
    function viewedStack() {
        return stackOf(shownScreen(), LOCAL);
    }

    // `seat`'s press on a window, answered as the entry answers it.
    function reached(seat, window) {
        press(seat, window);
        return { over: window.id, key: keyboardOf(seat)?.id === window.id };
    }

    // The window or panel window a page is of: its content, a child a region of it shows, a web page apart in it or
    // laid in either where its element shows it, or an overlay of one, the overlay of a mod's own page being of that
    // page's front window; or null.
    function windowAt(page) {
        const owner = OVERLAY.ownerOf(page);
        const held = web.placeOf(owner)?.over ?? owner;
        const over = [inWindows.get(held), ...(owner === page ? [] : [fronts.get(web.pageFor(owner) ?? owner)])];
        return [...windows.values(), ...panels.values()].find(
            ({ id, surface }) => surface === held || over.includes(id)
        );
    }

    // Whose a page that asks a dialog is, as deckit asks it: the mod that shows it as a web page, laid in a page or
    // apart in a window, or the mod of the window whose content it is; or null for any other page.
    function whose(page) {
        const held = web.pageFor(page);
        if (held && held !== page) return { mod: deckit.mods.modOf(held), web: true };
        const window = [...windows.values(), ...panels.values()].find(({ surface }) => surface === page);
        return window ? { mod: window.mod, web: false } : null;
    }

    // A dialog deckit keeps up stands where its page shows (DIALOGS), and is refused where that is in no window.
    function dialogAsked({ ask, page, ...asked }) {
        if (!DIALOGS.ask({ ask, ...asked }, dialogAt(page))) return answering.refuse(ask);
        asking.set(ask, page);
        update();
    }

    // Dialog `ask` is answered as its part `part` says (DIALOG_MODEL partAt), pressed or keyed by any seat, or a date
    // picker turned to another month.
    function dialogPressed(ask, part) {
        const dialog = DIALOGS.of(ask);
        const answer = dialog && DIALOG_MODEL.answerOf(dialog, part);
        if (answer) answering.answer(ask, answer.value);
        else if (DIALOGS.turn(ask, part)) update();
    }

    // A key or text of `seat`'s that goes to `page`, on the dialog asked last of those up in the window that holds its
    // keyboard that cover that page (DIALOG_MODEL covers): Return and Escape answer it, in a prompt text and
    // Backspace edit its text, and in a picker the arrows move from option to option. A page no dialog
    // covers takes it as ever. Answers whether a dialog took it.
    function dialogKeyed(seat, event, page) {
        const window = keyboardOf(seat);
        if (!page || !window || windowAt(page)?.id !== window.id) return false;
        const dialog = DIALOGS.inWindow(window.id).findLast((one) =>
            DIALOG_MODEL.covers(one, asking.get(one.ask) === page)
        );
        if (!dialog) return false;
        if (event.event === 'text' && ['insert', 'commit'].includes(event.type))
            DIALOGS.type(dialog.ask, dialog.value + String(event.text ?? ''));
        else if (event.event === 'key' && event.type === 'down' && event.key === 'Backspace')
            DIALOGS.type(dialog.ask, String(dialog.value).slice(0, -1));
        else if (event.event === 'key' && event.type === 'down') {
            DIALOGS.step(dialog.ask, event.key);
            const part = DIALOG_MODEL.keyed(DIALOGS.of(dialog.ask), event.key);
            if (part) dialogPressed(dialog.ask, part);
        }
        update();
        return true;
    }

    // Every picker up put away, as a press lands anywhere but on a dialog's surface.
    function unpicked() {
        for (const ask of asking.keys()) if (!DIALOG_MODEL.waitsOn(DIALOGS.of(ask))) answering.refuse(ask);
    }

    // A dialog is up no more, however it went.
    function dialogWithdrawn(ask) {
        DIALOGS.withdraw(ask);
        asking.delete(ask);
        update();
    }

    // A web page shows somewhere else: its dialog up stands where it shows now.
    function dialogMoved(page) {
        for (const [ask, asker] of asking) if (asker === page) DIALOGS.move(ask, dialogAt(page));
    }

    // Where `page` shows, as DIALOGS takes it, in the coordinates of its window's frame: the window's content where it
    // is that content; where it is laid in that content or in a child's page a region of the window shows, its rect
    // there and what shows it; or null in no window.
    function dialogAt(page) {
        const window = windowAt(page);
        if (!window) return null;
        const content = contentIn(window);
        if (window.surface === page) return content && { window: window.id, content };
        const place = web.placeOf(page);
        const shows = place && (place.over === window.surface ? content : regionIn(window, place.over));
        return shows ? { window: window.id, content: shows, rect: place.frame } : null;
    }

    // The rect of a window's content from its frame's top left, or null for a panel window on no screen.
    function contentIn(window) {
        if (panels.has(window.id)) {
            const frame = panelFrames().find((one) => one.window === window)?.frame;
            return frame ? { x: 0, y: 0, width: frame.width, height: frame.height } : null;
        }
        const { width, height } = MANAGER.frameOf(window.id);
        return LAYOUT.contentOf({ x: 0, y: 0, width, height }, window.bar);
    }

    // The rect of the region of `window` that shows the child's page `page`, from its frame's top left, or null.
    function regionIn(window, page) {
        const child = deckit.mods.modOf(page);
        const laid = child && REGION.laidOut(window.mod, (mod) => mod === child).get(child);
        return laid?.window === window.id ? laid.rect : null;
    }

    // The part the shell draws that a point of a page is on, `{ id, part }`: of the window `id`, 'bar', its title bar,
    // an edge as LAYOUT.resized names it, a button by its name, or 'buttons' between them; in the desktop's page,
    // 'dock-menu', the entry `id` of the menu open for `seat`, null between its entries, or 'dock', the Dock's item of
    // the mod `id`; null for any other point.
    function partAt({ page, x, y }, seat = null) {
        const holds = (rect) => within(rect, { x, y });
        if (page === desktop.page) {
            const { camera } = seat === null ? shownScreen() : screenOf(seat);
            const point = CAMERA.onPlane(camera, { x, y });
            const menu = menuOf(seat, camera);
            if (menu && within(menu.frame, point)) return { id: DOCK_MODEL.entryAt(menu, point), part: 'dock-menu' };
            const id = DOCK_MODEL.itemAt(desktopIn(camera), DOCK.items(), point);
            return id === null ? null : { id, part: 'dock' };
        }
        for (const [id, { bar }] of windows) {
            if (page === desktop.surfaces.get(PAGE.dialogOf(id))) {
                const dialog = DIALOGS.inWindow(id).findLast(({ rect }) => holds(rect));
                return dialog ? { id, part: DIALOG_MODEL.partAt(dialog, { x, y }), ask: dialog.ask } : null;
            }
            if (page === desktop.surfaces.get(PAGE.buttonsOf(id)))
                return { id, part: LAYOUT.buttonsOf(bar).find(holds)?.name ?? 'buttons' };
            if (page !== desktop.surfaces.get(PAGE.frameOf(id))) continue;
            const edge = LAYOUT.partsOf(MANAGER.frameOf(id), bar).edges.find(({ rect }) => holds(rect));
            return { id, part: edge?.edge ?? 'bar' };
        }
        return null;
    }

    // What a seat's pointer does on the parts of a window the shell draws, `on` `{ id, part }` under it (partAt), the
    // one recognizer of every seat: a 'down' is a press on the window, a drag of its title bar from there moves it, a
    // drag of an edge resizes it, an up on the button the press was on clicks it, and a 'down' on the title bar that is
    // the second of two, `count` 2, is a double click. A 'down' of another `button` than the first is a press on the
    // window and no more. The hand keeps what each 'down' reached until its up (`hand.down`), and only one that `acts`,
    // the first button's on a part that does something, goes on to a click or a drag. On the Dock (DOCK_PARTS), `on`
    // null where nothing of it is under the pointer: an up on the item the press was on is the seat's click on it; a
    // press on an item kept there dragged past the Dock's slop drags it, the kept items showing in the order the Dock's
    // model answers of the pointer until the up leaves them so; a 'down' of the second button on an item opens its menu
    // for the seat; an up on the entry of that menu the press was on chooses it, and a press on anything but the menu
    // puts it away. `point` is in any space that holds still while the button is down, the desktop for the Dock, and
    // `grab` where a 'down' is from the frame's top left, read from `point` where it is not told, which holds for a
    // point on the desktop.
    function gesture(seat, type, point, on, { count = 1, button = 0, grab = null } = {}) {
        const hand = hands.get(seat);
        if (!hand) return;
        if (type === 'down') {
            undrag(hand);
            if (!on || DOCK_PARTS.includes(on.part)) {
                hand.down = on && { ...on, from: point, drags: false, acts: button === 0 && on.id !== null };
                if (on?.part !== 'dock-menu') hand.menu = button === 2 && on ? on.id : null;
                return update();
            }
            return byHand(seat, on.id, (window) => {
                hand.down = { ...on, from: point, acts: false };
                if (button !== 0) return press(seat, window);
                if (on.part !== 'bar' || count === 2) press(seat, window);
                if (on.part === 'bar' && count === 2) return doubleClick(seat, window);
                const frame = MANAGER.frameOf(on.id);
                hand.down = { ...on, from: point, frame, acts: true };
                if (on.part === 'bar')
                    move(seat, window, 'began', 0, 0, grab ?? { x: point.x - frame.x, y: point.y - frame.y });
            });
        }
        const held = hand.down;
        if (type === 'up') hand.down = null;
        if (!held?.acts) return;
        if (held.part === 'dock-menu') {
            if (type === 'up' && on?.part === held.part && on.id === held.id) chosen(seat, hand, held.id);
            return;
        }
        if (held?.part === 'dock') {
            const order = DOCK_MODEL.orderOf(area(seat), DOCK.items(), held.id, point);
            held.drags ||= order !== null && DOCK_MODEL.drags(held.from, point);
            if (held.drags && order && type === 'up') DOCK.hand.reorder(order);
            else if (held.drags) DOCK.hand.drag(type === 'up' ? null : held.id, order ?? []);
            else if (type === 'up' && on?.part === 'dock' && on.id === held.id) DOCK.hand.click(held.id, seat);
            return;
        }
        const window = held?.part ? windows.get(held.id) : null;
        if (!window) return;
        const [dx, dy] = [point.x - held.from.x, point.y - held.from.y];
        const phase = type === 'up' ? 'ended' : 'changed';
        if (held.part.startsWith('dialog')) {
            const same = on?.id === held.id && on.part === held.part && on.ask === held.ask;
            if (type === 'up' && same) dialogPressed(held.ask, held.part);
            return;
        }
        if (held.part === 'bar') return move(seat, window, phase, dx, dy);
        if (held.part === 'buttons' || held.part in window.bar.enabled) {
            if (type === 'up' && on?.id === held.id && on.part === held.part) clicked(seat, window, held.part);
            return;
        }
        const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
        framed(seat, window, phase, LAYOUT.resized(held.frame, held.part, dx, dy, minimum), held.part);
    }

    // The menu of the Dock's item open for `seat`, as the Dock's model lays it in `camera`, the seat's own where none
    // is named; null with none, or once its item is in the Dock no more.
    function menuOf(seat, camera = cameraOf(seat)) {
        const id = hands.get(seat)?.menu ?? null;
        return id === null ? null : DOCK_MODEL.menuOf(desktopIn(camera), DOCK.items(), id);
    }

    // The menu open for the seat of `hand` is put away.
    function unmenu(seat, hand) {
        if (hand.menu === null) return;
        hand.menu = null;
        update();
    }

    // The seat of `hand` chose the entry `entry` of the menu open for it: the menu goes, and the Dock does it.
    function chosen(seat, hand, entry) {
        const item = hand.menu;
        unmenu(seat, hand);
        if (item !== null) DOCK.hand.choose(item, entry, seat);
    }

    // A drag of an item of the Dock the seat of `hand` did not end is given up.
    function undrag(hand) {
        if (hand.down?.part === 'dock' && hand.down.drags) DOCK.hand.drag();
        if (DOCK_PARTS.includes(hand.down?.part)) hand.down = null;
    }

    // A key of the machine's, `type` 'down' or 'up', while the local seat follows another: the key down ends the
    // following, and until a key is let go what a key would do is not done. Answers whether it is so now.
    function unfollowed(type) {
        if (type === 'up') ended = false;
        else if (followed !== null) {
            ended = true;
            follow(null);
        }
        return ended;
    }

    // What the shell keeps between runs, as the person left it. The desktop goes on with it whether deckit keeps it or
    // refuses the write, as it does state it did not read; deckit logs why it refused.
    function keep(key, value) {
        STATE.write(key, value).catch(() => {});
    }

    // Windows of `mod`, which may not activate for `seat`, right behind its key window, not key: the mod asks for the
    // seat's attention when it asked to activate and the seat has a key window it is held behind.
    function holdBack(seat, ids, mod, { activates = true } = {}) {
        const held = activates && MANAGER.keyOf(seat) !== null;
        for (const id of ids) MANAGER.orderBehindKey(seat, id);
        if (held) ACTIVATION.requestAttention(seat, mod);
    }

    // The desktop's page draws alone, so what it tells is the person's: no mod's code runs there. What the pointer does
    // on a window's parts there is the input of the seat whose view it shows, the local one, recognized as any seat's
    // is (gesture) from where it is on the screen.
    function listen() {
        const fromPage = (handler) => (payload, sender) => sender === desktop.page && handler(payload);
        PROTOCOL.setup.handle((_payload, sender) => {
            if (sender !== desktop.page)
                throw Object.assign(new Error("only the desktop's page asks this"), { stage: 'call', kind: 'REFUSED' });
            deckit.pages.whenEnds(sender, pageEnded);
            const state = stateOfPage();
            desktop.sent = JSON.stringify(state);
            return { state };
        });
        PROTOCOL.pointer.on(
            fromPage(({ id, item, part, ask, type, x, y, button, count, grabX, grabY }) => {
                if (!['down', 'move', 'up'].includes(type)) return;
                const grab = Number.isFinite(grabX) && Number.isFinite(grabY) ? { x: grabX, y: grabY } : null;
                const named =
                    item === undefined ? partAt({ page: desktop.page, x, y }, LOCAL) : item && { id: item, part };
                const on = DOCK_PARTS.includes(part)
                    ? named || null
                    : { id, part, ...(ask === undefined ? {} : { ask }) };
                gesture(LOCAL, type, { x, y }, on, { button, count, grab });
            })
        );
        PROTOCOL.dialog.on(
            fromPage(({ ask, text, key }) => {
                if (typeof text === 'string') DIALOGS.type(ask, text);
                const part = key && DIALOGS.of(ask) && DIALOG_MODEL.keyed(DIALOGS.of(ask), key);
                if (part) dialogPressed(ask, part);
                update();
            })
        );
        PROTOCOL.dock.on(
            fromPage(({ out }) => {
                hands.get(LOCAL).dock = out;
                layout();
            })
        );
        PROTOCOL.glass.on(
            fromPage(({ materials }) => {
                const next = materials.flatMap(materialOf);
                if (JSON.stringify(next) === JSON.stringify(glass)) return;
                glass = next;
                layout();
            })
        );
        PROTOCOL.restart.on(fromPage(() => down && deckit.restart()));
        PROTOCOL.motion.on(
            fromPage(({ reduced: asked }) => {
                reduced = asked;
                layout();
            })
        );
    }

    // `seat`'s input on a window on its screen, which reaches the window's mod.
    function byHand(seat, id, handler) {
        const window = windows.get(id);
        if (!window || MANAGER.isMinimized(seat, id)) return;
        ACTIVATION.input(seat, window.mod);
        handler(window);
    }

    // The person's click of a button, or the key or double click that does what it does: nothing where the window
    // has it disabled.
    function clicked(seat, window, button) {
        if (!window.bar.enabled[button]) return;
        if (button === 'close') WINDOWS.close(window);
        else if (button === 'minimize') minimize(seat, window);
        else if (button === 'zoom') zoom(seat, window);
    }

    // The frame a drag of the edge `edge` draws, the sides it moves landing on the edges they come within
    // LAYOUT.SNAP of, under the host's bar, kept where its title bar can be reached and remembered as the drag ends. A
    // window that is not resizable takes none.
    function framed(seat, window, phase, frame, edge = null) {
        if (!window.bar.enabled.zoom) return;
        const others = MANAGER.viewOf(seat)
            .filter(({ id }) => id !== window.id)
            .map(({ frame: other }) => other);
        const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
        const sides = edge ? edge.split('-') : [];
        const desktopNow = area(seat);
        const met = sides.length ? LAYOUT.snapped(frame, sides, others, LAYOUT.tiledIn(desktopNow), minimum) : frame;
        const next = LAYOUT.underBar(met, desktopNow, { moved: false });
        MANAGER.setFrame(seat, window.id, phase === 'ended' ? LAYOUT.kept(next, desktopNow, window.bar.height) : next);
        if (phase === 'ended') {
            handHeld.delete(window.id);
            remember(window);
        } else handHeld.add(window.id);
        update();
    }

    // The normal windows of `seat`, back to front, each `{ id, mod, name, frame, key, minimized }`, as the host app
    // reads them: none is key while an overlay window or a panel window holds the seat's keyboard.
    function windowsNow(seat = LOCAL) {
        const key = away(seat) ? null : MANAGER.keyOf(seat);
        return MANAGER.orderOf(seat).map((id) => {
            const { mod, name } = windows.get(id);
            const minimized = MANAGER.isMinimized(seat, id);
            return { id, mod, name, frame: { ...MANAGER.frameOf(id) }, key: id === key, minimized };
        });
    }

    // The hand of the person at the host window, the local seat's, on the window `id` that windows() answers, as the
    // host app hands it, each gesture whole: a press in it; a click of a button, `close`, `minimize` or `zoom`; a drag
    // of its title bar by `dx`, `dy`; a drag of its edge `edge`, as LAYOUT.resized names one, by `dx`, `dy`; and a
    // double click on its title bar. A window minimized takes none; a panel window takes a press alone. Each is the
    // local seat's press down, in the window's content for a press and on what the shell draws of it for the others,
    // so the view shown for the seat is put away unless the press is in it.
    const onFrame = (id, surface, handler) => {
        if (!windows.has(id) || MANAGER.isMinimized(LOCAL, id)) return;
        pressedDown(LOCAL, { pointer: null }, desktop.surfaces.get(surface(id)));
        byHand(LOCAL, id, handler);
    };
    const hand = Object.freeze({
        press: (id) => {
            const window = panels.get(id) ?? windows.get(id);
            if (!window || (windows.has(id) && MANAGER.isMinimized(LOCAL, id))) return undefined;
            pressedDown(LOCAL, { pointer: null }, window.surface);
            return panels.has(id) ? pressPanel(LOCAL, window) : byHand(LOCAL, id, (one) => press(LOCAL, one));
        },
        button: (id, button) =>
            onFrame(id, PAGE.buttonsOf, (window) => {
                press(LOCAL, window);
                clicked(LOCAL, window, button);
            }),
        move: (id, dx, dy) =>
            onFrame(id, PAGE.frameOf, (window) => {
                move(LOCAL, window, 'began', 0, 0);
                move(LOCAL, window, 'changed', dx, dy);
                move(LOCAL, window, 'ended', dx, dy);
            }),
        resize: (id, edge, dx, dy) =>
            onFrame(id, PAGE.frameOf, (window) => {
                press(LOCAL, window);
                const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
                const frame = LAYOUT.resized(MANAGER.frameOf(id), edge, dx, dy, minimum);
                framed(LOCAL, window, 'changed', frame, edge);
                framed(LOCAL, window, 'ended', frame, edge);
            }),
        doubleClick: (id) =>
            onFrame(id, PAGE.frameOf, (window) => {
                press(LOCAL, window);
                doubleClick(LOCAL, window);
            }),
        // On the Dock's item of the mod `id`: a click, Quit from its menu, Keep in Dock or Remove from Dock as
        // `pinned` says, and a drag of a kept item onto the place of the kept item `to`. A click and Quit answer a
        // promise, fulfilled once what they asked of deckit is done.
        dock: Object.freeze({
            click: (id) => DOCK.hand.click(id, LOCAL),
            quit: (id) => DOCK.hand.quit(id),
            keep: (id, pinned) => DOCK.hand.keep(id, pinned),
            drag: (id, to) => {
                const kept = DOCK.items().flatMap((item) => (item.pinned ? [item.id] : []));
                DOCK.hand.reorder(DOCK_MODEL.dragged(kept, id, to));
            },
        }),
    });

    // The desktop's page is the shell's own, made once: it opens the backdrop, the cursors' surface, and each window's
    // frame and buttons as the window opens. A press there is the person's on a window, so the keyboard goes back to
    // the key window. It lays out off screen too, and the desktop has no frames without it: a page that crashed is
    // loaded again.
    function makePage() {
        const page = PAGES.open(PAGE.PAGE_NAME, {
            keepsDrawing: true,
            reloadsOnCrash: true,
            surfaces: { names: [PAGE.BACKDROP, PAGE.CURSORS], onOpen: openSurface },
        });
        KEY.listen(page);
        PAGES.whenFocused(page, giveBack);
        desktop.page = page;
        update();
    }

    // A press on the backdrop, the desktop where no window is, gives the keyboard back to the desktop's key window.
    function openSurface(name, surface) {
        if (name !== PAGE.BACKDROP) PAGES.whenFocused(surface, giveBack);
        desktop.surfaces.set(name, surface);
        update();
    }

    // A document loaded again in its place finds the surfaces the last one opened, by name, and draws them anew; a
    // page that crashed or went takes them with it, and its next document opens its own.
    function pageEnded({ replaced }) {
        endDrag(LOCAL);
        hands.get(LOCAL).dock = false;
        hands.get(LOCAL).menu = null;
        glass = [];
        if (replaced) return;
        const dropped = [...desktop.surfaces.values()];
        desktop.surfaces.clear();
        layout();
        for (const surface of dropped) PAGES.close(surface);
    }

    function isTitled(window) {
        return window.bar.style === 'titled';
    }

    // The mod whose page a page of the app is, the content of its window, a web page it shows or an overlay of one,
    // or null.
    function modAt(page) {
        const owner = OVERLAY.ownerOf(page);
        return deckit.mods.modOf(WINDOWS.pageOf(web.pageFor(owner) ?? owner));
    }

    // `seat`'s key window, or null.
    function keyWindow(seat) {
        return windows.get(MANAGER.keyOf(seat)) ?? null;
    }

    // The window that holds an attached seat's keyboard: the view shown for it by activation, or its key window; or
    // null.
    function keyboardOf(seat) {
        return panels.get(SHOWING.of(seat)) ?? keyWindow(seat);
    }

    // The seats whose keyboard the window or panel window `id` holds, in the order they sat: those a view is shown for
    // by activation, and those whose key window a window is while their keyboard is not away from it.
    function keyboardsOf(id) {
        if (panels.has(id)) return SHOWING.seatsOf(id);
        return MANAGER.seatsOf(id).filter((seat) => !away(seat));
    }

    // The seat a key was pressed by, as the environment tells what it was put for: the local one's for the machine's.
    function seatOf(source) {
        return sources.get(source) ?? LOCAL;
    }

    // The camera of `seat`, a rect of the desktop (model/camera.js): at the top left its hand keeps, as large as its
    // screen, the host window's for the local seat and for a seat that told none.
    function cameraOf(seat) {
        const hand = hands.get(seat);
        const { x, y } = hand?.camera ?? { x: 0, y: 0 };
        return { x, y, ...(seat !== LOCAL && hand?.screenSize ? hand.screenSize : stage.size()) };
    }

    // The screen of `seat` on its own, `{ seat, camera }`: its order laid in its camera.
    function screenOf(seat) {
        return { seat, camera: cameraOf(seat) };
    }

    // The screen the host window shows, `{ seat, camera }` (CAMERA.shownBy): what is laid on the host window is laid in
    // its camera, in its seat's order.
    function shownScreen() {
        return CAMERA.shownBy(screenOf(LOCAL), followed === null ? null : screenOf(followed), stage.size());
    }

    // The camera the host window shows.
    function shownCamera() {
        return shownScreen().camera;
    }

    // Where the normal windows of `seat` show: its camera under the host's bar.
    function area(seat = LOCAL) {
        return desktopIn(cameraOf(seat));
    }

    // Where the normal windows show in `camera`: under the host's bar.
    function desktopIn(camera) {
        return LAYOUT.desktopOf(camera, strip.height);
    }

    // The panel windows that stand on the screen `seatScreen` (screenOf, shownScreen), or with none on some seat's
    // screen, in the order they opened, each `{ window, frame }`: one at an edge at its frame there, on every screen, a
    // view where ANCHORED places it, under its anchor or at its place, on the screens it is shown for (SHOWING). A
    // view whose anchor is gone, or is another mod's, stands nowhere and is left out. Each frame is in the camera of
    // `seatScreen`, the host window's for none.
    function panelFrames(seatScreen = null) {
        const seat = seatScreen?.seat ?? null;
        const { edged, frames } = standing(seatScreen?.camera ?? shownCamera());
        const on = ({ id }) => (seat === null ? SHOWING.isShown(id) : SHOWING.isOn(seat, id));
        return [...panels.values()].flatMap((window) => {
            const frame = edged.get(window.id) ?? (on(window) ? frames.get(window.id) : null);
            return frame ? [{ window, frame }] : [];
        });
    }

    // The panel windows that stand on the screen of `seat` on its own (screenOf), or with none on some seat's screen
    // (panelFrames).
    function panelsOf(seat = null) {
        return panelFrames(seat === null ? null : screenOf(seat));
    }

    // The screen `camera` shows and its desktop under the host's bar, from the screen's top left, as ANCHORED places a
    // view by them.
    function bounds(camera = shownCamera()) {
        const { width, height } = camera;
        return { stage: { width, height }, desktop: LAYOUT.desktopOf({ width, height }, strip.height) };
    }

    // The windows and the panel windows, in the order they opened, each as ANCHORED.standingOf takes it, and `edged`,
    // the frame of each panel window at an edge by its id (LAYOUT.panelsIn), on the screen `camera` shows from its top
    // left.
    // The content of a panel window at an edge is at its frame; a normal window's is where it rests, while some seat
    // has it on screen.
    function openedNow(camera = shownCamera()) {
        const told = (id) => anchors.get(id) ?? [];
        const atEdge = [...panels.values()].filter((window) => !ANCHORED.isView(window));
        const frames = LAYOUT.panelsIn(
            atEdge.map(({ edge, size }) => ({ edge, size })),
            { width: camera.width, bar: strip.height }
        );
        const edged = new Map(atEdge.map(({ id }, at) => [id, frames[at]]));
        const alone = (id, mod, content) => ({
            id,
            mod,
            anchors: told(id),
            content,
            anchor: null,
            place: null,
            size: null,
        });
        const opened = [...windows.values(), ...panels.values()].map((window) => {
            const { id, mod, bar, anchor = null, place = null, size } = window;
            if (ANCHORED.isView(window)) return { id, mod, anchors: told(id), content: null, anchor, place, size };
            if (panels.has(id)) return alone(id, mod, edged.get(id));
            const content = MANAGER.isShown(id) && LAYOUT.contentOf(MANAGER.frameOf(id), bar);
            return alone(id, mod, content ? CAMERA.onScreen(camera, content) : null);
        });
        return { edged, opened: opened.sort((one, other) => one.id - other.id) };
    }

    // What stands by anchors and at places now on the screen `camera` shows (ANCHORED.standingOf), as rects of the
    // desktop: `anchors`, every anchor of a window whose content is on the stage, at its rect there, and `frames`, the
    // frame of each view that stands; with `edged`.
    function standing(camera = shownCamera()) {
        const lift = (frames) => new Map([...frames].map(([id, frame]) => [id, CAMERA.onPlane(camera, frame)]));
        const { edged, opened } = openedNow(camera);
        const { anchors: standingNow, frames } = ANCHORED.standingOf(bounds(camera), opened);
        const anchorsNow = standingNow.map((anchor) => ({ ...anchor, rect: CAMERA.onPlane(camera, anchor.rect) }));
        return { edged: lift(edged), anchors: anchorsNow, frames: lift(frames) };
    }

    // Whether `name` is a place of the stage a view stands at.
    function isPlace(name) {
        return ANCHORED.isPlace(name);
    }

    // Whether a view of the mod `mod` is refused the anchor `name`, `{ mod, id }`: some window tells it, for another
    // mod.
    function refusesAnchor(mod, name) {
        return ANCHORED.isForeign(ANCHORED.toldBy(openedNow().opened), name, mod);
    }

    // The rounding of a panel window's frame: a view's corners, LAYOUT.panelRadius in the bar.
    function radiusOf(window, frame) {
        return ANCHORED.isView(window) ? ANCHORED.VIEW.radius : LAYOUT.panelRadius(frame);
    }

    // The panel windows of `frames`, those on the screen of `seat` (panelFrames), as they lie there from the bottom
    // (SHOWING.stackedOn).
    function stackedFor(seat, frames) {
        const ids = frames.map(({ window }) => window.id);
        return SHOWING.stackedOn(seat, ids).map((id) => frames[ids.indexOf(id)]);
    }

    // Whether a seat's keyboard is away from its key window: the machine's, the local seat's, with an overlay window
    // or a view, any other's with the view shown for it by activation.
    function away(seat) {
        if (seat === LOCAL) return keyPanel() !== null || !!WINDOWS.keyOverlay();
        return SHOWING.of(seat) !== null;
    }

    // An attached seat's keys go to the content of its key window again.
    function backToKey(hand) {
        hand.keys = null;
    }

    // Where a window or a panel window is on the desktop now, a panel window in the camera of `seat`, or null for one
    // that is gone.
    function frameOn(id, seat = null) {
        return (windows.has(id) ? MANAGER.frameOf(id) : panelFrameOf(id, seat)) ?? null;
    }

    function panelFrameOf(id, seat = null) {
        return panelsOf(seat).find(({ window }) => window.id === id)?.frame ?? null;
    }

    // The host window changed size, and so the local seat's camera and that of each seat that told no screen: every
    // frame stays where it is but a tiled or zoomed window's, which takes its tile again, and what is laid is drawn
    // at once.
    function resized() {
        retaken();
        atOnce = true;
        update();
        atOnce = false;
    }

    // Each window tiled or zoomed in a seat's camera takes its tile, or the tile area, of that camera as it stands.
    function retaken() {
        for (const seat of hands.keys()) MANAGER.retake(seat, LAYOUT.tiledIn(area(seat)));
    }

    // The name of the key window's mod, or the app's while there is none.
    function titleOf(key) {
        const mod = key && MODS.loaded(deckit.mods).find(({ id }) => id === key.mod);
        return mod?.name || deckit.config.name;
    }

    // From the bottom: the mods' pages with a window here, but for a child's another stage shows, the backdrop, each
    // window in the local seat's order with the children its regions show, the materials the desktop's page draws glass
    // over, then that page, taking the pointer only at the host's bar and the Dock, its sliver down the edge
    // and its card while it is out, the panel windows at an edge with the children their regions show, and over them
    // the views on that seat's screen, as stackedFor has them, each at its rect of the desktop less the top left of the
    // camera the host window shows (shownCamera). Over all of it, the overlay of each page laid that shows
    // anything, at its page's rect, or over the whole stage for a page whose front window is a panel window, so what it
    // presents is not cut to the panel. Over those, while more than one seat is at the desktop, the cursors' surface,
    // where the desktop's page draws each seat's cursor: it covers the stage and takes the pointer nowhere, so a press,
    // a move and a scroll go to what is under it, and it is given no keyboard. With deckit's core down the desktop's
    // page alone covers it all.
    function layout() {
        const full = { x: 0, y: 0, ...stage.size() };
        const camera = shownCamera();
        inPanels.clear();
        // A dialog stands where its page shows as this layout has it: its window resized, zoomed or tiled.
        for (const [ask, page] of asking) DIALOGS.move(ask, dialogAt(page));
        if (down) {
            stage.lay(whole({ desktop: [{ page: desktop.page, rect: full }] }));
            REGION.show(stage, []);
            return;
        }
        const view = MANAGER.viewOf(shownSeat());
        const { parts: own, children } = laidOf(view, drawnNow(view), LOCAL, shownScreen());
        // In another seat's order the desktop's page takes the machine's pointer everywhere, and what is laid over it
        // nowhere.
        const parts = followed === null ? own : LEVELS.heldAt(own, 'desktop', full);
        for (const { window, page } of children) {
            if (!panels.has(window)) continue;
            inPanels.add(page);
            if (!heard.has(page)) PAGES.whenFocused(page, () => pressPanelChild(page));
            heard.add(page);
        }
        const laid = whole(parts);
        onDesktop.clear();
        for (const { page, rect } of laid) if (rect) onDesktop.set(page, rect);
        stage.lay(CAMERA.laidOn(camera, laid));
        REGION.show(stage, shown ? [...new Set(children.map(({ page }) => page))] : []);
    }

    // What is laid of the desktop for a seat, as layout() tells it: `view` the windows on its screen (MANAGER.viewOf),
    // `seen` what is drawn of each (drawnNow), `docked` the seat whose Dock it has, out or in and with the menu open
    // for that seat, or null for the Dock in, and `seatScreen` the screen it is laid on (screenOf, shownScreen), its
    // seat's views laid in its camera, or null for every view in the host window's camera.
    // Answers `{ parts, children }`, `parts` the layers of each level (model/levels.js), and `children` those the
    // windows and the panel windows show (childrenIn).
    function laidOf(view, seen, docked, seatScreen = null) {
        const seat = seatScreen?.seat ?? null;
        const full = seatScreen?.camera ?? shownCamera();
        const onScreen = (rect) => CAMERA.onScreen(full, rect);
        const out = hands.get(docked)?.dock ?? false;
        const inBar = panelFrames(seatScreen);
        const children = childrenIn([
            ...seen.filter(({ leaving }) => !leaving),
            ...inBar.map(({ window, frame }) => ({ id: window.id, frame })),
        ]);
        const laidChildren = new Set(children.map(({ page }) => page));
        for (const { window, page } of children) inWindows.set(page, window);
        const front = new Map(); // a mod's page -> the frame of its front window on screen
        for (const { window, frame } of inBar) {
            if (front.has(window.page)) continue;
            front.set(window.page, frame);
            fronts.set(window.page, window.id);
        }
        const ofPanels = new Set(front.keys()); // the pages whose front window on screen is a panel window
        for (const { id, frame } of view) {
            front.set(windows.get(id).page, frame);
            fronts.set(windows.get(id).page, id);
            ofPanels.delete(windows.get(id).page);
        }
        const pages = new Set(
            [...windows.values(), ...panels.values()]
                .map(({ page }) => page)
                .filter((page) => !laidChildren.has(page) && !REGION.shownElsewhere(page, stage))
        );
        const surface = (name) => desktop.surfaces.get(name);
        const views = inBar.filter(({ window }) => ANCHORED.isView(window));
        const laidPanel = ({ window, frame }) => {
            const clip = { ...frame, cornerRadius: radiusOf(window, frame) };
            return [
                window.surface && { page: window.surface, rect: frame, clip },
                ...children
                    .filter(({ window: holder }) => holder === window.id)
                    .map(({ page, rect }) => ({ page, rect, clip })),
            ].filter(Boolean);
        };
        // A view on another seat's screen alone lies under the backdrop at its frame, so its content has its size and
        // takes that seat's input while this screen shows nothing of it.
        const elsewhere = panelFrames().filter(
            ({ window }) => window.surface && !inBar.some((one) => one.window === window)
        );
        const backdrop = surface(PAGE.BACKDROP);
        const cursors = hands.size > 1 && surface(PAGE.CURSORS);
        return {
            children,
            parts: {
                pages: [
                    ...[...pages].map((page) => ({
                        page,
                        rect: front.get(page) ?? desktopIn(full),
                        ...(ofPanels.has(page) ? { spread: full } : {}),
                        input: [],
                    })),
                    ...elsewhere.map(({ window, frame }) => ({ page: window.surface, rect: frame, input: [] })),
                ],
                backdrop: backdrop ? [{ page: backdrop, rect: full }] : [],
                windows: seen.flatMap(({ id, window, frame, opacity, scale, content, leaving, surfaces }) => {
                    const { bar } = window;
                    const parts = LAYOUT.partsOf(frame, bar);
                    const clip = { ...frame, cornerRadius: LAYOUT.RADIUS };
                    const [frameSurface, buttons, dialogSurface] = surfaces ?? [
                        surface(PAGE.frameOf(id)),
                        surface(PAGE.buttonsOf(id)),
                        surface(PAGE.dialogOf(id)),
                    ];
                    const asked = DIALOGS.inWindow(id).map(({ rect }) => rect);
                    const seenAs = { ...(opacity < 1 ? { opacity } : {}), ...(scale ? { scale } : {}) };
                    const laid = { ...content, x: frame.x, y: frame.y };
                    // Drawn scaled, as it opens, closes or goes into its Dock tile and back, it is laid whole at its
                    // frame, past where it is drawn: it takes no press until it rests.
                    const resting = !leaving && !scale;
                    const still = resting ? {} : { input: [] };
                    return [
                        frameSurface && {
                            page: frameSurface,
                            rect: parts.rect,
                            input: !resting
                                ? []
                                : [
                                      ...(bar.enabled.zoom ? parts.edges.map(({ rect }) => rect) : []),
                                      ...(isTitled(window) ? [LAYOUT.titleBarOf(frame, bar)] : []),
                                  ],
                            ...seenAs,
                        },
                        window.surface && {
                            page: window.surface,
                            rect: LAYOUT.contentOf(laid, bar),
                            clip,
                            ...still,
                            ...seenAs,
                        },
                        ...children
                            .filter(({ window }) => window === id)
                            .map(({ page, rect }) => ({ page, rect, clip, ...still, ...seenAs })),
                        dialogSurface &&
                            asked.length > 0 && {
                                page: dialogSurface,
                                rect: { x: laid.x, y: laid.y, width: laid.width, height: laid.height },
                                clip,
                                input: resting ? asked : [],
                                ...seenAs,
                            },
                        buttons && {
                            page: buttons,
                            rect: parts.buttons,
                            ...(leaving ? { clip } : {}),
                            input: !resting
                                ? []
                                : LAYOUT.buttonsOf(bar).map(({ x, y, width, height }) => ({ x, y, width, height })),
                            ...seenAs,
                        },
                    ].filter(Boolean);
                }),
                glass,
                desktop: [
                    {
                        page: desktop.page,
                        rect: full,
                        input: [
                            ...(strip.height ? [{ x: 0, y: 0, width: full.width, height: strip.height }] : []),
                            ...DOCK_MODEL.inputOf(desktopIn(full), out, DOCK.items(), menuOf(docked, full)).map(
                                onScreen
                            ),
                        ],
                    },
                ],
                panels: inBar.filter(({ window }) => !ANCHORED.isView(window)).flatMap(laidPanel),
                views: stackedFor(seat, views).flatMap(laidPanel),
                cursors: cursors ? [{ page: cursors, rect: full, input: [] }] : [],
            },
        };
    }

    // The layers of `parts` as the stage takes them, bottom to top: the levels under the pages' overlays, the overlay
    // of each page laid there that shows anything, then the levels over them.
    function whole(parts) {
        return [...OVERLAY.withOverlays(LEVELS.under(parts)), ...LEVELS.over(parts)];
    }

    // What is laid of the desktop for `seat`, each window where it rests in the seat's order: what a press of the
    // seat's pointer is read against (`stage.hit`), and what a picture for it is made of.
    function laidFor(seat) {
        const view = MANAGER.viewOf(seat);
        return whole(laidOf(view, rested(view), seat, screenOf(seat)).parts);
    }

    // What is laid of one window or panel window alone, where it rests, whatever is over it and whichever seat's
    // screen it is on: its frame and buttons, its content, the children its regions show, and their overlays.
    function laidOfWindow(id) {
        const view = windows.has(id) ? [{ id, frame: MANAGER.frameOf(id) }] : [];
        const own = [PAGE.frameOf(id), PAGE.buttonsOf(id)].map((name) => desktop.surfaces.get(name));
        return whole(laidOf(view, rested(view), null).parts).filter(
            ({ page }) => page && (own.includes(page) || windowAt(page)?.id === id)
        );
    }

    // What is drawn of each window of `view` once it rests, as laidOf takes it.
    function rested(view) {
        return view.map(({ id, frame }) => ({
            id,
            window: windows.get(id),
            frame,
            opacity: 1,
            scale: null,
            content: frame,
            leaving: null,
        }));
    }

    // The seats whose keys go to `page` now, in the order they sat. The local seat's keyboard is the machine's, and
    // which page of its window has it is not told here: it is named in every page of that window.
    function typingIn(page) {
        const window = windowAt(page);
        if (!window) return [];
        const seats = [];
        for (const [seat, hand] of hands) {
            if (seat === LOCAL) {
                if ((keyPanel() ?? (WINDOWS.keyOverlay() ? null : keyWindow(LOCAL))) === window) seats.push(seat);
            } else if (keyboardOf(seat) === window) {
                if ((hand.keys?.id === window.id ? hand.keys.page : window.surface) === page) seats.push(seat);
            }
        }
        return seats;
    }

    // What is drawn of each window on the local seat's screen, `view` as MANAGER.viewOf has it: back to front, each `{
    // id, window, frame, opacity, scale, content, leaving, surfaces }`, `frame` where its frame is laid, `opacity` how
    // much of it shows, `scale` how all of it is drawn scaled where it is, `content` the frame its content is laid at,
    // its own, from the frame's top left and cut to it; a window going into its Dock tile or closing comes after them,
    // in front, `leaving`, until it is gone, with the `surfaces` its frame and buttons are drawn in. Each frame is
    // drawn by its motion to where the window is: one the hand moves or resizes, and every one as the desktop changes
    // size, there at once; any other by the `move` spring from where it is drawn, its speed carried over, its frame
    // moving and its content at its own size. One opening, closing, going into its Dock tile or coming out of it is
    // laid whole at its frame and drawn scaled, content and all: opening from a little smaller about its middle, faded
    // out, closing back so, going into its Dock tile and coming out of it from there. While the system asks for reduced
    // motion each rect is there at once, opening, closing, going into the Dock and coming out of it fading alone.
    function drawnNow(view) {
        const now = clock.now();
        const seen = [];
        const leaving = [];
        let running = false;
        for (const { id, frame } of view) {
            const to = { ...frame, opacity: 1 };
            let entry = drawn.get(id);
            if (!entry) {
                entry = { window: windows.get(id), value: to, velocity: {}, motion: null, late: false, leaving: null };
                drawn.set(id, entry);
                go(entry, { ...MOTION.scaled(frame), opacity: 0 }, to, 'enter', now, { scales: true });
            } else if (entry.leaving) {
                step(entry, now);
                entry.leaving = null;
                go(entry, entry.value, to, 'enter', now, { late: true, scales: true });
            } else if (!same(entry.motion?.to ?? entry.value, to)) {
                step(entry, now);
                if (handHeld.has(id) || atOnce || reduced !== false) settle(entry, to);
                else go(entry, entry.value, to, 'move', now);
            }
            step(entry, now);
            running = running || !!entry.motion;
            entry.frame = frame;
            seen.push({ id, window: entry.window, ...frameOf(entry, frame), content: frame, leaving: null });
        }
        const shownNow = new Set(view.map(({ id }) => id));
        for (const [id, entry] of drawn) {
            if (shownNow.has(id)) continue;
            if (!entry.leaving) {
                const closed = !windows.has(id);
                entry.leaving = closed ? 'closed' : 'minimized';
                entry.content = entry.frame ?? { ...entry.value };
                const tile = closed ? MOTION.scaled(entry.content) : (dockTileOf(entry.window) ?? entry.content);
                const role = closed ? 'exit' : 'move';
                go(entry, entry.value, { ...tile, opacity: 0 }, role, now, { late: !closed, scales: true });
            }
            if (!entry.motion) continue;
            step(entry, now);
            if (!entry.motion) {
                entry.motion = null;
                if (entry.leaving === 'closed') {
                    drawn.delete(id);
                    entry.gone?.();
                }
                continue;
            }
            running = true;
            const { window, content, surfaces } = entry;
            leaving.push({ id, window, ...frameOf(entry, content), content, leaving: entry.leaving, surfaces });
        }
        if (running) tick();
        return [...seen, ...leaving];
    }

    // The motion of `entry` from `from` to `to` by the spring of `role`, from the speed it is drawn at now, its opacity
    // seen late (MOTION.lateOpacity) where `late`, the window laid at its frame and drawn scaled into the rect where it
    // `scales`; with reduced motion its rect is at `to` at once and its opacity fades by the spring alone.
    function go(entry, from, to, role, now, { late = false, scales = false } = {}) {
        if (reduced === null) return settle(entry, to);
        const start = reduced ? { ...to, opacity: from.opacity } : from;
        entry.late = late && !reduced;
        entry.scales = scales;
        entry.motion = MOTION.motionOf({ from: start, to, role, now, velocity: entry.velocity });
        if (same(start, to)) settle(entry, to);
    }

    function settle(entry, to) {
        entry.motion = null;
        entry.scales = false;
        entry.value = to;
        entry.velocity = {};
    }

    // `entry` drawn as its motion has it at `now`: answers whether it still runs.
    function step(entry, now) {
        if (!entry.motion) return false;
        const { value, velocity, done } = MOTION.motionAt(entry.motion, now);
        entry.value = value;
        entry.velocity = velocity;
        if (done) entry.motion = null;
        return !done;
    }

    // What is drawn of `entry`, its window laid at `laid`: `{ frame, opacity, scale }`, `frame` its rect rounded to
    // the px and `scale` null, or, where its motion scales it, `frame` `laid` and `scale` drawing it into its rect.
    function frameOf({ value, late, scales }, laid) {
        const raw = late ? MOTION.lateOpacity(value.opacity) : value.opacity;
        const opacity = Math.round(Math.min(1, Math.max(0, raw)) * 1000) / 1000;
        const scale = scales ? MOTION.scaleInto(laid, value) : null;
        if (scale) return { frame: laid, opacity, scale };
        const frame = {
            x: Math.round(value.x),
            y: Math.round(value.y),
            width: Math.max(0, Math.round(value.width)),
            height: Math.max(0, Math.round(value.height)),
        };
        return { frame, opacity, scale: null };
    }

    function same(one, other) {
        return MOTION.PARTS.every((part) => Math.abs(one[part] - other[part]) < 0.001);
    }

    // The next frame of the windows' motion laid once it is due.
    function tick() {
        if (ticking) return;
        ticking = true;
        clock.later(() => {
            ticking = false;
            if (stage) layout();
        });
    }

    // Where the Dock's item of `window`'s mod stands, or null where it has none.
    function dockTileOf(window) {
        return DOCK_MODEL.tileOf(desktopIn(shownCamera()), DOCK.items(), window.mod);
    }

    // A material the desktop's page told, `{ material, rect, cornerRadius }`, or none.
    function materialOf({ material, x, y, width, height, cornerRadius } = {}) {
        const rect = { x, y, width, height };
        if (typeof material !== 'string' || ![x, y, width, height].every(Number.isFinite)) return [];
        return [{ material, rect, cornerRadius: Number.isFinite(cornerRadius) ? Math.max(0, cornerRadius) : 0 }];
    }

    // `[{ window, page, rect }]`: the children the windows on screen show in their regions, each page on the stage once
    // its view is there, as attach() has ended with one.
    function childrenIn(view) {
        const pageOf = new Map(
            deckit.mods
                .runs()
                .filter(({ run }) => run.state === 'running' && run.summary.view)
                .map(({ run, page }) => [run.mod.id, page])
        );
        const framed = new Map(view.map(({ id, frame }) => [id, frame]));
        const parents = new Set(view.map(({ id }) => (windows.get(id) ?? panels.get(id)).mod));
        return [...parents].flatMap((parent) =>
            [...REGION.laidOut(parent, (child) => pageOf.has(child))].flatMap(([child, { window, rect }]) => {
                const frame = framed.get(window);
                if (!frame) return [];
                const at = {
                    x: Math.round(frame.x + rect.x),
                    y: Math.round(frame.y + rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                };
                return [{ window, page: pageOf.get(child), rect: at }];
            })
        );
    }

    // The Dock's items as `seat` sees them, `{ id, pinned, running, attention, active }`: `attention` where the mod
    // asks for the seat's attention, and `active` for the mod of the seat's key window. The seat is the one the host
    // window shows where none is named.
    function dockNow(seat = shownSeat()) {
        const active = windows.get(MANAGER.keyOf(seat))?.mod ?? null;
        const attention = ACTIVATION.attentionOf(seat);
        return DOCK.items().map(({ id, pinned, running }) => ({
            id,
            pinned,
            running,
            attention: attention.includes(id),
            active: id === active,
        }));
    }

    // `{ windows, panels, seats, following, drop, strip, dock, down }`, as the desktop's page draws it, of the seat the
    // host window shows, each frame and point less the top left of the camera it shows (shownCamera). A window's frame
    // is key while the window holds that seat's keyboard: not while an overlay window or a view does, which update()
    // tells as it takes or gives it back. Its `rings` are of every seat whose key window it is, and its `handles` the
    // edges (LAYOUT.EDGES) in whose reach a seat's pointer is.
    function stateOfPage() {
        const seatScreen = shownScreen();
        const { seat, camera } = seatScreen;
        const onScreen = (at) => CAMERA.onScreen(camera, at);
        const menu = menuOf(LOCAL, camera);
        const key = MANAGER.keyOf(seat);
        const { moving, dropping } = hands.get(seat) ?? {};
        const active = windows.get(key)?.mod ?? null;
        const viewed = viewedStack();
        return {
            windows: MANAGER.viewOf(seat).map(({ id, frame }) => ({
                id,
                frame: onScreen(frame),
                key: id === key && !away(seat),
                rings: MANAGER.seatsOf(id).map((each) => COLOURS.of(each)),
                handles: [
                    ...new Set(
                        [...hands.values()].filter(({ reach }) => reach?.id === id).map(({ reach }) => reach.edge)
                    ),
                ],
                bar: windows.get(id).bar,
                title: isTitled(windows.get(id)) ? windows.get(id).title : null,
                dialogs: DIALOGS.inWindow(id).map((dialog) => ({
                    ask: dialog.ask,
                    kind: dialog.kind,
                    name: dialog.name,
                    message: dialog.message,
                    from: dialog.from,
                    value: dialog.value,
                    rect: dialog.rect,
                    parts: DIALOG_MODEL.partsOf(dialog),
                })),
            })),
            panels: stackedFor(seat, panelFrames(seatScreen)).map(({ window, frame }) => ({
                id: window.id,
                edge: window.edge,
                frame: onScreen(frame),
                radius: radiusOf(window, frame),
            })),
            seats: [...hands].map(([id, { pointer, buttons, acted }]) => ({
                id,
                name: seated.get(id)?.user.name ?? id,
                colour: COLOURS.of(id),
                ...MARKS.cursorOn(
                    camera,
                    pointer && { x: Math.round(pointer.x), y: Math.round(pointer.y) },
                    stackOf(screenOf(id)),
                    viewed
                ),
                buttons,
                shown: id === seat,
                named: MARKS.nameLeft(acted, clock.now()) > 0,
                typing: typingOf(id),
            })),
            following:
                followed === null
                    ? null
                    : { id: seat, name: seated.get(seat)?.user.name ?? seat, colour: COLOURS.of(seat) },
            drop:
                moving && dropping
                    ? { tile: dropping, frame: onScreen(LAYOUT.tileOf(dropping, LAYOUT.tiledIn(area(seat)))) }
                    : null,
            strip,
            dock: {
                items: DOCK.items(),
                active,
                attention: ACTIVATION.attentionOf(seat),
                held: DOCK.dragged(),
                menu: menu && {
                    ...menu,
                    frame: onScreen(menu.frame),
                    entries: menu.entries.map((entry) => ({ ...entry, rect: onScreen(entry.rect) })),
                    rules: menu.rules.map(onScreen),
                },
            },
            down: down && { name: deckit.config.name, why: down },
        };
    }

    function tellPage() {
        if (!desktop.page || !PAGES.isAlive(desktop.page)) return;
        const state = stateOfPage();
        const written = JSON.stringify(state);
        if (written === desktop.sent) return;
        desktop.sent = written;
        PROTOCOL.state.send(desktop.page, state);
    }

    // The keyboard is the content's of the panel window that holds it or of the key window, or the desktop page's while
    // there is none or the host window shows another seat's view.
    function focus() {
        const page = (!down && followed === null && (keyPanel() ?? keyWindow(LOCAL))?.surface) || desktop.page;
        if (page) PAGES.focus(page);
    }

    // A press on the desktop's page or one of its surfaces leaves the keyboard with the key window, or with the panel
    // window that holds it.
    function giveBack() {
        const content = !down && followed === null && (keyPanel() ?? keyWindow(LOCAL))?.surface;
        if (content) PAGES.focus(content);
    }

    // What a page of the app is to the desktop: the desktop's page, for it or a surface it opened; the mod's page, for
    // the content of a window here, a mod's page with a window here, a web page in either or the overlay of one; or
    // null.
    function pageOf(given) {
        const owner = OVERLAY.ownerOf(given);
        if (owner === desktop.page || [...desktop.surfaces.values()].includes(owner)) return desktop.page;
        const held = web.pageFor(owner) ?? owner;
        const open = [...windows.values(), ...panels.values()];
        return open.find(({ surface, page }) => surface === held || page === held)?.page ?? null;
    }

    // Whether a keystroke or a request in this page is the desktop's.
    function contains(page) {
        return !!pageOf(page);
    }

    // A press of the shell's key `id` in a page of the app that the page did not handle, by the seat it was put for or
    // by the machine's keyboard: the desktop takes it in its own pages while it is shown, for that seat. The local
    // seat's key that ends its following of another seat does no more.
    function pressKey(id, pressedIn, source) {
        const seat = seatOf(source);
        if (!shown || !pageOf(pressedIn) || !hands.has(seat)) return false;
        if (seat === LOCAL && unfollowed('down')) return true;
        KEY_ACTIONS[id](seat);
        return true;
    }

    // The back-most of the windows of `seat`'s active mod on its screen comes in front.
    function cycleWindows(seat) {
        const key = keyWindow(seat);
        if (!key) return;
        const ids = MANAGER.orderOf(seat).filter(
            (id) => windows.get(id).mod === key.mod && !MANAGER.isMinimized(seat, id)
        );
        if (ids.length <= 1) return;
        MANAGER.orderFront(seat, ids[0]);
        update();
    }

    function show() {
        stage.show(true);
        if (shown) return;
        shown = true;
        update();
        focus();
    }

    function hide() {
        if (!shown) return;
        shown = false;
        stage.show(false);
        update();
    }

    // `titleBar`, the host window's bar over the desktop's top: { height, controlsWidth }.
    function present(next) {
        strip = { height: next?.titleBar?.height ?? 0, controlsWidth: next?.titleBar?.controlsWidth ?? 0 };
        resized();
    }

    return {
        start,
        // The dialogs up in window `id`, each where it stands (DIALOG_MODEL).
        dialogsIn: (id) => DIALOGS.inWindow(id),
        openPanel,
        closePanel,
        setAnchors,
        isPlace,
        refusesAnchor,
        orderFrontPanel,
        togglePanel,
        keyPanel,
        keptFrameOf,
        remember,
        keepsFramesOf,
        forgetFramesOf,
        // What the seats' member reads and does (shell/seats): `now()` answers who sits (seatsNow),
        // `onChange(listener)` hears it change and answers its off, and `follow(seat)` has the host window show that
        // seat's view, or the local seat's own with null, and says whether it shows that seat's now.
        seats: Object.freeze({
            now: seatsNow,
            onChange: (listener) => {
                seatListeners.add(listener);
                return () => seatListeners.delete(listener);
            },
            follow: (seat) => {
                follow(seat);
                return seat !== null && followed === seat;
            },
        }),
        open,
        close,
        orderFront,
        // What a window's content tells of it: a press that took the machine's keyboard is the local seat's, and what
        // the content asks of its window is asked by the seat that pressed it last.
        press: (window) => press(LOCAL, window),
        pressPanel: (window) => pressPanel(LOCAL, window),
        minimize: (window) => minimize(presserOf(window), window),
        zoom: (window) => zoom(presserOf(window), window),
        resize,
        move: (window, ...drag) => move(presserOf(window), window, ...drag),
        doubleClick: (window) => doubleClick(presserOf(window), window),
        activate,
        activation,
        setTitle,
        // The seat at the host window.
        get localSeat() {
            return LOCAL;
        },
        stateOf,
        isKey,
        onChange,
        update,
        // What the host drives of it.
        control: {
            glass: true,
            // Into one of the host app's windows, as a stage is placed (`bounds`, `onClose`).
            place: (window, options) => stage.place(window, options),
            contains,
            show,
            hide,
            focus,
            present,
            shown: () => shown,
            windows: windowsNow,
            // The panel windows that stand on the screen of `seat`, or with none on some seat's, in the order they
            // opened, each `{ id, mod, name, edge, frame }`, `edge` null for a view.
            panels: (seat = null) =>
                panelsOf(seat).map(({ window: { id, mod, name, edge }, frame }) => ({ id, mod, name, edge, frame })),
            // The anchors that stand, each `{ window, owner, id, rect, mod }`: the window whose content it is in, the
            // mod that told it, its id among that mod's, its rect on the stage, and the mod that may bind to it.
            anchors: () => standing().anchors,
            dock: dockNow,
            hand,
            // The active mod of `seat`, by its id, or null, and the mods that ask for its attention, in the order
            // they first asked: what a host app shows of them, of the local seat where it names none.
            active: (seat = LOCAL) => ACTIVATION.activeOf(seat),
            attention: (seat = LOCAL) => ACTIVATION.attentionOf(seat),
        },
    };
}
