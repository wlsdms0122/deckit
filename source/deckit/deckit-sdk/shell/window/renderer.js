import * as CHANNEL from '../../deckit/channel/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import * as DECLARED from './protocol.js';
import * as LAYER from '../ui/layer/index.js';
import * as POINTER from '../ui/pointer/index.js';
import * as PRESENTATION from '../ui/presentation/index.js';

// MARK: - Property
// What the content's document wears under the page's rules: clear, the content filling it. The content of a panel
// window at the right edge slides in from past that edge as it first comes on screen, with the material the desktop
// draws under it, and fades in where the system asks for reduced motion.
const STYLE = `
    html, body { margin: 0; height: 100%; overflow: hidden; background: transparent; }
    body { -webkit-user-select: none; user-select: none; font: var(--deckit-text-size) var(--deckit-text-font); }
    .deckit-window { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
    .deckit-window > * { flex: 1 1 auto; min-height: 0; }
    .deckit-window[data-edge='right'][data-shown] {
        animation: deckit-window-in var(--deckit-enter) var(--deckit-enter-curve);
    }
    @keyframes deckit-window-in { from { transform: translateX(calc(100% + 8px)); } }
    @keyframes deckit-window-fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
        .deckit-window[data-edge='right'][data-shown] {
            animation: deckit-window-fade var(--deckit-enter-fade) var(--deckit-enter-curve);
        }
    }
`;
const LEVELS = Object.freeze(['normal', 'overlay', 'panel']);
const EDGES = Object.freeze(['top', 'right']);
const CALLBACKS = Object.freeze(['didAppear', 'didDisappear', 'didBecomeKey', 'didResignKey', 'didResize', 'didClose']);
// A normal window's title bar: its styles, the height it is never below, and the flags that say which buttons act.
const TITLE_BARS = Object.freeze(['unified', 'titled']);
const TITLE_BAR_HEIGHT = 48;
const FLAGS = Object.freeze(['closable', 'minimizable', 'resizable']);
// The safe area's insets, set on the content's root as custom properties.
const INSETS = Object.freeze(['top', 'right', 'bottom', 'left']);

