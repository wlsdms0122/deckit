import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DECLARED from '../../../deckit-sdk/shell/window/protocol.js';
import * as SURFACE from './model/surface.js';

// `deckit` is what connect answered, `web` what the web engine answered (`pageFor`), `PAGES` the shell's pages,
// `OVERLAY` their overlays, `REGION` the regions mods give their children, `DESKTOP` where normal windows are, the
// frames windows were left at and which mods may activate, `KEY` the keys of the app, and `makeStage()` a stage to
// lay pages on (environment: SHELL.stage);
// `showWindow(control, { activates })` and `closeWindow(control)` are the host app's, which puts an overlay window on
// screen in a floating window of its own, taking the keyboard unless `activates` is false, and closes it. A panel
// window stands at its edge, in the host's bar over the desktop or along the desktop's right edge, where DESKTOP places
// it.
export function createWindows({
    deckit,
    web,
    PAGES,
    OVERLAY,
    REGION,
    DESKTOP,
    KEY,
    makeStage,
    showWindow,
    closeWindow,
}) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const NORMAL = 'normal';
    const OVERLAY_LEVEL = 'overlay';
    const PANEL = 'panel';
    // The size a window opens at where its mod gives none, and the size a web page's window opens at.
    const SIZE = Object.freeze({ width: 720, height: 480 });
    const WEB_SIZE = Object.freeze({ width: 520, height: 700 });
    // id -> { id, mod, page, name, level, edge, size, minimum, surface, sent, host, title, web }: `name` null for a web
    // page's window, which has none, `edge` a panel window's, 'top' or 'right', and null for any other, `surface` its
    // content once
    // the page opened it, `sent` what the page was last told of it, `host` an overlay window's
    // `{ control, stage, key }`; and for a web page's window, `title`, what its title bar holds, and `web`,
    // `{ closed }`, the listeners of its close.
    const windows = new Map();
    const heard = new Set(); // the pages whose end closes their windows
    let count = 0;

    // MARK: - Initializer
    // MARK: - Public
    // The windows mods open, each a run's: a normal one on the desktop, an overlay one in a floating window of the host
    // app's, a panel one in the host's bar over the desktop. A window's content is a document its mod's page opens; it
    // closes with the page's document.
    function start() {
        PROTOCOL.open.handle((options, sender) => open(sender, options));
        PROTOCOL.close.on(bySender(close));
        PROTOCOL.minimize.on(bySender((window) => window.level === NORMAL && DESKTOP.minimize(window)));
        PROTOCOL.zoom.on(bySender((window) => window.level === NORMAL && DESKTOP.zoom(window)));
        PROTOCOL.orderFront.on(bySender((window) => orderFront(window, { activates: false })));
        PROTOCOL.makeKeyAndOrderFront.on(bySender((window) => orderFront(window)));
        PROTOCOL.resize.on(bySender(resize));
        PROTOCOL.move.on(
            bySender((window, { phase, dx, dy }) => window.level === NORMAL && DESKTOP.move(window, phase, dx, dy))
        );
        PROTOCOL.doubleClick.on(bySender((window) => window.level === NORMAL && DESKTOP.doubleClick(window)));
        // An overlay window's children are laid again as the desktop's are: as runs, regions and the order change.
        DESKTOP.onChange(() => {
            tell();
            for (const window of windows.values()) if (window.host?.stage) lay(window);
        });
        OVERLAY.onChange(relay);
    }

    // The page a page is: the mod's page whose window's content it is, or itself.
    function pageOf(page) {
        return [...windows.values()].find((window) => window.surface === page)?.page ?? page;
    }

    // A web page in a window of the app's, as the environment asks the host app for one (`openWindow({ title, page })`):
    // a normal window of the mod whose page shows the web page, its content, WEB_SIZE big under the title bar the shell
    // draws. Answers what the environment drives of it: `setTitle(text)`, `close()`, and `on('close', listener)`, its
    // off answered, heard once as the window closes, however it closes.
    function openWeb({ title = '', page: content }) {
        const page = web.pageFor(content);
        const mod = page && deckit.mods.modOf(page);
        if (!mod) throw new Error('only a web page a mod shows opens a window');
        const id = ++count;
        const window = {
            id,
            mod,
            page,
            name: null,
            level: NORMAL,
            edge: null,
            size: { ...WEB_SIZE },
            minimum: { width: 0, height: 0 },
            surface: content,
            sent: '',
            host: null,
            title: String(title),
            web: { closed: new Set() },
        };
        windows.set(id, window);
        closesWith(page);
        PAGES.whenFocused(content, () => focused(window));
        DESKTOP.open(window);
        layOverlayWindowsOf(page);
        return Object.freeze({
            setTitle: (text) => DESKTOP.setTitle(window, text),
            close: () => close(window),
            on: (event, listener) => {
                if (event !== 'close') return () => {};
                window.web.closed.add(listener);
                return () => window.web.closed.delete(listener);
            },
        });
    }

    // The mod's page hears its instance's reopen().
    function reopen(page) {
        PROTOCOL.reopen.send(page, {});
    }

    // The overlay window that has the keyboard, or null.
    function keyOverlay() {
        return [...windows.values()].find((window) => window.host?.key) ?? null;
    }

    // Where the keyboard of a mod's page goes: the content of its window that is key, or of the first it opened, or
    // the page itself while it has none.
    function keyboardOf(page) {
        const own = [...windows.values()].filter((window) => window.page === page && window.surface);
        const key = own.find((window) => (window.level === OVERLAY_LEVEL ? !!window.host?.key : DESKTOP.isKey(window)));
        return (key ?? own[0])?.surface ?? page;
    }

    // MARK: - Private
    // A handler of a page's word about one of its own windows.
    function bySender(handler) {
        return ({ id, ...payload }, sender) => {
            const window = windows.get(id);
            if (window?.page === sender) handler(window, payload);
        };
    }

    // One window of a name per run: the one open orders front. It comes up as the key window unless `activates` is
    // false.
    function open(page, { name, level, edge, width, height, minWidth, minHeight, activates = true }) {
        const mod = deckit.mods.modOf(page);
        const same = [...windows.values()].find((window) => window.page === page && window.name === name);
        if (same) {
            orderFront(same, { activates });
            return { id: same.id, surface: SURFACE.nameOf(same.id) };
        }
        const id = ++count;
        const window = {
            id,
            mod,
            page,
            name,
            level: [OVERLAY_LEVEL, PANEL].includes(level) ? level : NORMAL,
            edge: level === PANEL ? (edge === 'right' ? 'right' : 'top') : null,
            size: { width: width ?? SIZE.width, height: height ?? SIZE.height },
            minimum: { width: minWidth ?? 0, height: minHeight ?? 0 },
            surface: null,
            sent: '',
            host: null,
            title: null,
            web: null,
        };
        windows.set(id, window);
        closesWith(page);
        PAGES.allowSurface(page, SURFACE.nameOf(id), (surface) => opened(window, surface));
        if (window.level === OVERLAY_LEVEL) float(window, { activates });
        else {
            if (window.level === PANEL) DESKTOP.openPanel(window, { activates });
            else DESKTOP.open(window, { activates });
            layOverlayWindowsOf(page);
        }
        return { id, surface: SURFACE.nameOf(id) };
    }

    // The content, once the page opened it: its keys reach the keys of the app as the page's, and a press in it is the
    // person's on its window. Only a press takes the keyboard to a window that is not key, the shell giving it to the
    // key window's content alone; a press in a panel window in the bar leaves the key window key. A press in the
    // normal key window takes the keyboard back from a panel window that holds it.
    function opened(window, surface) {
        if (windows.get(window.id) !== window) return PAGES.close(surface);
        window.surface = surface;
        KEY.listen(surface, window.page);
        PAGES.whenFocused(surface, () => focused(window));
        if (window.level === OVERLAY_LEVEL) lay(window);
        else DESKTOP.update();
        tell();
    }

    function focused(window) {
        if (windows.get(window.id) !== window) return;
        if (window.level === PANEL) {
            if (!DESKTOP.isKey(window)) DESKTOP.pressPanel(window);
        } else if (window.level === NORMAL && (!DESKTOP.isKey(window) || DESKTOP.keyPanel())) DESKTOP.press(window);
    }

    // Closed, wherever it is, and the page told, unless the page is what went, before another window takes the key
    // it had; a web page's window tells those who listen to its close instead, the environment closing the web page.
    function close(window) {
        if (windows.get(window.id) !== window) return;
        windows.delete(window.id);
        if (!window.web && PAGES.isAlive(window.page)) PROTOCOL.closed.send(window.page, { id: window.id });
        if (window.level === OVERLAY_LEVEL) sink(window);
        else {
            if (window.level === PANEL) DESKTOP.closePanel(window);
            else DESKTOP.close(window);
            layOverlayWindowsOf(window.page);
        }
        if (window.web) {
            for (const listener of [...window.web.closed]) listener();
            return;
        }
        if (window.surface) PAGES.close(window.surface);
    }

    // In front as the mod asks: the key window, the host window it is in coming up too, unless `activates` is false,
    // where the mod may activate for the local seat (DESKTOP.orderFront); an overlay window takes the keyboard only
    // then. A panel window stands where it is: one at the right edge takes the keyboard as an overlay window does, one
    // in the bar never.
    function orderFront(window, { activates = true } = {}) {
        if (window.level === PANEL) {
            if (window.edge === 'right') DESKTOP.orderFrontPanel(window, { activates });
            return;
        }
        if (window.level === NORMAL) DESKTOP.orderFront(window, { activates });
        else showFloating(window, { activates: activates && mayActivate(window) });
    }

    // Every window of the mod `mod` brought in front as makeKeyAndOrderFront brings one, for `seat`: its normal windows
    // in the order they stand, then its overlay windows in the order they opened, so the last of them is key where the
    // mod may activate. Answers whether it has a window open.
    function forward(seat, mod) {
        const normal = DESKTOP.activate(seat, mod);
        const overlays = [...windows.values()].filter((window) => window.mod === mod && window.level === OVERLAY_LEVEL);
        for (const window of overlays) orderFront(window);
        return normal || overlays.length > 0;
    }

    function mayActivate(window) {
        return DESKTOP.activation.mayActivate(DESKTOP.localSeat, window.mod);
    }

    function resize(window, size) {
        window.size = size;
        if (window.level === NORMAL) DESKTOP.resize(window, size);
        else if (window.level === PANEL) DESKTOP.update();
        else {
            showFloating(window, { activates: false });
            tell();
        }
    }

    // A page's document that ends takes its windows with it.
    function closesWith(page) {
        if (heard.has(page)) return;
        heard.add(page);
        deckit.pages.whenEnds(page, () => {
            heard.delete(page);
            for (const window of [...windows.values()]) if (window.page === page) close(window);
        });
    }

    // An overlay window floats in a window of the host app's, which the host closes as it is done with it, taking the
    // keyboard unless `activates` is false, where its mod may activate for the local seat. The keyboard the host gives
    // it otherwise, as the person presses in it, is that seat's input reaching its mod. Where it is left is kept with
    // the frames of the desktop's windows: the host app reads the frame the window of its name was left at,
    // `keptFrame`, and tells each frame a move by the person leaves, `didMove(frame)`, both in the machine's screen
    // coordinates.
    function float(window, { activates }) {
        // `giving` while the host is to give it the keyboard as the shell asked.
        const host = { control: null, stage: null, unheard: null, key: false, giving: false };
        host.control = Object.freeze({
            mod: window.mod,
            name: window.name,
            get width() {
                return window.size.width;
            },
            get height() {
                return window.size.height;
            },
            get keptFrame() {
                return DESKTOP.keptFrameOf(window);
            },
            // Into one of the host app's windows, as a stage is placed (`front`, `bounds`, `onClose`): the content
            // fills it. A window the host app closes closes the mod's.
            place: (into, { onClose = null, ...options } = {}) =>
                stageOf(window).place(into, {
                    ...options,
                    onClose: () => {
                        close(window);
                        onClose?.();
                    },
                }),
            contains: (page) => !!page && pageOf(OVERLAY.ownerOf(page)) === window.page,
            focus: () => {
                if (!host.giving) DESKTOP.activation.input(DESKTOP.localSeat, window.mod);
                host.giving = false;
                if (window.surface) PAGES.focus(window.surface);
                setKey(window, true);
            },
            didResignKey: () => {
                host.giving = false;
                setKey(window, false);
            },
            didMove: (frame) => DESKTOP.remember(window, frame),
        });
        window.host = host;
        showFloating(window, { activates: activates && mayActivate(window) });
    }

    // The host asked to show an overlay window, giving it the keyboard where `activates` is true: the keyboard it gives
    // as asked is the activation of a mod that may activate, and not input reaching it.
    function showFloating(window, { activates }) {
        const { host } = window;
        if (activates && !host.key) host.giving = true;
        showWindow(host.control, { activates });
    }

    // The overlay window that has the keyboard has the active mod, and the key window behind it is not key, nor a panel
    // window that held it: the desktop hears it, and tells the pages and the frames.
    function setKey(window, on) {
        if (window.host.key === on) return;
        window.host.key = on;
        if (on) DESKTOP.toDesktop({ refocus: false });
        DESKTOP.update();
    }

    function stageOf(window) {
        const { host } = window;
        if (!host.stage) {
            host.stage = makeStage();
            host.unheard = host.stage.whenResized(() => lay(window));
            DESKTOP.update();
            lay(window);
        }
        return host.stage;
    }

    // The content fills the stage, over the mod's page where it is laid here and no other stage shows it as a child's
    // view, under the children the window's regions show, cut to the stage; each page's overlay is over it while it
    // shows anything.
    function lay(window) {
        const { stage } = window.host;
        if (!stage) return;
        const full = { x: 0, y: 0, ...stage.size() };
        const holds = holderOf(window.page) === window && !REGION.shownElsewhere(window.page, stage);
        const page = holds ? [{ page: window.page, rect: full, input: [] }] : [];
        const content = window.surface ? [{ page: window.surface, rect: full }] : [];
        const children = childrenIn(window).map(({ page, rect }) => ({ page, rect, clip: full }));
        stage.lay(OVERLAY.withOverlays([...page, ...content, ...children]));
        REGION.show(
            stage,
            children.map(({ page }) => page)
        );
    }

    // `[{ page, rect }]`: the children the window's regions show, each child's page once its view is there, as
    // attach() has ended with one, `rect` in the window's content.
    function childrenIn(window) {
        const pageOf = new Map(
            deckit.mods
                .runs()
                .filter(({ run }) => run.state === 'running' && run.summary.view)
                .map(({ run, page }) => [run.mod.id, page])
        );
        return [...REGION.laidOut(window.mod, (child) => pageOf.has(child))]
            .filter(([, laid]) => laid.window === window.id)
            .map(([child, { rect }]) => ({
                page: pageOf.get(child),
                rect: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            }));
    }

    function sink(window) {
        const { host } = window;
        host.unheard?.();
        if (host.stage) REGION.show(host.stage, []);
        host.stage?.close();
        closeWindow(host.control);
        DESKTOP.update();
        for (const other of windows.values()) if (other.host?.stage) lay(other);
    }

    // The page's overlay windows laid again: the page leaves the one that holds it as it gets a normal window, and is
    // back as it has none.
    function layOverlayWindowsOf(page) {
        for (const other of windows.values()) if (other.page === page && other.host?.stage) lay(other);
    }

    // Each page told of the windows it opened as they change: a window that resigns key is told before one that
    // becomes key.
    function tell() {
        const told = [];
        for (const window of windows.values()) {
            if (window.web || !window.surface) continue;
            const state =
                window.level === OVERLAY_LEVEL
                    ? { shown: true, key: window.host.key, ...window.size, titleBar: null }
                    : DESKTOP.stateOf(window);
            const written = JSON.stringify(state);
            if (written === window.sent) continue;
            const resigns = !state.key && !!window.sent && JSON.parse(window.sent).key;
            window.sent = written;
            told[resigns ? 'unshift' : 'push']({ window, state });
        }
        for (const { window, state } of told) PROTOCOL.state.send(window.page, { id: window.id, ...state });
    }

    // The overlay window a mod's page is laid in, under its content: the first open of a page with no normal or panel
    // window open, so what its overlay draws is over that window; or null, where the page is laid on the desktop.
    function holderOf(page) {
        const own = [...windows.values()].filter((window) => window.page === page);
        if (own.some(({ level }) => level !== OVERLAY_LEVEL)) return null;
        return own.find(({ host }) => host?.stage) ?? null;
    }

    // The overlay of a page laid in an overlay window is laid there as it changes.
    function relay(page) {
        const holder = holderOf(page);
        if (holder) lay(holder);
    }

    return { start, openWeb, pageOf, keyOverlay, forward, reopen, keyboardOf, close };
}
