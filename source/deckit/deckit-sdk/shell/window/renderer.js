import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';
import * as LAYER from '../ui/layer/index.js';
import * as POINTER from '../ui/pointer/index.js';
import * as PRESENTATION from '../ui/presentation/index.js';

// MARK: - Property
// What the content's document wears under the page's rules: clear, the content filling it.
const STYLE = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
    body { -webkit-user-select: none; user-select: none; font: var(--deckit-text-size) var(--deckit-text-font); }
    .deckit-window { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
    .deckit-window > * { flex: 1 1 auto; min-height: 0; }
`;
const LEVELS = Object.freeze(['normal', 'overlay']);
const CALLBACKS = Object.freeze(['didAppear', 'didDisappear', 'didBecomeKey', 'didResignKey', 'didResize', 'didClose']);

// MARK: - Initializer
// MARK: - Public
// A mod's windows, in its own page: `forScope(scope)` is `shell.windows` for a lifecycle, whose windows close as
// `scope` is cut; `windowOf(element)` the id of the window an element is in, or null; `reopen(listener)` what main's
// reopen calls; `unmount()`, each window that is key resigning it and each on screen disappearing, and its parts told
// nothing more. Each window's content
// is a document the page opens beside itself, which wears the page's rules, where the pointer and what is presented
// are heard as in the page, and whose drag regions move the window (`drags`, environment: SHELL_PAGE.drags).
// `granted` is the ids of the permissions the mod is granted, `deliver` calls what the mod handed, and `channels` binds
// the windows' channels in the page.
function createWindows({ granted, deliver, channels, drags }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const open = new Map(); // id -> { handle, options, document, state, off }, while it is open
    const kept = document.createElement('div'); // the contents of the windows that closed, in the page, shown nowhere
    kept.hidden = true;
    let mounted = true;
    let reopened = null;

    // MARK: - Initializer
    PROTOCOL.state.on((next) => {
        const held = open.get(next.id);
        if (held) told(held, next);
    });
    PROTOCOL.closed.on(({ id }) => {
        const held = open.get(id);
        if (!held) return;
        ended(id, held);
        tell(held, 'didClose');
    });
    PROTOCOL.reopen.on(() => reopened?.());

    // MARK: - Public
    // `open(options)` opens a window, or orders front the one of its name open, and answers it: the key window, as
    // `makeKeyAndOrderFront()` puts it, or with `activates` false in front as `orderFront()` puts it, the keyboard left
    // where it is. `list()` answers the windows open, in the order they opened.
    function forScope(scope) {
        scope.add(() => {
            for (const id of open.keys()) PROTOCOL.close.send({ id });
        });
        return Object.freeze({
            open: (options) => opened(options),
            list: () => [...open.values()].map(({ handle }) => handle),
        });
    }

    function windowOf(element) {
        for (const [id, held] of open) if (held.document === element.ownerDocument) return id;
        return null;
    }

    function reopen(listener) {
        reopened = listener;
    }

    function unmount() {
        for (const held of open.values()) gone(held);
        mounted = false;
    }

    // MARK: - Private
    function opened(options) {
        const problem = problemOf(options);
        if (problem) throw new TypeError(`shell.windows.open() ${problem}`);
        const { name, level = 'normal', width, height, minWidth, minHeight, activates = true } = options;
        const payload = { name, level, width, height, minWidth, minHeight, activates };
        const permission = CHANNEL.permissionOf(PROTOCOL.open.guard, payload);
        if (permission !== null && !granted.includes(permission))
            throw new TypeError(`shell.windows.open() opens an overlay window with ${permission}`);
        const { id, surface } = PROTOCOL.open.invoke(payload);
        if (open.has(id)) return open.get(id).handle;
        const view = window.open('', surface);
        const document = view.document;
        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.replaceChildren(style);
        const root = document.createElement('div');
        root.className = 'deckit-window';
        root.append(options.content);
        document.body.replaceChildren(root);
        const held = { handle: null, options, document, state: { shown: false, key: false, size: null }, off: [] };
        held.off.push(
            LAYER.wear(view),
            drags.take(document, (down) => moved(id, down))
        );
        POINTER.watch(view);
        PRESENTATION.watch(view);
        // A closing window's document takes the listeners off what is still in it, so the content, unless it opened in
        // another window since, goes back to the page first, as it is, for the mod to open again.
        view.addEventListener('pagehide', () => {
            if (options.content.ownerDocument !== document) return;
            if (!kept.isConnected) window.document.body.append(kept);
            kept.append(options.content);
        });
        held.handle = handleOf(id, held);
        open.set(id, held);
        return held.handle;
    }

    function handleOf(id, held) {
        return Object.freeze({
            name: held.options.name,
            get isKey() {
                return held.state.key;
            },
            close: () => PROTOCOL.close.send({ id }),
            minimize: () => PROTOCOL.minimize.send({ id }),
            zoom: () => PROTOCOL.zoom.send({ id }),
            orderFront: () => PROTOCOL.orderFront.send({ id }),
            makeKeyAndOrderFront: () => PROTOCOL.makeKeyAndOrderFront.send({ id }),
            resize(width, height) {
                if (!positive(width) || !positive(height))
                    throw new TypeError('resize takes a width and a height above 0');
                PROTOCOL.resize.send({ id, width, height });
            },
        });
    }

    // A press in a drag region of the content: its moves and release are the content's, on the screen, so the
    // window moving under the pointer does not move the press. The second press of a double click is the title bar's.
    function moved(id, down) {
        if (down.detail === 2) return PROTOCOL.doubleClick.send({ id });
        const document = down.target.ownerDocument;
        const from = { x: down.screenX, y: down.screenY };
        const send = (phase, event) =>
            PROTOCOL.move.send({ id, phase, dx: event.screenX - from.x, dy: event.screenY - from.y });
        const move = (event) => send('changed', event);
        const up = (event) => {
            document.removeEventListener('mousemove', move, true);
            document.removeEventListener('mouseup', up, true);
            send('ended', event);
        };
        document.addEventListener('mousemove', move, true);
        document.addEventListener('mouseup', up, true);
        send('began', down);
    }

    // What main tells of the window, each part told as it changes: it appears before it becomes key, and resigns key
    // before it disappears.
    function told(held, { shown, key, width, height, titleBar }) {
        const was = held.state;
        held.state = { shown, key, size: { width, height } };
        guide(held.document, titleBar);
        if (shown && !was.shown) tell(held, 'didAppear');
        if (was.key && !key) tell(held, 'didResignKey');
        if (!was.key && key) tell(held, 'didBecomeKey');
        if (was.shown && !shown) tell(held, 'didDisappear');
        if (was.size && (was.size.width !== width || was.size.height !== height)) tell(held, 'didResize');
    }

    // The content's title bar area is the mod's (`ui.titleBar`): the window's bar, from past its buttons.
    function guide(document, titleBar) {
        const root = document.documentElement;
        root.toggleAttribute('data-deckit-title-bar', !!titleBar);
        root.style.setProperty('--deckit-title-bar-area-height', (titleBar?.height ?? 0) + 'px');
        root.style.setProperty('--deckit-title-bar-area-x', (titleBar?.controlsWidth ?? 0) + 'px');
    }

    function ended(id, held) {
        open.delete(id);
        for (const off of held.off) off();
        gone(held);
    }

    // A window going resigns key before it disappears.
    function gone(held) {
        if (held.state.key) tell(held, 'didResignKey');
        if (held.state.shown) tell(held, 'didDisappear');
    }

    function tell(held, name) {
        const listener = held.options[name];
        if (mounted && typeof listener === 'function') deliver(`${name}()`, () => listener());
    }

    return Object.freeze({ forScope, windowOf, reopen, unmount });
}

// MARK: - Private
// Why what `shell.windows.open` was handed is not a window, or ''.
function problemOf(options) {
    const { content, name, level = 'normal' } = options ?? {};
    if (content?.nodeType !== Node.ELEMENT_NODE || typeof name !== 'string' || !name)
        return `takes { name, content, level, width, height, minWidth, minHeight, activates, ${CALLBACKS.join(', ')} }, name a text and content an element`;
    if (!LEVELS.includes(level)) return `takes a level of ${LEVELS.join(' or ')}`;
    const sizes = ['width', 'height', 'minWidth', 'minHeight'].filter((key) => options[key] !== undefined);
    if (sizes.some((key) => !positive(options[key]))) return `takes ${sizes.join(', ')} above 0`;
    return '';
}

function positive(number) {
    return Number.isFinite(number) && number > 0;
}

export { createWindows };
