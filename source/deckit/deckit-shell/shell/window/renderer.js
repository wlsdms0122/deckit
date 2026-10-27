import * as CHANNEL from '../../deck/channel/index.js';
import * as DECLARED from './protocol.js';
import * as WINDOW_PERMISSION from './model/permission.js';

// MARK: - Property
// Ahead of every other sheet of the page, so the page's own rules win over these.
const STYLE = `
    .deckit-window { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden; }
    .deckit-window > * { flex: 1 1 auto; min-height: 0; }
`;

// MARK: - Initializer
// MARK: - Public
// A mod's window, in its own page: `register(value)` is `shell.window`, called once while attach() runs, which
// answers the window's handle; `mount()`, once attach() has ended, lays its content in the page and answers what main
// is told of it, or null; `unmount()` ends it: a window on screen disappears, and its parts are told nothing more.
// `running` is the mod, `fail` records against it, `deliver` calls what the mod handed, and `channels` binds the
// window's channels in the page.
function createWindow({ running, fail, deliver, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const handle = Object.freeze({ open: () => PROTOCOL.open.send(), close: () => PROTOCOL.close.send() });
    let window = null;
    let started = false;
    let shown = false;
    let mounted = false;

    // MARK: - Public
    function register(value) {
        const problem = started
            ? 'is called in attach(), and attach() has ended'
            : window
              ? 'is called once'
              : problemOf(value, running);
        if (problem) fail(`shell.window() ${problem}`);
        else window = value;
        return handle;
    }

    function mount() {
        started = true;
        if (!window) return null;
        const style = document.createElement('style');
        style.textContent = STYLE;
        document.head.prepend(style);
        const root = document.createElement('div');
        root.className = 'deckit-window';
        root.append(window.content);
        document.body.appendChild(root);
        mounted = true;
        PROTOCOL.shown.on(({ on }) => {
            if (shown === on) return;
            shown = on;
            tell(on ? 'didAppear' : 'didDisappear');
        });
        PROTOCOL.resignKey.on(() => tell('didResignKey'));
        return { width: window.width, height: window.height, overlay: !!window.overlay };
    }

    function unmount() {
        if (shown) tell('didDisappear');
        mounted = false;
    }

    // MARK: - Private
    function tell(name) {
        if (mounted && typeof window[name] === 'function') deliver(`${name}()`, () => window[name]());
    }

    return Object.freeze({ register, mount, unmount, has: () => !!window });
}

// MARK: - Private
// Why what `shell.window` was handed is not a window this mod may have, or ''.
function problemOf(value, running) {
    const size = (number) => Number.isFinite(number) && number > 0;
    if (value?.content?.nodeType !== Node.ELEMENT_NODE || !size(value.width) || !size(value.height))
        return 'takes { content, width, height, overlay, didAppear, didDisappear, didResignKey }, content an element';
    const may = running.permissions.some(({ id }) => id === WINDOW_PERMISSION.OVERLAY_WINDOWS);
    if (value.overlay && !may) return `is an overlay with ${WINDOW_PERMISSION.OVERLAY_WINDOWS}`;
    return '';
}

export { createWindow };
