import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as WINDOW_PERMISSION from './model/permission.js';
import * as SURFACE from './model/surface.js';

// `deckit` is what connect answered, `PAGES` the shell's pages, `OVERLAY` their overlays, `DESKTOP` where normal
// windows are and which mods may activate, and `makeStage()` a stage to lay pages on (environment: SHELL.stage);
// `showWindow(control, { activates })` and `closeWindow(control)` are the host app's, which puts an overlay window on
// screen in a floating window of its own, taking the keyboard unless `activates` is false, and closes it.
export function createWindows({ deckit, PAGES, OVERLAY, DESKTOP, makeStage, showWindow, closeWindow }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(deckit.channels, DECLARED);
    const NORMAL = 'normal';
    const OVERLAY_LEVEL = 'overlay';
    // The size a window opens at where its mod gives none.
    const SIZE = Object.freeze({ width: 720, height: 480 });
    // The name the frame of a web page's window is remembered by.
    const WEB = 'web';
    // id -> { id, mod, page, name, level, size, minimum, surface, sent, host, title, web }: `surface` its content once
    // the page opened it, `sent` what the page was last told of it, `host` an overlay window's `{ control, stage, key }`;
    // and for a web page's window, `title`, what its title bar holds, and `web`, `{ closed }`, the listeners of its
    // close.
    const windows = new Map();
    const heard = new Set(); // the pages whose end closes their windows
    let count = 0;

    // MARK: - Initializer
    // MARK: - Public
    // The windows mods open, each a run's: a normal one on the desktop, an overlay one in a floating window of the host
    // app's. A window's content is a document its mod's page opens; it closes with the page's document.
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
        DESKTOP.onChange(tell);
        OVERLAY.onChange(relay);
    }

    // The windows of a mod's runs, open now, in the order they opened.
    function of(mod) {
        return [...windows.values()].filter((window) => window.mod === mod);
    }

    // The page a page is: the mod's page whose window's content it is, or itself.
    function pageOf(page) {
        return [...windows.values()].find((window) => window.surface === page)?.page ?? page;
    }

    // The overlay window a mod's page is laid in, under its content: the first open of a page with no normal window
    // open, so what its overlay draws is over that window; or null, where the page is laid on the desktop.
    function holderOf(page) {
        const own = [...windows.values()].filter((window) => window.page === page);
        if (own.some(({ level }) => level === NORMAL)) return null;
        return own.find(({ host }) => host?.stage) ?? null;
    }

    // A web page in a window of the app's, as the environment asks the host app for one (`openWindow({ title, size,
    // page })`): a normal window of the mod whose page shows the web page, its content, under the title bar the shell
    // draws. Answers what the environment drives of it: `setTitle(text)`, `close()`, and `on('close', listener)`, its
    // off answered, heard once as the window closes, however it closes.
    function openWeb({ title = '', size = null, page: content }) {
        const page = deckit.web.pageFor(content);
        const mod = page && deckit.mods.modOf(page);
        if (!mod) throw new Error('only a web page a mod shows opens a window');
        const id = ++count;
        const window = {
            id,
            mod,
            page,
            name: WEB,
            level: NORMAL,
            size: { width: size?.width ?? SIZE.width, height: size?.height ?? SIZE.height },
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
        const key = own.find((window) => (window.level === NORMAL ? DESKTOP.isKey(window) : window.host.key));
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
    // false. An overlay window is only for a mod that holds the permission, whatever its page says.
    function open(page, { name, level, width, height, minWidth, minHeight, activates = true }) {
        const mod = deckit.mods.modOf(page);
        if (!mod) throw new Error('only a mod opens windows');
        const same = [...windows.values()].find((window) => window.page === page && window.name === name);
        if (same) {
            orderFront(same, { activates });
            return { id: same.id, surface: SURFACE.nameOf(same.id) };
        }
        const overlay = level === OVERLAY_LEVEL;
        const may = deckit.mods.runOf(mod)?.granted.includes(WINDOW_PERMISSION.OVERLAY_WINDOWS);
        if (overlay && !may)
            throw Object.assign(new Error(`${mod} does not have ${WINDOW_PERMISSION.OVERLAY_WINDOWS}`), {
                kind: 'NOT_PERMITTED',
            });
        const id = ++count;
        const window = {
            id,
            mod,
            page,
            name,
            level: overlay ? OVERLAY_LEVEL : NORMAL,
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
        if (overlay) float(window, { activates });
        else {
            DESKTOP.open(window, { activates });
            layOverlayWindowsOf(page);
        }
        return { id, surface: SURFACE.nameOf(id) };
    }

    // The content, once the page opened it: its keys reach the key map as the page's, and a press in it is the
    // person's on its window. Only a press takes the keyboard to a window that is not key, the shell giving it to the
    // key window's content alone.
    function opened(window, surface) {
        if (windows.get(window.id) !== window) return PAGES.close(surface);
        window.surface = surface;
        deckit.keymap.listen(surface);
        PAGES.whenFocused(surface, () => focused(window));
        if (window.level === NORMAL) DESKTOP.update();
        else lay(window);
        tell();
    }

    function focused(window) {
        if (windows.get(window.id) !== window) return;
        if (window.level === NORMAL && !DESKTOP.isKey(window)) DESKTOP.press(window);
    }

    // Closed, wherever it is, and the page told, unless the page is what went; a web page's window tells those who
    // listen to its close instead, the environment closing the web page.
    function close(window) {
        if (windows.get(window.id) !== window) return;
        windows.delete(window.id);
        if (window.level === NORMAL) {
            DESKTOP.close(window);
            layOverlayWindowsOf(window.page);
        } else sink(window);
        if (window.web) {
            for (const listener of [...window.web.closed]) listener();
            return;
        }
        if (window.surface) PAGES.close(window.surface);
        if (PAGES.isAlive(window.page)) PROTOCOL.closed.send(window.page, { id: window.id });
    }

    // In front as the mod asks: the key window, the host window it is in coming up too, unless `activates` is false,
    // where the mod may activate for the local seat (DESKTOP.orderFront); an overlay window takes the keyboard only
    // then.
    function orderFront(window, { activates = true } = {}) {
        if (window.level === NORMAL) DESKTOP.orderFront(window, { activates });
        else showWindow(window.host.control, { activates: activates && mayActivate(window) });
    }

    function mayActivate(window) {
        return DESKTOP.activation.mayActivate(DESKTOP.localSeat, window.mod);
    }

    function resize(window, size) {
        window.size = size;
        if (window.level === NORMAL) DESKTOP.resize(window, size);
        else {
            showWindow(window.host.control, { activates: false });
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
    // keyboard unless `activates` is false, where its mod may activate for the local seat. It takes the keyboard as
    // that seat's input reaches its mod.
    function float(window, { activates }) {
        const host = { control: null, stage: null, unheard: null, key: false };
        host.control = Object.freeze({
            mod: window.mod,
            name: window.name,
            get width() {
                return window.size.width;
            },
            get height() {
                return window.size.height;
            },
            // Into one of the host app's windows, as a stage is placed (`front`, `bounds`, `onClose`): the content fills
            // it. A window the host app closes closes the mod's.
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
                DESKTOP.activation.input(DESKTOP.localSeat, window.mod);
                if (window.surface) PAGES.focus(window.surface);
                setKey(window, true);
            },
            didResignKey: () => setKey(window, false),
        });
        window.host = host;
        showWindow(host.control, { activates: activates && mayActivate(window) });
    }

    // The overlay window that has the keyboard has the active mod: the desktop hears it, and tells the pages.
    function setKey(window, on) {
        if (window.host.key === on) return;
        window.host.key = on;
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

    // The content fills the stage, over the mod's page where it is laid here, and the page's overlay is over it while
    // it shows anything.
    function lay(window) {
        const { stage } = window.host;
        if (!stage) return;
        const full = { x: 0, y: 0, ...stage.size() };
        const page = holderOf(window.page) === window ? [{ page: window.page, rect: full, input: [] }] : [];
        const content = window.surface ? [{ page: window.surface, rect: full }] : [];
        stage.lay(OVERLAY.withOverlays([...page, ...content]));
    }

    function sink(window) {
        const { host } = window;
        host.unheard?.();
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

    // Each page told of the windows it opened as they change.
    function tell() {
        for (const window of windows.values()) {
            if (window.web) continue;
            const state =
                window.level === NORMAL
                    ? DESKTOP.stateOf(window)
                    : { shown: true, key: window.host.key, ...window.size, titleBar: null };
            const written = JSON.stringify(state);
            if (!window.surface || written === window.sent) continue;
            window.sent = written;
            PROTOCOL.state.send(window.page, { id: window.id, ...state });
        }
    }

    // The overlay of a page laid in an overlay window is laid there as it changes.
    function relay(page) {
        const holder = holderOf(page);
        if (holder) lay(holder);
    }

    return { start, openWeb, of, pageOf, holderOf, keyOverlay, reopen, keyboardOf, relay, close };
}