// MARK: - Initializer
// MARK: - Public
// A mod's windows, in its own page: `forScope(scope)` is `shell.windows` for a lifecycle, the windows it opened closing
// as `scope` is cut; `windowOf(element)` the id of the window an element is in, or null; `reopen(listener)` what main's
// reopen calls; `unmount()`, each window that is key resigning it and each on screen disappearing, and its parts told
// nothing more. Each window's content
// is a document the page opens beside itself, which wears the page's rules, where the pointer and what is presented
// are heard as in the page, and whose drag regions move the window (`drags`, environment: SHELL_PAGE.drags).
// `mod` is the id of the mod, `granted` the ids of the permissions it is granted, `deliver` calls what the mod handed,
// and `channels` binds the windows' channels in the page.
function createWindows({ mod, granted, deliver, channels, drags }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const open = new Map(); // id -> { handle, options, document, scope, state, off }, while it is open
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
    // where it is. It throws its refusal: NOT_PERMITTED for the level `overlay` without system.overlay-windows, or
    // `panel` without deckit.panel-windows, then INVALID_ARGUMENT for options that are no window's, then ENDED once
    // `scope` is cut. `list()` answers the windows open, in the order they opened, and throws ENDED once `scope` is
    // cut.
    function forScope(scope) {
        scope.add(() => {
            for (const [id, held] of open) if (held.scope === scope) PROTOCOL.close.send({ id });
        });
        return Object.freeze({
            open: (options) => opened(options, scope),
            list: () => {
                if (scope.isCut) throw cut('windows.list');
                return [...open.values()].map(({ handle }) => handle);
            },
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
    function opened(options, scope) {
        const denied = REQUEST.deniedOf({ mod, granted, guard: PROTOCOL.open.guard }, options);
        if (denied) throw REQUEST.refusal('call', 'NOT_PERMITTED', denied);
        const problem = problemOf(options);
        if (problem) throw REQUEST.refusal('call', 'INVALID_ARGUMENT', `windows.open: ${problem}`);
        if (scope.isCut) throw cut('windows.open');
        const { name, level = 'normal', edge = 'top', width, height, minWidth, minHeight, activates = true } = options;
        const { titleBar, titleBarHeight, controlsOrigin, closable, minimizable, resizable, title = '' } = options;
        const bar = { titleBar, titleBarHeight, controlsX: controlsOrigin?.x, controlsY: controlsOrigin?.y };
        const flags = { closable, minimizable, resizable };
        const payload = { name, level, edge, width, height, minWidth, minHeight, activates, ...bar, ...flags, title };
        const { id, surface } = PROTOCOL.open.invoke(payload);
        if (open.has(id)) return open.get(id).handle;
        const view = window.open('', surface);
        const document = view.document;
        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.replaceChildren(style);
        const root = document.createElement('div');
        root.className = 'deckit-window';
        if (level === 'panel' && edge === 'right') root.dataset.edge = 'right';
        // A panel's content lies on the material the desktop draws under it.
        if (level === 'panel') root.dataset.deckitGlass = '';
        root.append(options.content);
        document.body.replaceChildren(root);
        const held = {
            handle: null,
            options,
            document,
            scope,
            state: { shown: false, key: false, size: null },
            title,
            off: [],
        };
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

    // A window's handle: each member throws ENDED once the lifecycle that opened the window has ended, after
    // INVALID_ARGUMENT; one of a window that has closed does nothing.
    function handleOf(id, held) {
        const sent = (name, send) => () => {
            if (held.scope.isCut) throw cut(`window.${name}`);
            send();
        };
        return Object.freeze({
            name: held.options.name,
            get isKey() {
                return held.state.key;
            },
            get title() {
                return held.title;
            },
            setTitle(title) {
                if (typeof title !== 'string')
                    throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'setTitle takes a title, a text');
                sent('setTitle', () => {
                    held.title = title;
                    PROTOCOL.setTitle.send({ id, title });
                })();
            },
            close: sent('close', () => PROTOCOL.close.send({ id })),
            minimize: sent('minimize', () => PROTOCOL.minimize.send({ id })),
            zoom: sent('zoom', () => PROTOCOL.zoom.send({ id })),
            orderFront: sent('orderFront', () => PROTOCOL.orderFront.send({ id })),
            makeKeyAndOrderFront: sent('makeKeyAndOrderFront', () => PROTOCOL.makeKeyAndOrderFront.send({ id })),
            resize(width, height) {
                if (!positive(width) || !positive(height))
                    throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'resize takes a width and a height above 0');
                sent('resize', () => PROTOCOL.resize.send({ id, width, height }))();
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
        guide(held.document, titleBar, key);
        if (shown) held.document.querySelector('.deckit-window')?.toggleAttribute('data-shown', true);
        if (shown && !was.shown) tell(held, 'didAppear');
        if (was.key && !key) tell(held, 'didResignKey');
        if (!was.key && key) tell(held, 'didBecomeKey');
        if (was.shown && !shown) tell(held, 'didDisappear');
        if (was.size && (was.size.width !== width || was.size.height !== height)) tell(held, 'didResize');
    }

    // The content's title bar area is the mod's (`ui.titleBar`): the window's bar, from past its buttons. Its safe area
    // is the frame less what the shell covers: the bar across its top. The root says whether the window is key
    // (`data-deckit-key`), which the kit's title bar and selection read.
    function guide(document, titleBar, key) {
        const root = document.documentElement;
        const inset = { top: titleBar?.height ?? 0, right: 0, bottom: 0, left: 0 };
        root.dataset.deckitKey = String(key);
        root.toggleAttribute('data-deckit-title-bar', !!titleBar);
        root.style.setProperty('--deckit-title-bar-area-height', (titleBar?.height ?? 0) + 'px');
        root.style.setProperty('--deckit-title-bar-area-x', (titleBar?.controlsWidth ?? 0) + 'px');
        for (const side of INSETS) root.style.setProperty(`--deckit-safe-area-inset-${side}`, inset[side] + 'px');
    }

    function ended(id, held) {
        open.delete(id);
        for (const off of held.off) off();
        gone(held);
    }

    // A window going resigns key before it disappears, and is neither key nor shown after.
    function gone(held) {
        const was = held.state;
        held.state = { ...was, shown: false, key: false };
        if (was.key) tell(held, 'didResignKey');
        if (was.shown) tell(held, 'didDisappear');
    }

    function tell(held, name) {
        const listener = held.options[name];
        if (mounted && typeof listener === 'function') deliver(`${name}()`, () => listener());
    }

    return Object.freeze({ forScope, windowOf, reopen, unmount });
}

// MARK: - Private
function cut(name) {
    return REQUEST.refusal('call', 'ENDED', `${name}: the lifecycle it was made for has ended`);
}

// Why what `shell.windows.open` was handed is not a window, or ''.
function problemOf(options) {
    if (CHANNEL.kindOf(options) !== 'object') return 'options is no table';
    const { content, name, level = 'normal' } = options ?? {};
    if (content?.nodeType !== Node.ELEMENT_NODE || typeof name !== 'string' || !name)
        return `takes { name, content, level, edge, width, height, minWidth, minHeight, activates, titleBar, titleBarHeight, controlsOrigin, ${FLAGS.join(', ')}, title, ${CALLBACKS.join(', ')} }, name a text and content an element`;
    if (!LEVELS.includes(level)) return `takes a level of ${LEVELS.slice(0, -1).join(', ')} or ${LEVELS.at(-1)}`;
    if (options.edge !== undefined && !EDGES.includes(options.edge)) return `takes an edge of ${EDGES.join(' or ')}`;
    const sizes = ['width', 'height', 'minWidth', 'minHeight'].filter((key) => options[key] !== undefined);
    if (sizes.some((key) => !positive(options[key]))) return `takes ${sizes.join(', ')} above 0`;
    if (options.activates !== undefined && typeof options.activates !== 'boolean') return 'takes activates a boolean';
    if (options.titleBar !== undefined && !TITLE_BARS.includes(options.titleBar))
        return `takes a titleBar of ${TITLE_BARS.join(' or ')}`;
    const { titleBarHeight, controlsOrigin, title } = options;
    if (titleBarHeight !== undefined && !(Number.isFinite(titleBarHeight) && titleBarHeight >= TITLE_BAR_HEIGHT))
        return `takes a titleBarHeight of ${TITLE_BAR_HEIGHT} or more`;
    const origin = controlsOrigin === undefined || CHANNEL.kindOf(controlsOrigin) === 'object';
    const at = (axis) =>
        controlsOrigin?.[axis] === undefined || (Number.isFinite(controlsOrigin[axis]) && controlsOrigin[axis] >= 0);
    if (!origin || !at('x') || !at('y')) return 'takes a controlsOrigin { x, y }, each a number 0 or more';
    const flags = FLAGS.filter((key) => options[key] !== undefined && typeof options[key] !== 'boolean');
    if (flags.length) return `takes ${flags.join(', ')} a boolean`;
    if (title !== undefined && typeof title !== 'string') return 'takes a title, a text';
    const told = CALLBACKS.filter((key) => options[key] !== undefined && typeof options[key] !== 'function');
    if (told.length) return `takes ${told.join(', ')} a function`;
    return '';
}

function positive(number) {
    return Number.isFinite(number) && number > 0;
}

export { createWindows };
