import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as WM from './model/window-manager.js';
import * as TOKEN from '../ui/token/index.js';
import * as MODS from '../mods/index.js';
import { createKey } from '../key/main.js';

// `deckit` is what connect answered, `host` the app's answers, `REGION` the regions mods give their children, `PAGES`
// the shell's pages, `OVERLAY` their overlays, `makeStage()` a stage to lay them on (environment: SHELL.stage) and
// `actionOnDoubleClick()` what the person set a double click on a title bar to do (environment: SHELL).
export function createDesktop({ REGION, PAGES, OVERLAY, makeStage, actionOnDoubleClick, deckit, host }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const FRAMES = 'window-frames';
    // The seat at the host window: the person at this machine.
    const LOCAL = 'local';
    const MANAGER = WM.createWindowManager();
    const KEY = createKey({ deckit });
    // What each of the shell's keys does, by its id, to the local seat's key window.
    const KEY_ACTIONS = Object.freeze({
        closeWindow: () => keyWindow() && WINDOWS.close(keyWindow()),
        minimizeWindow: () => keyWindow() && minimize(keyWindow()),
        cycleWindows,
    });
    const windows = new Map(); // id -> a normal window, as WINDOWS made it, while it is open
    const listeners = new Set();
    // The desktop's page, the documents it opened by name, and what it was last told.
    const desktop = { page: null, surfaces: new Map(), sent: '' };
    let WINDOWS = null;
    let stage = null; // where the pages are laid, which the host app places
    let frames = {}; // mod id -> window name -> the frame it was left at
    let moving = null; // { id, from }: the window its content's drag moves, from the frame it had at the press
    let focused = null; // the key window the keyboard was last given to
    let shown = false;
    let titled = null; // the title the host was last told
    let down = null; // why deckit's core answers nothing more, once it does not
    let strip = 0; // how tall the host's bar is over the desktop's top

    // MARK: - Initializer
    // MARK: - Public
    // The desktop in the host window, the local seat's view of it: the backdrop, the normal windows `WINDOWS` opens in
    // the seat's order, each its content between the frame under it and the buttons over it with the children its
    // regions show, and the host's bar over the top. Each mod's page with a window there is laid under the backdrop,
    // at its front window, so what its overlay draws for a window lands over that window.
    function start(given) {
        WINDOWS = given.WINDOWS;
        frames = deckit.state.read(FRAMES, {});
        MANAGER.addSeat(LOCAL);
        KEY.start(pressKey);
        stage = makeStage();
        stage.whenResized(update);
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

    // A normal window opens where it was last left, or cascaded from the key window, in front and the key window.
    function open(window) {
        const desktopNow = area();
        const after = keyWindow() && MANAGER.frameOf(keyWindow().id);
        const restored = frames[window.mod]?.[window.name] ?? null;
        const frame = LAYOUT.placed({ size: window.size, restored, after, desktop: desktopNow });
        windows.set(window.id, window);
        for (const name of [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)])
            PAGES.allowSurface(desktop.page, name, (surface) => openSurface(name, surface));
        MANAGER.open(LOCAL, window.id, { frame, minimum: LAYOUT.minimumOf(window.minimum) });
        update();
    }

    function close(window) {
        if (!windows.delete(window.id)) return;
        MANAGER.close(LOCAL, window.id);
        if (moving?.id === window.id) moving = null;
        for (const name of [PAGE.frameOf(window.id), PAGE.buttonsOf(window.id)]) {
            const surface = desktop.surfaces.get(name);
            desktop.surfaces.delete(name);
            if (surface) PAGES.close(surface);
        }
        update();
    }

    // In front and the key window; `activates` brings the host window up too.
    function orderFront(window, { activates = false } = {}) {
        if (!windows.has(window.id)) return;
        MANAGER.orderFront(LOCAL, window.id);
        update();
        if (activates) host.show();
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

    // A drag of the content's drag regions, `dx`, `dy` from the press: the window follows, and is left where its title
    // bar can be reached.
    function move(window, phase, dx, dy) {
        if (phase === 'began') {
            moving = { id: window.id, from: MANAGER.frameOf(window.id) };
            orderFront(window);
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

    // Each of the mod's windows in front, in the order the local seat had them, minimized ones too, the front one key:
    // answers whether it has any.
    function activate(mod) {
        const ids = MANAGER.orderOf(LOCAL).filter((id) => windows.get(id).mod === mod);
        for (const id of ids) MANAGER.orderFront(LOCAL, id);
        if (ids.length) update();
        return ids.length > 0;
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

    // Hears each change to the windows: answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // Laid again, the desktop's page told, the keyboard given to a new key window, the host's title and each listener.
    function update() {
        if (!stage) return;
        layout();
        tellPage();
        const key = keyWindow();
        if (key !== focused) {
            focused = key;
            if (shown) focus();
        }
        const mod = key && MODS.loaded(deckit.mods).find(({ id }) => id === key.mod);
        const title = mod?.name || deckit.config.name;
        if (title !== titled) host.panelTitled((titled = title));
        for (const listener of [...listeners]) listener();
    }

    // MARK: - Private
    // What the shell keeps between runs, as the person left it. The desktop goes on with it whether deckit keeps it or
    // refuses the write, as it does state it did not read; deckit logs why it refused.
    function keep(key, value) {
        deckit.state.write(key, value).catch(() => {});
    }

    // The frame the window was left at, by its mod and its name: zoomed, the one zoom left.
    function remember(window) {
        const frame = MANAGER.standardFrameOf(window.id);
        frames = { ...frames, [window.mod]: { ...frames[window.mod], [window.name]: frame } };
        keep(FRAMES, frames);
    }

    // The desktop's page draws alone, so what it tells is the person's: no mod's code runs there.
    function listen() {
        const fromPage = (handler) => (payload, sender) => sender === desktop.page && handler(payload);
        const known = (handler) =>
            fromPage(({ id, ...payload }) => windows.has(id) && handler(windows.get(id), payload));
        PROTOCOL.setup.handle((_payload, sender) => {
            if (sender !== desktop.page)
                throw Object.assign(new Error("only the desktop's page asks this"), { kind: 'REFUSED' });
            deckit.pages.whenEnds(sender, pageEnded);
            const state = stateOfPage();
            desktop.sent = JSON.stringify(state);
            return { glass: TOKEN.GLASS, state };
        });
        PROTOCOL.press.on(known((window) => orderFront(window)));
        PROTOCOL.button.on(
            known((window, { button }) => {
                if (button === 'close') WINDOWS.close(window);
                else if (button === 'minimize') minimize(window);
                else if (button === 'zoom') zoom(window);
            })
        );
        PROTOCOL.resize.on(
            known((window, { phase, x, y, width, height }) => {
                const frame = { x, y, width, height };
                MANAGER.setFrame(LOCAL, window.id, phase === 'ended' ? LAYOUT.kept(frame, area()) : frame);
                if (phase === 'ended') remember(window);
                update();
            })
        );
        PROTOCOL.restart.on(fromPage(() => down && deckit.restart()));
    }

    // The desktop's page is the shell's own, made once: it opens the backdrop, and each window's frame and buttons as
    // the window opens. A press there is the person's on a window, so the keyboard goes back to the key window. It
    // lays out off screen too, and the desktop has no frames without it: a page that crashed is loaded again.
    function makePage() {
        const page = PAGES.open(PAGE.PAGE_NAME, {
            keepsDrawing: true,
            reloadsOnCrash: true,
            surfaces: { names: [PAGE.BACKDROP], onOpen: openSurface },
        });
        deckit.keymap.listen(page);
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
        if (replaced) return;
        const dropped = [...desktop.surfaces.values()];
        desktop.surfaces.clear();
        layout();
        for (const surface of dropped) PAGES.close(surface);
    }

    // The local seat's key window, or null.
    function keyWindow() {
        return windows.get(MANAGER.keyOf(LOCAL)) ?? null;
    }

    // Where windows go: the stage below the host's bar.
    function area() {
        return LAYOUT.desktopOf(stage.size(), strip);
    }

    // From the bottom: the mods' pages with a window here, the backdrop, each window in the local seat's order with
    // the children its regions show, then the desktop's page, taking the pointer only at the host's bar. Over all of
    // it, the overlay of each page laid that shows anything, at its page's rect. With deckit's core down the desktop's
    // page alone covers it all.
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
                    const { surface: content } = windows.get(id);
                    const parts = LAYOUT.partsOf(frame);
                    const clip = { ...frame, cornerRadius: LAYOUT.RADIUS };
                    return [
                        surface(PAGE.frameOf(id)) && {
                            page: surface(PAGE.frameOf(id)),
                            rect: parts.rect,
                            input: parts.edges.map(({ rect }) => rect),
                        },
                        content && { page: content, rect: frame, clip },
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
                    input: strip ? [{ x: 0, y: 0, width: full.width, height: strip }] : [],
                },
            ])
        );
        REGION.show(shown ? [...laidChildren] : []);
    }

    // `[{ window, page, rect }]`: the children the windows on screen show in their regions, each page on the stage.
    function childrenIn(view) {
        const pageOf = new Map(deckit.mods.runs().map(({ run, page }) => [run.mod.id, page]));
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

    // `{ windows, strip, down }`, as the desktop's page draws it.
    function stateOfPage() {
        const key = MANAGER.keyOf(LOCAL);
        return {
            windows: MANAGER.viewOf(LOCAL).map(({ id, frame }) => ({
                id,
                frame,
                key: id === key,
                minimum: LAYOUT.minimumOf(windows.get(id).minimum),
            })),
            strip,
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
        const held = deckit.web.pageFor(owner) ?? owner;
        return [...windows.values()].find(({ surface, page }) => surface === held || page === held)?.page ?? null;
    }

    // Whether a keystroke or a request in this page is the desktop's.
    function contains(page) {
        return !!pageOf(page);
    }

    // A press of the shell's key `id` in a page of the app: the desktop takes it where the host window shows it.
    function pressKey(id, pressedIn) {
        const page = pageOf(pressedIn);
        if (!shown || !page || !host.showsPanel(page)) return false;
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
        if (ids.length > 1) orderFront(windows.get(ids[0]));
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
        strip = next?.titleBar?.height ?? 0;
        update();
    }

    return {
        start,
        open,
        close,
        orderFront,
        minimize,
        zoom,
        resize,
        move,
        doubleClick,
        activate,
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
        },
    };
}
