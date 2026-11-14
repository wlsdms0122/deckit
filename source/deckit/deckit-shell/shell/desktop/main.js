import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as WM from './model/window-manager.js';
import * as MOTION from './model/motion.js';
import * as ACTIVATION_MODEL from './model/activation.js';
import * as DOCK_MODEL from '../dock/model/dock.js';
import * as MODS from '../mods/index.js';

// How many frames a second a window's motion is drawn at.
const FRAMES = 120;

// `deckit` is what connect answered, `state` the shell's own state, `web` what the web engine answered (`pageFor`),
// `host` the app's answers, `REGION` the regions mods give their children, `PAGES` the shell's pages, `OVERLAY` their
// overlays, `KEY` the keys of the app, `makeStage()` a stage to lay them on (environment: SHELL.stage),
// `actionOnDoubleClick()` what the person set a double click on a title bar to do (environment: SHELL), `input` what
// tells the machine's input and puts a seat's in a page, `reserve` what keeps a page from the machine's keyboard
// (environment: SHELL `input`, `keys.reserve`), and `clock`
// what draws a frame's motion: `now()` in ms and `later(next)`, next called once the next frame is due.
export function createDesktop({
    REGION,
    PAGES,
    OVERLAY,
    KEY,
    makeStage,
    actionOnDoubleClick,
    input: INPUT,
    reserve,
    deckit,
    state: STATE,
    web,
    host,
    clock = { now: () => performance.now(), later: (next) => setTimeout(next, 1000 / FRAMES) },
}) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const FRAMES = 'window-frames';
    // The seat at the host window, whose view it shows: `deckit.seats.local`, by its id, as every seat is named here.
    let LOCAL = 'local';
    const seated = new Map(); // seat id -> the seat as deckit tells it, while it is open
    // seat id -> what its hand holds: `moving`, `{ id, from, grab, pointer }`, the window a drag of its title bar or
    // its content's drag regions moves, from the frame it had at the press, `grab` where the press was in that frame,
    // and where the pointer is on the stage now; `dropping`, the tile that window takes let go now, or null;
    // `pointer`, where its pointer is on the desktop, or null; `down`, where its press went until it lets go, a page
    // with `origin`, the page's top left on the desktop, or a `part` of the window `id` with its `grip`; and
    // `wanted`, the window it pressed last that another seat holds, or null
    const hands = new Map();
    let tells = null; // what deckit answered the shell's serving with: what tells a seat
    const MANAGER = WM.createWindowManager({
        isIdle: (seat) => seated.has(seat) && deckit.seats.isIdle(seated.get(seat)),
        onTaken: (holder, window, by) => seated.has(holder) && tells?.held(seated.get(holder), { window, holder: by }),
    });
    const ACTIVATION = ACTIVATION_MODEL.createActivation();
    // What each of the shell's keys does, by its id, to the key window of the seat that pressed it.
    const KEY_ACTIONS = Object.freeze({
        closeWindow: (seat) => keyWindow(seat) && clicked(seat, keyWindow(seat), 'close'),
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
    const reserved = new WeakMap(); // a window's content -> whether it is kept from the machine's keyboard, as told
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
    let held = null; // the id of the panel window at the edge `right` that holds the machine's keyboard, or null
    let shown = false;
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let strip = { height: 0, controlsWidth: 0 }; // the host's bar over the desktop's top
    let dockOut = false; // whether the Dock is out, as the desktop's page last told
    let glass = []; // the materials laid under the desktop's page, as it last told

    // MARK: - Initializer
    // MARK: - Public
    // The desktop in the host window, the local seat's view of it: the backdrop, the normal windows `WINDOWS` opens in
    // the seat's order, each its content between the frame under it and the buttons over it with the children its
    // regions show, and the Dock and the host's bar over them, `DOCK` giving the Dock's items, and the panel windows in
    // that bar. Each mod's page with a
    // window there is laid under the backdrop, at its front window, so what its overlay draws for a window lands over
    // that window. The machine's keyboard is the local seat's: a key pressed in a page reaches the mod whose page it
    // is, a chord the mod that took it, for the seat that pressed it. Every seat deckit opens sits here, and what a
    // seat's devices do enters through `deckit.seats.input`, the machine's as the local seat's.
    function start(given) {
        WINDOWS = given.WINDOWS;
        DOCK = given.DOCK;
        frames = STATE.read(FRAMES, {});
        LOCAL = deckit.seats.local?.id ?? LOCAL;
        sit({ id: LOCAL });
        for (const seat of deckit.seats.list()) sit(seat);
        deckit.seats.onOpen(sit);
        deckit.seats.onClose(leave);
        tells = deckit.seats.serve({ input: entered });
        INPUT.listen(carried);
        deckit.mods.onRequest(({ from, to }) => ACTIVATION.request(from, to));
        KEY.monitor((page, _keystroke, from) => ACTIVATION.input(seatOf(from), modAt(page)));
        KEY.onChord((mod, from) => ACTIVATION.input(seatOf(from), mod));
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

    // A normal window opens where its mod last left a normal window of its name, or cascaded from the key window, or
    // the front window on screen while none is key, where it left none or one of that name is open, placed at its size
    // no smaller than its minimum, brought forward as orderFront brings it. Its `bar` is its title bar (LAYOUT.barOf):
    // the shell draws the bar of a titled one, holding its `title`, over its content.
    function open(window, { activates = true } = {}) {
        const desktopNow = area();
        const key = keyWindow(LOCAL);
        const after = key ? MANAGER.frameOf(key.id) : (MANAGER.viewOf(LOCAL).at(-1)?.frame ?? null);
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
        MANAGER.open(null, window.id, { frame, minimum });
        orderFront(window, { activates });
    }

    // A panel window stands at its edge, where panelFrames() places it, in front of every normal window: its content
    // lies on the material the desktop's page draws for it, cut to its frame rounded as LAYOUT.panelRadius has it. One
    // in the bar is never key; one at the right edge takes the keyboard as it opens, as orderFront gives it.
    function openPanel(window, { activates = true } = {}) {
        panels.set(window.id, window);
        if (!orderFrontPanel(window, { activates })) update();
    }

    function closePanel(window) {
        if (!panels.delete(window.id)) return;
        if (held === window.id) held = null;
        update();
    }

    // A panel window at the right edge takes the keyboard from the desktop where `activates` is true and its mod may
    // activate for the local seat, the host window coming up; one in the bar stands where it is. Answers whether it
    // took the keyboard.
    function orderFrontPanel(window, { activates = true } = {}) {
        if (!panels.has(window.id) || window.edge !== 'right' || !activates) return false;
        if (!ACTIVATION.mayActivate(LOCAL, window.mod)) return false;
        held = window.id;
        update();
        host.show();
        return true;
    }

    // `seat` pressed in a panel window: its input reached the window's mod. For the local seat, one in the bar leaves
    // the machine's keyboard with the key window, or with the panel window that holds it; one at the right edge takes
    // it.
    function pressPanel(seat, window) {
        if (!panels.has(window.id)) return;
        ACTIVATION.input(seat, window.mod);
        if (seat !== LOCAL) return;
        if (window.edge !== 'right') return giveBack();
        if (held === window.id) return;
        held = window.id;
        update();
    }

    // The keyboard back on the desktop, with its key window, from the panel window that holds it: as the person
    // presses a normal window, the desktop or the Dock, or a normal window comes in front as the key window. Where an
    // overlay window took it, `refocus` false, the desktop's page is left as it is.
    function toDesktop({ refocus = true } = {}) {
        if (held === null) return;
        held = null;
        if (!refocus) focused = keyWindow(LOCAL);
        update();
    }

    // The local seat pressed a child's view shown in a panel window: as a press in the panel window, its input reached
    // the child's mod, and the keyboard stays with the key window.
    function pressPanelChild(page) {
        if (!inPanels.has(page)) return;
        ACTIVATION.input(LOCAL, deckit.mods.modOf(page));
        giveBack();
    }

    // A mod left with no window open asks for no seat's attention.
    function close(window) {
        if (!windows.delete(window.id)) return;
        MANAGER.close(null, window.id);
        pressers.delete(window.id);
        if (![...windows.values()].some(({ mod }) => mod === window.mod)) ACTIVATION.cancelAttention(window.mod);
        for (const [seat, hand] of hands) {
            if (hand.moving?.id === window.id) endDrag(seat);
            if (hand.wanted === window.id) hand.wanted = null;
            if (hand.down?.id === window.id) hand.down = null;
        }
        const surfaces = [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)].map((name) => {
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
    // front, and its key window unless `activates` is false or another seat holds it, the host window coming up for
    // the local seat; where it may not, right behind the seat's key window, not key, its mod asking for the seat's
    // attention unless `activates` is false, or in front where the seat has no key window to hold it behind.
    function orderFront(window, { activates = true } = {}) {
        if (!windows.has(window.id)) return;
        for (const seat of hands.keys()) {
            if (ACTIVATION.mayActivate(seat, window.mod)) MANAGER.orderFront(seat, window.id, { activates });
            else holdBack(seat, [window.id], window.mod, { activates });
        }
        const shows = activates && ACTIVATION.mayActivate(LOCAL, window.mod);
        if (shows) held = null;
        update();
        if (shows) host.show();
    }

    // `seat` pressed in the window, on its frame or in its content: its input reached the window's mod, and the
    // window comes in front in its order, as its key window unless another seat holds it. Answers as
    // MANAGER.makeKey does.
    function press(seat, window) {
        if (!windows.has(window.id)) return null;
        ACTIVATION.input(seat, window.mod);
        const made = MANAGER.orderFront(seat, window.id);
        pressers.set(window.id, seat);
        const hand = hands.get(seat);
        if (hand) hand.wanted = made === WM.HELD ? window.id : null;
        if (seat === LOCAL) held = null;
        update();
        return made;
    }

    function minimize(seat, window) {
        MANAGER.minimize(seat, window.id);
        update();
    }

    function zoom(seat, window) {
        MANAGER.zoom(seat, window.id, LAYOUT.zoomedIn(area()));
        update();
    }

    // In the tile `name` of the zoom area (LAYOUT.TILES), where the window is resizable: the frame it had before is
    // kept for its return, and what the person left it at stays that frame.
    function tile(seat, window, name) {
        if (!window.bar.enabled.zoom || !windows.has(window.id)) return;
        MANAGER.tile(seat, window.id, name, LAYOUT.tileOf(name, LAYOUT.zoomedIn(area())));
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

    function resize(window, { width, height }) {
        const frame = MANAGER.frameOf(window.id);
        if (!frame) return;
        MANAGER.setFrame(null, window.id, { ...frame, width, height });
        remember(window);
        update();
    }

    // `seat`'s drag of the content's drag regions, or of the title bar of a titled window, `dx`, `dy` from the press,
    // `grab`
    // `{ x, y }` where it pressed in the frame, the middle of its title bar where it is not told: the window follows,
    // its edges landing on those it comes within LAYOUT.SNAP of, never over the host's bar, and is left where its
    // title bar can be reached. A tiled one leaves its tile as it starts to move, at the frame it had before, the
    // pointer held where it grabbed it across the title bar. With the pointer at a side of the zoom area, the tile it
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
        const zoomArea = LAYOUT.zoomedIn(area());
        const others = MANAGER.viewOf(seat)
            .filter(({ id }) => id !== window.id)
            .map(({ frame }) => frame);
        const goes = { ...moving.from, x: moving.from.x + dx, y: moving.from.y + dy };
        const snapped = LAYOUT.snapped(goes, ['top', 'bottom', 'left', 'right'], others, zoomArea);
        const frame = LAYOUT.underBar(snapped, area(), { moved: true });
        const drop = window.bar.enabled.zoom ? LAYOUT.dropAt(moving.pointer, zoomArea) : null;
        handHeld.add(window.id);
        if (phase !== 'ended') {
            hand.dropping = drop;
            MANAGER.setFrame(seat, window.id, frame);
            return update();
        }
        endDrag(seat);
        if (drop) MANAGER.tile(seat, window.id, drop, LAYOUT.tileOf(drop, zoomArea));
        else MANAGER.setFrame(seat, window.id, LAYOUT.kept(frame, area(), window.bar.height));
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
            if (seat === LOCAL) held = null;
        } else holdBack(seat, ids, mod);
        update();
        return true;
    }

    // The seat whose screen `page` is: the desktop's page is the local seat's; null for any other page.
    function seatAt(page) {
        return page && page === desktop.page ? LOCAL : null;
    }

    // What a window's content is told of it: `shown` on some seat's screen with the host window up, `key` some seat's
    // key window while neither an overlay window nor a panel window holds the keyboard, its size, and where its buttons
    // stand over its top; a panel window is key while it holds the keyboard and has no buttons.
    function stateOf(window) {
        if (panels.has(window.id)) {
            const frame = panelFrameOf(window.id);
            const key = held === window.id;
            return { shown, key, width: frame?.width ?? 0, height: frame?.height ?? 0, titleBar: null };
        }
        const frame = MANAGER.frameOf(window.id);
        return {
            shown: shown && MANAGER.isShown(window.id),
            key: MANAGER.isKey(window.id) && !keyboardAway(),
            width: frame?.width ?? 0,
            height: frame?.height ?? 0,
            titleBar: LAYOUT.guideOf(window.bar),
        };
    }

    // Whether the window is the local seat's key window, which an overlay window or a panel window holding the keyboard
    // gives it back to; or the panel window that holds it.
    function isKey(window) {
        if (panels.has(window.id)) return held === window.id;
        return MANAGER.keyOf(LOCAL) === window.id;
    }

    // The panel window that holds the keyboard, or null.
    function keyPanel() {
        return panels.get(held) ?? null;
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
        for (const seat of hands.keys()) {
            const away = seat === LOCAL ? (keyPanel()?.mod ?? WINDOWS.keyOverlay()?.mod) : null;
            ACTIVATION.setActive(seat, away ?? keyWindow(seat)?.mod ?? null);
        }
        // The machine's press on a window another seat holds leaves the machine's keyboard where it is.
        for (const { id, surface } of windows.values()) {
            const kept = ![null, LOCAL].includes(MANAGER.holderOf(id));
            if (!surface || reserved.get(surface) === kept) continue;
            reserved.set(surface, kept);
            reserve(surface, kept);
        }
        layout();
        tellPage();
        const key = keyPanel() ?? keyWindow(LOCAL);
        // A panel window's content may open after it took the keyboard.
        if (key !== focused || (key && key === keyPanel() && !focusedContent && key.surface)) {
            focusedContent = !!key?.surface;
            focused = key;
            if (shown) focus();
        }
        const title = titleOf(keyWindow(LOCAL));
        if (title !== titled) host.desktopTitled((titled = title));
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
        if (hands.has(seat.id)) return;
        MANAGER.addSeat(seat.id);
        ACTIVATION.addSeat(seat.id);
        hands.set(seat.id, { moving: null, dropping: null, pointer: null, down: null, wanted: null });
        update();
    }

    // A seat deckit closed leaves: what it held is no one's.
    function leave(seat) {
        if (seat.id === LOCAL || !hands.has(seat.id)) return;
        endDrag(seat.id);
        MANAGER.removeSeat(seat.id);
        ACTIVATION.removeSeat(seat.id);
        hands.delete(seat.id);
        seated.delete(seat.id);
        for (const [id, by] of pressers) if (by === seat.id) pressers.delete(id);
        update();
    }

    // The seat that pressed the window last, or the one the host window shows where none did.
    function presserOf(window) {
        return pressers.get(window.id) ?? LOCAL;
    }

    // What the machine's devices did, as the environment tells it, in the page it was delivered to: the local seat's
    // input, a pointer's point from the desktop's top left where that page is laid here, and no point where it is not.
    function carried(event) {
        const local = seated.get(LOCAL);
        if (!local) return;
        const { x, y, ...told } = event;
        const rect = event.page ? onDesktop.get(event.page) : { x: 0, y: 0 };
        const at = event.event === 'pointer' && rect ? { x: x + rect.x, y: y + rect.y } : {};
        Promise.resolve(deckit.seats.input(local, { ...told, ...at })).catch((error) =>
            deckit.log.error("the machine's input was not taken", error)
        );
    }

    // The entry, as deckit hands it: what the devices of `seat` did. An event the environment carried is in its page
    // already; any other is read against what is laid for the seat and put in the page it reaches. A pointer answers
    // `{ over, key, holder }`: `over` the window it reached, 'desktop' for the desktop where no window is, or null,
    // and, for a press on a window, `key` 'key' or 'held' and `holder`, the seat that holds its keyboard. A key or
    // text answers `{ to }`, the window it went to, or null where the seat has no key window.
    function entered(seat, event) {
        const hand = hands.get(seat.id);
        if (!hand) throw refusal('NOT_FOUND', 'the seat is not at the desktop');
        if (event.event === 'pointer')
            return event.carried ? arrived(seat.id, hand, event) : pointed(seat.id, hand, event);
        if (event.event === 'key' || event.event === 'text')
            return event.carried ? { to: keyWindow(seat.id)?.id ?? null } : typed(seat.id, event);
        throw refusal('GONE', 'nothing read here has that ref');
    }

    function refusal(kind, message) {
        return Object.assign(new Error(message), { stage: 'call', kind });
    }

    // A pointer event the environment carried: the pointer is there, and a press in a window's page is the seat's
    // press on that window.
    function arrived(seat, hand, event) {
        if (Number.isFinite(event.x)) hand.pointer = { x: event.x, y: event.y };
        const window = event.type === 'down' ? windowAt(event.page) : null;
        if (!window || !windows.has(window.id) || MANAGER.isMinimized(seat, window.id)) return { over: null };
        return reached(seat, window);
    }

    // A pointer event to be carried. A press and a scroll go where `stage.hit` finds a page in what is laid for the
    // seat; a move with a button held and the up that ends it go where the press went. A move with none held moves the
    // seat's pointer alone.
    function pointed(seat, hand, event) {
        const { type } = event;
        const point = { x: event.x, y: event.y };
        if (!['move', 'down', 'up', 'scroll'].includes(type) || ![point.x, point.y].every(Number.isFinite))
            throw refusal('INVALID_ARGUMENT', 'a pointer event is a move, down, up or scroll at a point');
        hand.pointer = point;
        const hit = type === 'move' ? null : stage.hit(laidFor(seat), point);
        if (type === 'move' || type === 'up') {
            const held = hand.down;
            if (!held) return { over: null };
            if (held.part) gesture(seat, type, point, hit && partAt(hit));
            else {
                if (type === 'up') hand.down = null;
                INPUT.put(held.page, { ...event, x: point.x - held.origin.x, y: point.y - held.origin.y }, seat);
            }
            return { over: held.id };
        }
        if (!hit) return { over: null };
        const part = partAt(hit);
        if (part) {
            if (type === 'down') gesture(seat, type, point, part, { count: event.count, button: event.button });
            const made = MANAGER.keyOf(seat) === part.id ? 'key' : 'held';
            return { over: part.id, ...(type === 'down' ? { key: made, holder: MANAGER.holderOf(part.id) } : {}) };
        }
        const window = windowAt(hit.page);
        if (!window) return { over: desktop.page ? 'desktop' : null };
        let answer = { over: window.id };
        if (type === 'down') {
            hand.down = { id: window.id, page: hit.page, origin: { x: point.x - hit.x, y: point.y - hit.y } };
            if (panels.has(window.id)) pressPanel(seat, window);
            else answer = reached(seat, window);
        }
        INPUT.put(hit.page, { ...event, x: hit.x, y: hit.y }, seat);
        return answer;
    }

    // A key or text to be carried: put in the content of the seat's key window. One for a window the seat pressed
    // that another seat still holds is refused HELD.
    function typed(seat, event) {
        const hand = hands.get(seat);
        if (hand.wanted !== null && MANAGER.makeKey(seat, hand.wanted) === WM.HELD)
            throw refusal('HELD', `seat ${MANAGER.holderOf(hand.wanted)} holds the keyboard of window ${hand.wanted}`);
        if (hand.wanted !== null) {
            hand.wanted = null;
            update();
        }
        const key = keyWindow(seat);
        if (!key?.surface) return { to: null };
        ACTIVATION.input(seat, key.mod);
        INPUT.put(key.surface, event, seat);
        return { to: key.id };
    }

    // `seat`'s press on a window, answered as the entry answers it.
    function reached(seat, window) {
        const made = press(seat, window);
        return { over: window.id, key: made === WM.HELD ? 'held' : 'key', holder: MANAGER.holderOf(window.id) };
    }

    // The window or panel window a page is of: its content, a child a region of it shows, a web page in it or an
    // overlay of one; or null.
    function windowAt(page) {
        const owner = OVERLAY.ownerOf(page);
        const held = web.pageFor(owner) ?? owner;
        const child = inWindows.get(held);
        return [...windows.values(), ...panels.values()].find(({ id, surface }) => surface === held || id === child);
    }

    // The part of a window the shell draws that a point of a page is on, `{ id, part }`: 'bar', its title bar, an
    // edge as LAYOUT.resized names it, a button by its name, or 'buttons' between them; null for any other page.
    function partAt({ page, x, y }) {
        const holds = (rect) => x >= rect.x && y >= rect.y && x < rect.x + rect.width && y < rect.y + rect.height;
        for (const [id, { bar }] of windows) {
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
    // drag of an edge resizes it, an up on the button the press was on clicks it, and a 'down' on the title bar that
    // is the second of two, `count` 2, is a double click. A 'down' of another `button` than the first is a press on
    // the window and no more. `point` is in any space that holds still while the button is down, and `grab` where a
    // 'down' is from the frame's top left, read from `point` where it is not told, which holds for a point on the
    // desktop.
    function gesture(seat, type, point, on, { count = 1, button = 0, grab = null } = {}) {
        const hand = hands.get(seat);
        if (!hand) return;
        if (type === 'down') {
            hand.down = null;
            return byHand(seat, on.id, (window) => {
                if (button !== 0) return press(seat, window);
                if (on.part !== 'bar' || count === 2) press(seat, window);
                if (on.part === 'bar' && count === 2) return doubleClick(seat, window);
                const frame = MANAGER.frameOf(on.id);
                hand.down = { ...on, from: point, frame };
                if (on.part === 'bar')
                    move(seat, window, 'began', 0, 0, grab ?? { x: point.x - frame.x, y: point.y - frame.y });
            });
        }
        const held = hand.down;
        const window = held?.part ? windows.get(held.id) : null;
        if (type === 'up') hand.down = null;
        if (!window) return;
        const [dx, dy] = [point.x - held.from.x, point.y - held.from.y];
        const phase = type === 'up' ? 'ended' : 'changed';
        if (held.part === 'bar') return move(seat, window, phase, dx, dy);
        if (held.part === 'buttons' || held.part in window.bar.enabled) {
            if (type === 'up' && on?.id === held.id && on.part === held.part) clicked(seat, window, held.part);
            return;
        }
        const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
        framed(seat, window, phase, LAYOUT.resized(held.frame, held.part, dx, dy, minimum), held.part);
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
            fromPage(({ id, part, type, x, y, button, count, grabX, grabY }) => {
                if (!['down', 'move', 'up'].includes(type)) return;
                const grab = Number.isFinite(grabX) && Number.isFinite(grabY) ? { x: grabX, y: grabY } : null;
                gesture(LOCAL, type, { x, y }, { id, part }, { button, count, grab });
            })
        );
        PROTOCOL.dock.on(
            fromPage(({ out }) => {
                dockOut = out;
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
        const met = sides.length ? LAYOUT.snapped(frame, sides, others, LAYOUT.zoomedIn(area()), minimum) : frame;
        const next = LAYOUT.underBar(met, area(), { moved: false });
        MANAGER.setFrame(seat, window.id, phase === 'ended' ? LAYOUT.kept(next, area(), window.bar.height) : next);
        if (phase === 'ended') {
            handHeld.delete(window.id);
            remember(window);
        } else handHeld.add(window.id);
        update();
    }

    // The normal windows, back to front, each `{ id, mod, name, frame, key, minimized }`, as the host app reads them:
    // none is key while an overlay window or a panel window holds the keyboard.
    function windowsNow() {
        const key = keyboardAway() ? null : MANAGER.keyOf(LOCAL);
        return MANAGER.orderOf(LOCAL).map((id) => {
            const { mod, name } = windows.get(id);
            const minimized = MANAGER.isMinimized(LOCAL, id);
            return { id, mod, name, frame: { ...MANAGER.frameOf(id) }, key: id === key, minimized };
        });
    }

    // The hand of the person at the host window, the local seat's, on the window `id` that windows() answers, as the
    // host app hands it, each gesture whole: a press in it; a click of a button, `close`, `minimize` or `zoom`; a drag
    // of its title bar by `dx`, `dy`; a drag of its edge `edge`, as LAYOUT.resized names one, by `dx`, `dy`; and a
    // double click on its title bar. A window minimized takes none; a panel window takes a press alone.
    const hand = Object.freeze({
        press: (id) =>
            panels.has(id) ? pressPanel(LOCAL, panels.get(id)) : byHand(LOCAL, id, (window) => press(LOCAL, window)),
        button: (id, button) =>
            byHand(LOCAL, id, (window) => {
                press(LOCAL, window);
                clicked(LOCAL, window, button);
            }),
        move: (id, dx, dy) =>
            byHand(LOCAL, id, (window) => {
                move(LOCAL, window, 'began', 0, 0);
                move(LOCAL, window, 'changed', dx, dy);
                move(LOCAL, window, 'ended', dx, dy);
            }),
        resize: (id, edge, dx, dy) =>
            byHand(LOCAL, id, (window) => {
                press(LOCAL, window);
                const minimum = LAYOUT.minimumOf(window.minimum, window.bar);
                const frame = LAYOUT.resized(MANAGER.frameOf(id), edge, dx, dy, minimum);
                framed(LOCAL, window, 'changed', frame, edge);
                framed(LOCAL, window, 'ended', frame, edge);
            }),
        doubleClick: (id) =>
            byHand(LOCAL, id, (window) => {
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

    // The desktop's page is the shell's own, made once: it opens the backdrop, and each window's frame and buttons as
    // the window opens. A press there is the person's on a window, so the keyboard goes back to the key window. It
    // lays out off screen too, and the desktop has no frames without it: a page that crashed is loaded again.
    function makePage() {
        const page = PAGES.open(PAGE.PAGE_NAME, {
            keepsDrawing: true,
            reloadsOnCrash: true,
            surfaces: { names: [PAGE.BACKDROP], onOpen: openSurface },
        });
        KEY.listen(page);
        PAGES.whenFocused(page, giveBack);
        desktop.page = page;
        update();
    }

    // A press on the backdrop, the desktop where no window is, gives the keyboard back to the desktop's key window.
    function openSurface(name, surface) {
        PAGES.whenFocused(surface, name === PAGE.BACKDROP ? toDesktop : giveBack);
        desktop.surfaces.set(name, surface);
        update();
    }

    // A document loaded again in its place finds the surfaces the last one opened, by name, and draws them anew; a
    // page that crashed or went takes them with it, and its next document opens its own.
    function pageEnded({ replaced }) {
        endDrag(LOCAL);
        dockOut = false;
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

    // The seat a key was pressed by, as the environment tells what it was put for: the local one's for the machine's.
    function seatOf(from) {
        return from ?? LOCAL;
    }

    // Where windows go: the stage below the host's bar.
    function area() {
        return LAYOUT.desktopOf(stage.size(), strip.height);
    }

    // The panel windows, in the order they opened, each `{ window, frame }`, its frame at its edge.
    function panelFrames() {
        const opened = [...panels.values()];
        const frames = LAYOUT.panelsIn(
            opened.map(({ edge, size }) => ({ edge, size })),
            { ...stage.size(), bar: strip.height }
        );
        return opened.map((window, at) => ({ window, frame: frames[at] }));
    }

    // Whether an overlay window or a panel window holds the keyboard, away from the desktop's key window.
    function keyboardAway() {
        return held !== null || !!WINDOWS.keyOverlay();
    }

    function panelFrameOf(id) {
        return panelFrames().find(({ window }) => window.id === id)?.frame ?? null;
    }

    // The desktop changed size: a zoomed window fills it again, a tiled one takes its tile in it, and any other is
    // moved where its title bar can be reached, each drawn there at once as the desktop is. A desktop with no room yet,
    // its stage in no window, moves none.
    function resized() {
        const desktopNow = area();
        const zoomArea = LAYOUT.zoomedIn(desktopNow);
        MANAGER.fitZoomed(zoomArea, (name) => LAYOUT.tileOf(name, zoomArea));
        if (desktopNow.width && desktopNow.height) {
            for (const id of windows.keys()) {
                const frame = MANAGER.frameOf(id);
                const kept = LAYOUT.kept(frame, desktopNow, windows.get(id).bar.height);
                const fitted = MANAGER.isZoomed(id) || MANAGER.tileNameOf(id) !== null;
                if (!fitted && (kept.x !== frame.x || kept.y !== frame.y)) MANAGER.setFrame(null, id, kept);
            }
        }
        atOnce = true;
        update();
        atOnce = false;
    }

    // The name of the key window's mod, or the app's while there is none.
    function titleOf(key) {
        const mod = key && MODS.loaded(deckit.mods).find(({ id }) => id === key.mod);
        return mod?.name || deckit.config.name;
    }

    // From the bottom: the mods' pages with a window here, but for a child's another stage shows, the backdrop, each
    // window in the local seat's order with the children its regions show, the materials the desktop's page draws
    // glass over, then that page, taking the pointer only at the host's bar and the Dock, its sliver down the edge and
    // its card while it is out, and the panel windows in that bar with the children their regions show. Over all of
    // it, the overlay of each page laid that shows anything, at its page's rect, or over the whole stage for a panel
    // window's content, so what it presents is not cut to the panel. With deckit's core down the desktop's page alone covers it all.
    function layout() {
        const full = { x: 0, y: 0, ...stage.size() };
        inPanels.clear();
        if (down) {
            stage.lay(OVERLAY.withOverlays([{ page: desktop.page, rect: full }]));
            REGION.show(stage, []);
            return;
        }
        const view = MANAGER.viewOf(LOCAL);
        const { layers, children } = laidOf(view, drawnNow(view));
        for (const { window, page } of children) {
            if (!panels.has(window)) continue;
            inPanels.add(page);
            if (!heard.has(page)) PAGES.whenFocused(page, () => pressPanelChild(page));
            heard.add(page);
        }
        const laid = OVERLAY.withOverlays(layers);
        onDesktop.clear();
        for (const { page, rect } of laid) if (rect) onDesktop.set(page, rect);
        stage.lay(laid);
        REGION.show(stage, shown ? [...new Set(children.map(({ page }) => page))] : []);
    }

    // What is laid of the desktop for a seat, bottom to top, as layout() tells it: `view` the windows on its screen
    // (MANAGER.viewOf) and `seen` what is drawn of each (drawnNow). Answers `{ layers, children }`, `children` those
    // the windows and the panel windows show (childrenIn).
    function laidOf(view, seen) {
        const full = { x: 0, y: 0, ...stage.size() };
        const inBar = panelFrames();
        const children = childrenIn([
            ...seen.filter(({ leaving }) => !leaving),
            ...inBar.map(({ window, frame }) => ({ id: window.id, frame })),
        ]);
        const laidChildren = new Set(children.map(({ page }) => page));
        for (const { window, page } of children) inWindows.set(page, window);
        const front = new Map(); // a mod's page -> the frame of its front window on screen
        for (const { window, frame } of inBar) if (!front.has(window.page)) front.set(window.page, frame);
        for (const { id, frame } of view) front.set(windows.get(id).page, frame);
        const pages = new Set(
            [...windows.values(), ...panels.values()]
                .map(({ page }) => page)
                .filter((page) => !laidChildren.has(page) && !REGION.shownElsewhere(page, stage))
        );
        const surface = (name) => desktop.surfaces.get(name);
        const backdrop = surface(PAGE.BACKDROP);
        return {
            children,
            layers: [
                ...[...pages].map((page) => ({ page, rect: front.get(page) ?? area(), input: [] })),
                ...(backdrop ? [{ page: backdrop, rect: full }] : []),
                ...seen.flatMap(({ id, window, frame, opacity, scale, content, leaving, surfaces }) => {
                    const { bar } = window;
                    const parts = LAYOUT.partsOf(frame, bar);
                    const clip = { ...frame, cornerRadius: LAYOUT.RADIUS };
                    const [frameSurface, buttons] = surfaces ?? [
                        surface(PAGE.frameOf(id)),
                        surface(PAGE.buttonsOf(id)),
                    ];
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
                ...glass,
                {
                    page: desktop.page,
                    rect: full,
                    input: [
                        ...(strip.height ? [{ x: 0, y: 0, width: full.width, height: strip.height }] : []),
                        ...DOCK_MODEL.inputOf(area(), dockOut, DOCK.items()),
                    ],
                },
                ...inBar.flatMap(({ window, frame }) => {
                    const clip = { ...frame, cornerRadius: LAYOUT.panelRadius(window.edge, frame) };
                    return [
                        window.surface && { page: window.surface, rect: frame, clip, spread: full },
                        ...children
                            .filter(({ window: holder }) => holder === window.id)
                            .map(({ page, rect }) => ({ page, rect, clip })),
                    ].filter(Boolean);
                }),
            ],
        };
    }

    // What is laid of the desktop for `seat`, each window where it rests in the seat's order: what a press of the
    // seat's pointer is read against (`stage.hit`).
    function laidFor(seat) {
        const view = MANAGER.viewOf(seat);
        const seen = view.map(({ id, frame }) => ({
            id,
            window: windows.get(id),
            frame,
            opacity: 1,
            scale: null,
            content: frame,
            leaving: null,
        }));
        return OVERLAY.withOverlays(laidOf(view, seen).layers);
    }

    // What is drawn of each window on the local seat's screen, `view` as MANAGER.viewOf has it: back to front, each
    // `{ id, window, frame, opacity, scale, content, leaving, surfaces }`, `frame` where its frame is laid, `opacity`
    // how much of it shows, `scale` how all of it is drawn scaled where it is, `content` the frame its content is laid
    // at, its own, from the frame's top left and cut to it; a window going into its Dock tile or closing comes after
    // them, in front, `leaving`, until it is gone, with the `surfaces` its frame and buttons are drawn in. Each frame is
    // drawn by its motion to where the window is: one the hand moves or resizes, and every one as the desktop changes
    // size, there at once; any other by the `move` spring from where it is drawn, its speed carried over, its frame
    // moving and its content at its own size. One opening, closing, going into its Dock tile or coming out of it is
    // laid whole at its frame and drawn scaled, content and all: opening from a little smaller about its middle,
    // faded out, closing back so, going into its Dock tile and coming out of it from there. While the system asks for
    // reduced motion each rect is there at once, opening, closing, going into the Dock and coming out of it fading
    // alone.
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
        return DOCK_MODEL.tileOf(area(), DOCK.items(), window.mod);
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

    // The Dock's items as the desktop's page draws them, `{ id, pinned, running, attention, active }`: `attention`
    // where the mod asks for the local seat's attention, and `active` for the mod of the desktop's key window.
    function dockNow() {
        const { items, active, attention } = stateOfPage().dock;
        return items.map(({ id, pinned, running }) => ({
            id,
            pinned,
            running,
            attention: attention.includes(id),
            active: id === active,
        }));
    }

    // `{ windows, panels, drop, strip, dock, down }`, as the desktop's page draws it. A window's frame is key as its
    // content is (stateOf): not while an overlay window holds the keyboard, which update() tells as it takes or gives
    // it back.
    function stateOfPage() {
        const key = MANAGER.keyOf(LOCAL);
        const { moving, dropping } = hands.get(LOCAL) ?? {};
        const active = windows.get(key)?.mod ?? null;
        return {
            windows: MANAGER.viewOf(LOCAL).map(({ id, frame }) => ({
                id,
                frame,
                key: id === key && !keyboardAway(),
                bar: windows.get(id).bar,
                title: isTitled(windows.get(id)) ? windows.get(id).title : null,
            })),
            panels: panelFrames().map(({ window, frame }) => ({ id: window.id, edge: window.edge, frame })),
            drop:
                moving && dropping ? { tile: dropping, frame: LAYOUT.tileOf(dropping, LAYOUT.zoomedIn(area())) } : null,
            strip,
            dock: { items: DOCK.items(), active, attention: ACTIVATION.attentionOf(LOCAL) },
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
    // there is none.
    function focus() {
        const page = (!down && (keyPanel() ?? keyWindow(LOCAL))?.surface) || desktop.page;
        if (page) PAGES.focus(page);
    }

    // A press on the desktop's page or one of its surfaces leaves the keyboard with the key window, or with the panel
    // window that holds it.
    function giveBack() {
        const content = !down && (keyPanel() ?? keyWindow(LOCAL))?.surface;
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
    // by the machine's keyboard: the desktop takes it in its own pages while it is shown, for that seat.
    function pressKey(id, pressedIn, from) {
        const seat = seatOf(from);
        if (!shown || !pageOf(pressedIn) || !hands.has(seat)) return false;
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
        openPanel,
        closePanel,
        orderFrontPanel,
        toDesktop,
        keyPanel,
        keptFrameOf,
        remember,
        keepsFramesOf,
        forgetFramesOf,
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
        seatAt,
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
            // The panel windows, in the order they opened, each `{ id, mod, name, edge, frame, key }`.
            panels: () =>
                panelFrames().map(({ window: { id, mod, name, edge }, frame }) => ({
                    id,
                    mod,
                    name,
                    edge,
                    frame,
                    key: held === id,
                })),
            dock: dockNow,
            hand,
            // The local seat's active mod, by its id, or null, and the mods that ask for its attention, in the order
            // they first asked: what a host app shows of them.
            active: () => ACTIVATION.activeOf(LOCAL),
            attention: () => ACTIVATION.attentionOf(LOCAL),
        },
    };
}
