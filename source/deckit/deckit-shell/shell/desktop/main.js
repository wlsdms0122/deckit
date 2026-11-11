import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as WM from './model/window-manager.js';
import * as ACTIVATION_MODEL from './model/activation.js';
import * as DOCK_MODEL from '../dock/model/dock.js';
import * as TOKEN from '../../../deckit-sdk/shell/ui/token/index.js';
import * as MODS from '../mods/index.js';

// `deckit` is what connect answered, `state` the shell's own state, `web` what the web engine answered (`pageFor`),
// `host` the app's answers, `REGION` the regions mods give their children, `PAGES` the shell's pages, `OVERLAY` their
// overlays, `KEY` the keys of the app, `makeStage()` a stage to lay them on (environment: SHELL.stage) and
// `actionOnDoubleClick()` what the person set a double click on a title bar to do (environment: SHELL).
export function createDesktop({
    REGION,
    PAGES,
    OVERLAY,
    KEY,
    makeStage,
    actionOnDoubleClick,
    deckit,
    state: STATE,
    web,
    host,
}) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const FRAMES = 'window-frames';
    // The seat at the host window: the person at this machine.
    const LOCAL = 'local';
    const MANAGER = WM.createWindowManager();
    const ACTIVATION = ACTIVATION_MODEL.createActivation();
    // What each of the shell's keys does, by its id, to the local seat's key window.
    const KEY_ACTIONS = Object.freeze({
        closeWindow: () => keyWindow() && WINDOWS.close(keyWindow()),
        minimizeWindow: () => keyWindow() && minimize(keyWindow()),
        cycleWindows,
    });
    // Which mods may activate for a seat, as its input and the requests mods make of one another hand it on.
    const activation = Object.freeze({
        input: ACTIVATION.input,
        request: ACTIVATION.request,
        mayActivate: ACTIVATION.mayActivate,
    });
    const windows = new Map(); // id -> a normal window, as WINDOWS made it, while it is open
    const listeners = new Set();
    // The desktop's page, the documents it opened by name, and what it was last told.
    const desktop = { page: null, surfaces: new Map(), sent: '' };
    let WINDOWS = null;
    let DOCK = null;
    let stage = null; // where the pages are laid, which the host app places
    let frames = {}; // mod id -> window name -> the frame it was left at, `{ level, x, y, width, height }`
    let moving = null; // { id, from }: the window its content's drag moves, from the frame it had at the press
    let focused = null; // the key window the keyboard was last given to
    let shown = false;
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let strip = { height: 0, controlsWidth: 0 }; // the host's bar over the desktop's top
    let dockOut = false; // whether the Dock is out, as the desktop's page last told

    // MARK: - Initializer
    // MARK: - Public
    // The desktop in the host window, the local seat's view of it: the backdrop, the normal windows `WINDOWS` opens in
    // the seat's order, each its content between the frame under it and the buttons over it with the children its
    // regions show, and the Dock and the host's bar over them, `DOCK` giving the Dock's items. Each mod's page with a
    // window there is laid under the backdrop, at its front window, so what its overlay draws for a window lands over
    // that window. The machine's keyboard is the local seat's: a key pressed in a page reaches the mod whose page it
    // is, a chord the mod that took it.
    function start(given) {
        WINDOWS = given.WINDOWS;
        DOCK = given.DOCK;
        frames = STATE.read(FRAMES, {});
        MANAGER.addSeat(LOCAL);
        ACTIVATION.addSeat(LOCAL);
        deckit.mods.onRequest(({ from, to }) => ACTIVATION.request(from, to));
        KEY.monitor((page) => {
            ACTIVATION.input(LOCAL, modAt(page));
            return false;
        });
        KEY.onChord((mod) => ACTIVATION.input(LOCAL, mod));
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

    // A normal window opens where its mod last left a normal window of its name, or cascaded from the key window where
    // it left none or one of that name is open, brought forward as orderFront brings it. A window with a `title` is
    // titled: the shell draws its title bar, holding the title, over its content.
    function open(window, { activates = true } = {}) {
        const desktopNow = area();
        const after = keyWindow() && MANAGER.frameOf(keyWindow().id);
        const twin = [...windows.values()].some(({ mod, name }) => mod === window.mod && name === window.name);
        const restored = (!twin && keptFrameOf(window)) || null;
        const size = LAYOUT.framedSize(window.size, isTitled(window));
        const frame = LAYOUT.placed({ size, restored, after, desktop: desktopNow });
        windows.set(window.id, window);
        for (const name of [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)])
            PAGES.allowSurface(desktop.page, name, (surface) => openSurface(name, surface));
        MANAGER.open(LOCAL, window.id, { frame, minimum: LAYOUT.minimumOf(window.minimum) });
        orderFront(window, { activates });
    }

    // A mod left with no window open asks for no seat's attention.
    function close(window) {
        if (!windows.delete(window.id)) return;
        MANAGER.close(LOCAL, window.id);
        if (![...windows.values()].some(({ mod }) => mod === window.mod)) ACTIVATION.cancelAttention(window.mod);
        if (moving?.id === window.id) moving = null;
        for (const name of [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)]) {
            const surface = desktop.surfaces.get(name);
            desktop.surfaces.delete(name);
            if (surface) PAGES.close(surface);
        }
        update();
    }

    // Brought forward for the local seat as its mod asks: where the mod may activate for the seat, in front, and the
    // key window with the host window coming up unless `activates` is false; where it may not, right behind the key
    // window, not key, its mod asking for the seat's attention unless `activates` is false, or in front where the seat
    // has no key window to hold it behind.
    function orderFront(window, { activates = true } = {}) {
        if (!windows.has(window.id)) return;
        const may = ACTIVATION.mayActivate(LOCAL, window.mod);
        if (may) MANAGER.orderFront(LOCAL, window.id, { activates });
        else holdBack(LOCAL, [window.id], window.mod, { activates });
        update();
        if (may && activates) host.show();
    }

    // The local seat pressed in the window, on its frame or in its content: its input reached the window's mod, and
    // the window comes in front as its key window.
    function press(window) {
        if (!windows.has(window.id)) return;
        ACTIVATION.input(LOCAL, window.mod);
        MANAGER.orderFront(LOCAL, window.id);
        update();
    }

    function minimize(window) {
        MANAGER.minimize(LOCAL, window.id);
        update();
    }

    function zoom(window) {
        MANAGER.zoom(LOCAL, window.id, LAYOUT.zoomedIn(area()));
        update();
    }

    function resize(window, { width, height }) {
        const frame = MANAGER.frameOf(window.id);
        if (!frame) return;
        MANAGER.setFrame(LOCAL, window.id, { ...frame, width, height });
        remember(window);
        update();
    }

    // A drag of the content's drag regions, or of the title bar of a titled window, `dx`, `dy` from the press: the
    // window follows, and is left where its title bar can be reached.
    function move(window, phase, dx, dy) {
        if (phase === 'began') {
            moving = { id: window.id, from: MANAGER.frameOf(window.id) };
            press(window);
            return;
        }
        if (moving?.id !== window.id) return;
        const frame = { ...moving.from, x: moving.from.x + dx, y: moving.from.y + dy };
        MANAGER.setFrame(LOCAL, window.id, phase === 'ended' ? LAYOUT.kept(frame, area()) : frame);
        if (phase === 'ended') {
            moving = null;
            remember(window);
        }
        update();
    }

    // A double click on the title bar does what the person set it to.
    function doubleClick(window) {
        const action = actionOnDoubleClick();
        if (action === 'zoom') zoom(window);
        else if (action === 'minimize') minimize(window);
    }

    // Each of the mod's windows brought forward for `seat`, in the order it had them, those it minimized too, as
    // orderFront brings one: in front, the front one key, where the mod may activate for the seat. Answers whether
    // the mod has any.
    function activate(seat, mod) {
        const ids = MANAGER.orderOf(seat).filter((id) => windows.get(id).mod === mod);
        if (!ids.length) return false;
        if (ACTIVATION.mayActivate(seat, mod)) for (const id of ids) MANAGER.orderFront(seat, id);
        else holdBack(seat, ids, mod);
        update();
        return true;
    }

    // The seat whose screen `page` is: the desktop's page is the local seat's; null for any other page.
    function seatAt(page) {
        return page && page === desktop.page ? LOCAL : null;
    }

    // What a window's content is told of it: `shown` on some seat's screen with the host window up, `key` some seat's
    // key window, its size, and where its buttons stand over its top.
    function stateOf(window) {
        const frame = MANAGER.frameOf(window.id);
        return {
            shown: shown && MANAGER.isShown(window.id),
            key: MANAGER.isKey(window.id),
            width: frame?.width ?? 0,
            height: frame?.height ?? 0,
            titleBar: { ...LAYOUT.TITLE_BAR },
        };
    }

    // Whether the window is the local seat's key window.
    function isKey(window) {
        return MANAGER.keyOf(LOCAL) === window.id;
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
        ACTIVATION.setActive(LOCAL, WINDOWS.keyOverlay()?.mod ?? keyWindow()?.mod ?? null);
        layout();
        tellPage();
        const key = keyWindow();
        if (key !== focused) {
            focused = key;
            if (shown) focus();
        }
        const title = titleOf(key);
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

    // The desktop's page draws alone, so what it tells is the person's: no mod's code runs there. What it tells of a
    // window is the local seat's input, which reaches that window's mod.
    function listen() {
        const fromPage = (handler) => (payload, sender) => sender === desktop.page && handler(payload);
        const known = (handler) => fromPage(({ id, ...payload }) => byHand(id, (window) => handler(window, payload)));
        PROTOCOL.setup.handle((_payload, sender) => {
            if (sender !== desktop.page)
                throw Object.assign(new Error("only the desktop's page asks this"), { stage: 'call', kind: 'REFUSED' });
            deckit.pages.whenEnds(sender, pageEnded);
            const state = stateOfPage();
            desktop.sent = JSON.stringify(state);
            return { glass: TOKEN.GLASS, state };
        });
        PROTOCOL.press.on(known(press));
        PROTOCOL.button.on(known((window, { button }) => clicked(window, button)));
        PROTOCOL.resize.on(known((window, { phase, ...frame }) => framed(window, phase, frame)));
        PROTOCOL.move.on(known((window, { phase, dx, dy }) => move(window, phase, dx, dy)));
        PROTOCOL.doubleClick.on(known(doubleClick));
        PROTOCOL.dock.on(
            fromPage(({ out }) => {
                dockOut = out;
                layout();
            })
        );
        PROTOCOL.restart.on(fromPage(() => down && deckit.restart()));
    }

    // The local seat's input on a window on its screen, which reaches the window's mod.
    function byHand(id, handler) {
        const window = windows.get(id);
        if (!window || MANAGER.isMinimized(LOCAL, id)) return;
        ACTIVATION.input(LOCAL, window.mod);
        handler(window);
    }

    function clicked(window, button) {
        if (button === 'close') WINDOWS.close(window);
        else if (button === 'minimize') minimize(window);
        else if (button === 'zoom') zoom(window);
    }

    // The frame a drag of an edge draws, kept where its title bar can be reached and remembered as the drag ends.
    function framed(window, phase, frame) {
        const { x, y, width, height } = frame;
        const next = { x, y, width, height };
        MANAGER.setFrame(LOCAL, window.id, phase === 'ended' ? LAYOUT.kept(next, area()) : next);
        if (phase === 'ended') remember(window);
        update();
    }

    // The normal windows, back to front, each `{ id, mod, name, frame, key, minimized }`, as the host app reads them.
    function windowsNow() {
        const key = MANAGER.keyOf(LOCAL);
        return MANAGER.orderOf(LOCAL).map((id) => {
            const { mod, name } = windows.get(id);
            const minimized = MANAGER.isMinimized(LOCAL, id);
            return { id, mod, name, frame: { ...MANAGER.frameOf(id) }, key: id === key, minimized };
        });
    }

    // A person's hand on the window `id` that windows() answers, as the host app hands it, each gesture whole, as the
    // desktop's page tells it: a press in it, a click of a button, `close`, `minimize` or `zoom`; a drag of its title bar by `dx`,
    // `dy`; a drag of its edge `edge`, as LAYOUT.resized names one, by `dx`, `dy`; and a double click on its title
    // bar. A window minimized takes none.
    const hand = Object.freeze({
        press: (id) => byHand(id, press),
        button: (id, button) =>
            byHand(id, (window) => {
                press(window);
                clicked(window, button);
            }),
        move: (id, dx, dy) =>
            byHand(id, (window) => {
                move(window, 'began', 0, 0);
                move(window, 'changed', dx, dy);
                move(window, 'ended', dx, dy);
            }),
        resize: (id, edge, dx, dy) =>
            byHand(id, (window) => {
                press(window);
                const minimum = LAYOUT.minimumOf(window.minimum);
                const frame = LAYOUT.resized(MANAGER.frameOf(id), edge, dx, dy, minimum);
                framed(window, 'changed', frame);
                framed(window, 'ended', frame);
            }),
        doubleClick: (id) =>
            byHand(id, (window) => {
                press(window);
                doubleClick(window);
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

    function openSurface(name, surface) {
        PAGES.whenFocused(surface, giveBack);
        desktop.surfaces.set(name, surface);
        update();
    }

    // A document loaded again in its place finds the surfaces the last one opened, by name, and draws them anew; a
    // page that crashed or went takes them with it, and its next document opens its own.
    function pageEnded({ replaced }) {
        moving = null;
        dockOut = false;
        if (replaced) return;
        const dropped = [...desktop.surfaces.values()];
        desktop.surfaces.clear();
        layout();
        for (const surface of dropped) PAGES.close(surface);
    }

    function isTitled(window) {
        return typeof window.title === 'string';
    }

    // The mod whose page a page of the app is, the content of its window, a web page it shows or an overlay of one,
    // or null.
    function modAt(page) {
        const owner = OVERLAY.ownerOf(page);
        return deckit.mods.modOf(WINDOWS.pageOf(web.pageFor(owner) ?? owner));
    }

    // The local seat's key window, or null.
    function keyWindow() {
        return windows.get(MANAGER.keyOf(LOCAL)) ?? null;
    }

    // Where windows go: the stage below the host's bar.
    function area() {
        return LAYOUT.desktopOf(stage.size(), strip.height);
    }

    // The desktop changed size: a zoomed window fills it again, and any other is moved where its title bar can be
    // reached. A desktop with no room yet, its stage in no window, moves none.
    function resized() {
        const desktopNow = area();
        MANAGER.fitZoomed(LAYOUT.zoomedIn(desktopNow));
        if (desktopNow.width && desktopNow.height) {
            for (const id of windows.keys()) {
                const frame = MANAGER.frameOf(id);
                const kept = LAYOUT.kept(frame, desktopNow);
                if (!MANAGER.isZoomed(id) && (kept.x !== frame.x || kept.y !== frame.y))
                    MANAGER.setFrame(LOCAL, id, kept);
            }
        }
        update();
    }

    // The name of the key window's mod, or the app's while there is none.
    function titleOf(key) {
        const mod = key && MODS.loaded(deckit.mods).find(({ id }) => id === key.mod);
        return mod?.name || deckit.config.name;
    }

    // From the bottom: the mods' pages with a window here, the backdrop, each window in the local seat's order with
    // the children its regions show, then the desktop's page, taking the pointer only at the host's bar and the Dock,
    // its sliver or all of it while it is out. Over all of it, the overlay of each page laid that shows anything, at
    // its page's rect. With deckit's core down the desktop's page alone covers it all.
    function layout() {
        const full = { x: 0, y: 0, ...stage.size() };
        if (down) {
            stage.lay(OVERLAY.withOverlays([{ page: desktop.page, rect: full }]));
            REGION.show([]);
            return;
        }
        const view = MANAGER.viewOf(LOCAL);
        const children = childrenIn(view);
        const laidChildren = new Set(children.map(({ page }) => page));
        const front = new Map(); // a mod's page -> the frame of its front window on screen
        for (const { id, frame } of view) front.set(windows.get(id).page, frame);
        const pages = new Set([...windows.values()].map(({ page }) => page).filter((page) => !laidChildren.has(page)));
        const surface = (name) => desktop.surfaces.get(name);
        const backdrop = surface(PAGE.BACKDROP);
        stage.lay(
            OVERLAY.withOverlays([
                ...[...pages].map((page) => ({ page, rect: front.get(page) ?? area(), input: [] })),
                ...(backdrop ? [{ page: backdrop, rect: full }] : []),
                ...view.flatMap(({ id, frame }) => {
                    const window = windows.get(id);
                    const titled = isTitled(window);
                    const parts = LAYOUT.partsOf(frame);
                    const clip = { ...frame, cornerRadius: LAYOUT.RADIUS };
                    return [
                        surface(PAGE.frameOf(id)) && {
                            page: surface(PAGE.frameOf(id)),
                            rect: parts.rect,
                            input: [
                                ...parts.edges.map(({ rect }) => rect),
                                ...(titled ? [LAYOUT.titleBarOf(frame)] : []),
                            ],
                        },
                        window.surface && { page: window.surface, rect: LAYOUT.contentOf(frame, titled), clip },
                        ...children
                            .filter(({ window }) => window === id)
                            .map(({ page, rect }) => ({ page, rect, clip })),
                        surface(PAGE.buttonsOf(id)) && {
                            page: surface(PAGE.buttonsOf(id)),
                            rect: parts.buttons,
                            input: buttonRects(),
                        },
                    ].filter(Boolean);
                }),
                {
                    page: desktop.page,
                    rect: full,
                    input: [
                        ...(strip.height ? [{ x: 0, y: 0, width: full.width, height: strip.height }] : []),
                        DOCK_MODEL.rectOf(area(), dockOut),
                    ],
                },
            ])
        );
        REGION.show(shown ? [...laidChildren] : []);
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
        const parents = new Set(view.map(({ id }) => windows.get(id).mod));
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

    // Where the buttons take presses in their surface: between them a press is the title bar's, under them.
    function buttonRects() {
        const { size, gap, inset } = LAYOUT.BUTTON;
        const y = Math.round((LAYOUT.TITLE_BAR.height - size) / 2);
        return LAYOUT.BUTTONS.map((_button, at) => ({ x: inset + at * (size + gap), y, width: size, height: size }));
    }

    // `{ windows, strip, title, dock, down }`, as the desktop's page draws it.
    function stateOfPage() {
        const key = MANAGER.keyOf(LOCAL);
        const active = windows.get(key)?.mod ?? null;
        return {
            windows: MANAGER.viewOf(LOCAL).map(({ id, frame }) => ({
                id,
                frame,
                key: id === key,
                minimum: LAYOUT.minimumOf(windows.get(id).minimum),
                title: isTitled(windows.get(id)) ? windows.get(id).title : null,
            })),
            strip,
            title: titleOf(windows.get(key)),
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

    // The keyboard is the key window's content's, or the desktop page's while there is none.
    function focus() {
        const page = (!down && keyWindow()?.surface) || desktop.page;
        if (page) PAGES.focus(page);
    }

    // A press on the desktop's page or one of its surfaces leaves the keyboard with the key window.
    function giveBack() {
        const content = !down && keyWindow()?.surface;
        if (content) PAGES.focus(content);
    }

    // What a page of the app is to the desktop: the desktop's page, for it or a surface it opened; the mod's page, for
    // the content of a window here, a mod's page with a window here, a web page in either or the overlay of one; or
    // null.
    function pageOf(given) {
        const owner = OVERLAY.ownerOf(given);
        if (owner === desktop.page || [...desktop.surfaces.values()].includes(owner)) return desktop.page;
        const held = web.pageFor(owner) ?? owner;
        return [...windows.values()].find(({ surface, page }) => surface === held || page === held)?.page ?? null;
    }

    // Whether a keystroke or a request in this page is the desktop's.
    function contains(page) {
        return !!pageOf(page);
    }

    // A press of the shell's key `id` in a page of the app that the page did not handle: the desktop takes it in its
    // own pages while it is shown.
    function pressKey(id, pressedIn) {
        if (!shown || !pageOf(pressedIn)) return false;
        KEY_ACTIONS[id]();
        return true;
    }

    // The back-most of the active mod's windows on screen comes in front.
    function cycleWindows() {
        const key = keyWindow();
        if (!key) return;
        const ids = MANAGER.orderOf(LOCAL).filter(
            (id) => windows.get(id).mod === key.mod && !MANAGER.isMinimized(LOCAL, id)
        );
        if (ids.length <= 1) return;
        MANAGER.orderFront(LOCAL, ids[0]);
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
        keptFrameOf,
        remember,
        keepsFramesOf,
        forgetFramesOf,
        open,
        close,
        orderFront,
        press,
        minimize,
        zoom,
        resize,
        move,
        doubleClick,
        activate,
        activation,
        setTitle,
        seatAt,
        // The seat at the host window, the one seat the host gives: what a mod asks is done by it.
        localSeat: LOCAL,
        stateOf,
        isKey,
        onChange,
        update,
        // What the host drives of it.
        control: {
            glass: TOKEN.GLASS,
            // Into one of the host app's windows, as a stage is placed (`bounds`, `onClose`).
            place: (window, options) => stage.place(window, options),
            contains,
            show,
            hide,
            focus,
            present,
            shown: () => shown,
            windows: windowsNow,
            hand,
        },
    };
}
