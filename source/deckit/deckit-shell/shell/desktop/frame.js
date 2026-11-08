import * as KIT from '../ui/kit/index.js';
import * as FONTS from '../fonts/renderer.js';
import * as LAYER from '../ui/layer/index.js';
import * as MOD_STYLE from '../style/renderer.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as CHANNEL from '../../deckit/channel/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// Each frame's surface is the window grown by its shadow: the window's material at its middle, the edges that resize
// it just outside it, as model/layout.js partsOf has them.
const { SHADOW, EDGE, RADIUS, BUTTON, TITLE_BAR } = LAYOUT;
const STYLE = `
    .deckit-desktop-strip { position: fixed; top: 0; left: 0; right: 0; --app-region: drag; }
    .deckit-desktop-down { position: fixed; inset: 0; display: flex; background: var(--deckit-background); }
    .deckit-desktop-down[hidden] { display: none; }
    .deckit-desktop-backdrop { position: fixed; inset: 0; }
    .deckit-window-material {
        position: fixed;
        inset: ${SHADOW}px;
        border-radius: ${RADIUS}px;
        background: var(--deckit-background);
        box-shadow: 0 0 0 1px var(--deckit-divider), var(--deckit-shadow-lifted);
    }
    .deckit-window-material[data-key] { box-shadow: 0 0 0 1px var(--deckit-divider), var(--deckit-shadow-raised); }
    .deckit-window-edge { position: fixed; }
    .deckit-window-edge[data-edge='top'] { top: ${SHADOW - EDGE}px; left: ${SHADOW}px; right: ${SHADOW}px; height: ${EDGE}px; cursor: ns-resize; }
    .deckit-window-edge[data-edge='bottom'] { bottom: ${SHADOW - EDGE}px; left: ${SHADOW}px; right: ${SHADOW}px; height: ${EDGE}px; cursor: ns-resize; }
    .deckit-window-edge[data-edge='left'] { left: ${SHADOW - EDGE}px; top: ${SHADOW}px; bottom: ${SHADOW}px; width: ${EDGE}px; cursor: ew-resize; }
    .deckit-window-edge[data-edge='right'] { right: ${SHADOW - EDGE}px; top: ${SHADOW}px; bottom: ${SHADOW}px; width: ${EDGE}px; cursor: ew-resize; }
    .deckit-window-edge[data-edge^='top-'] { top: ${SHADOW - EDGE}px; }
    .deckit-window-edge[data-edge^='bottom-'] { bottom: ${SHADOW - EDGE}px; }
    .deckit-window-edge[data-edge$='-left'] { left: ${SHADOW - EDGE}px; }
    .deckit-window-edge[data-edge$='-right'] { right: ${SHADOW - EDGE}px; }
    .deckit-window-edge[data-edge*='-'] { width: ${EDGE}px; height: ${EDGE}px; }
    .deckit-window-edge[data-edge='top-left'], .deckit-window-edge[data-edge='bottom-right'] { cursor: nwse-resize; }
    .deckit-window-edge[data-edge='top-right'], .deckit-window-edge[data-edge='bottom-left'] { cursor: nesw-resize; }
    .deckit-window-button {
        position: fixed;
        top: ${(TITLE_BAR.height - BUTTON.size) / 2}px;
        width: ${BUTTON.size}px;
        height: ${BUTTON.size}px;
        padding: 0;
        border: 0;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-disabled);
    }
    [data-key] > .deckit-window-button[data-button='close'], .deckit-window-buttons:hover > [data-button='close'] { background: var(--deckit-alert); }
    [data-key] > .deckit-window-button[data-button='minimize'], .deckit-window-buttons:hover > [data-button='minimize'] { background: var(--deckit-warn); }
    [data-key] > .deckit-window-button[data-button='zoom'], .deckit-window-buttons:hover > [data-button='zoom'] { background: var(--deckit-ok); }
    .deckit-window-buttons { position: fixed; inset: 0; }
`;
const LABELS = Object.freeze({ close: 'Close', minimize: 'Minimize', zoom: 'Zoom' });
const EDGES = Object.freeze(['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);

// MARK: - Initializer
// MARK: - Public
// The desktop, in the desktop's own page: the backdrop under every window, and each window's frame under its content
// and its buttons over it, each a document this page opens beside itself and main lays where the window is. The page
// itself is laid over the whole desktop and takes presses only at the host window's bar, which drags the host
// window, or over all of it once deckit's core is down, with a note that asks for a restart. `channels` binds the
// desktop's channels in the page.
function boot(theme, channels) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const ui = KIT.make(theme, { fonts: FONTS.installed({ channels }) });
    KIT.addStyle(STYLE);
    const setup = PROTOCOL.setup.invoke();
    let { state } = setup;
    const drawn = new Map(); // a window's id -> { material, buttons, off }, its frame's parts as drawn

    const backdrop = surface(PAGE.BACKDROP);
    const backdropRoot = element(backdrop.document, 'div', 'deckit-desktop-backdrop');
    backdropRoot.style.background = `color-mix(in srgb, var(--deckit-background) ${setup.glass * 100}%, transparent)`;
    backdrop.document.body.append(backdropRoot);

    const strip = element(document, 'div', 'deckit-desktop-strip');
    const down = element(document, 'div', 'deckit-desktop-down');
    const downNote = ui.emptyState({
        actions: [
            ui.button({ label: 'Restart', variant: 'primary', onClick: () => PROTOCOL.restart.send({}) }).element,
        ],
    });
    down.append(downNote.element);
    document.body.append(strip, down);

    MOD_STYLE.wear({ channels, onChange: () => LAYER.dress() });
    draw();
    PROTOCOL.state.on((next) => {
        state = next;
        draw();
    });

    function draw() {
        strip.style.height = state.strip + 'px';
        down.hidden = !state.down;
        if (state.down)
            downNote.set({ title: `${state.down.name} needs a restart`, hint: `Its core ${state.down.why}.` });
        const open = new Set(state.windows.map(({ id }) => id));
        for (const [id, parts] of drawn) {
            if (open.has(id)) continue;
            for (const off of parts.off) off();
            drawn.delete(id);
        }
        for (const window of state.windows) {
            if (!drawn.has(window.id)) drawn.set(window.id, frameOf(window.id));
            const { material, buttons } = drawn.get(window.id);
            material.toggleAttribute('data-key', window.key);
            buttons.toggleAttribute('data-key', window.key);
        }
    }

    // A window's frame and buttons, in the two documents main lets this page open for it.
    function frameOf(id) {
        const frame = surface(PAGE.frameOf(id));
        const material = element(frame.document, 'div', 'deckit-window-material');
        const edges = EDGES.map((edge) => {
            const band = element(frame.document, 'div', 'deckit-window-edge');
            band.dataset.edge = edge;
            band.addEventListener('pointerdown', (down) => resize(id, edge, band, down));
            return band;
        });
        frame.document.body.append(material, ...edges);

        const held = surface(PAGE.buttonsOf(id));
        const buttons = element(held.document, 'div', 'deckit-window-buttons');
        buttons.addEventListener('pointerdown', () => PROTOCOL.press.send({ id }));
        LAYOUT.BUTTONS.forEach((name, at) => {
            const button = element(held.document, 'button', 'deckit-window-button');
            button.type = 'button';
            button.dataset.button = name;
            button.title = LABELS[name];
            button.setAttribute('aria-label', LABELS[name]);
            button.style.left = BUTTON.inset + at * (BUTTON.size + BUTTON.gap) + 'px';
            button.addEventListener('click', () => PROTOCOL.button.send({ id, button: name }));
            buttons.append(button);
        });
        held.document.body.append(buttons);
        return { material, buttons, off: [frame.off, held.off] };
    }

    // A drag of an edge, read on the screen, as the surface moves with the frame: the frame main is told as it goes,
    // never below the window's minimum, and once more as the drag ends.
    function resize(id, edge, band, down) {
        if (down.button !== 0) return;
        const window = state.windows.find((one) => one.id === id);
        if (!window) return;
        down.preventDefault();
        PROTOCOL.press.send({ id });
        band.setPointerCapture(down.pointerId);
        let frame = window.frame;
        const move = (event) => {
            frame = LAYOUT.resized(
                window.frame,
                edge,
                event.screenX - down.screenX,
                event.screenY - down.screenY,
                window.minimum
            );
            PROTOCOL.resize.send({ id, phase: 'changed', ...frame });
        };
        const up = () => {
            band.removeEventListener('pointermove', move);
            band.removeEventListener('pointerup', up);
            band.removeEventListener('pointercancel', up);
            PROTOCOL.resize.send({ id, phase: 'ended', ...frame });
        };
        band.addEventListener('pointermove', move);
        band.addEventListener('pointerup', up);
        band.addEventListener('pointercancel', up);
    }

    // A document of this page's, laid where main puts it, wearing this page's rules. It draws nothing of its own: what
    // is in it is drawn from here. One the last document of this page drew is found by its name and drawn anew.
    function surface(name) {
        const opened = window.open('', name);
        opened.document.head.replaceChildren();
        opened.document.body.replaceChildren();
        return { document: opened.document, off: LAYER.wear(opened) };
    }
}

// MARK: - Private
function element(page, tag, className) {
    const made = page.createElement(tag);
    made.className = className;
    return made;
}

export { boot };
