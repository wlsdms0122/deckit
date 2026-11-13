import * as KIT from '../../../deckit-sdk/shell/ui/kit/index.js';
import * as FONTS from '../../../deckit-sdk/shell/fonts/renderer.js';
import * as LAYER from '../../../deckit-sdk/shell/ui/layer/index.js';
import * as TOKEN from '../../../deckit-sdk/shell/ui/token/index.js';
import * as MOD_STYLE from '../../../deckit-sdk/shell/style/renderer.js';
import * as LAYOUT from './model/layout.js';
import * as PAGE from './model/page-name.js';
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DOCK from '../dock/view.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// Each frame's surface is the window grown by its shadow: the window's material at its middle, the title bar of a
// titled window at its top, the edges that resize it just outside it, as model/layout.js partsOf has them.
const { SHADOW, EDGE, RADIUS, BUTTON } = LAYOUT;
const STYLE = `
    .deckit-desktop-strip { position: fixed; top: 0; left: 0; right: 0; --app-region: drag; }
    .deckit-window-title-text {
        overflow: hidden;
        color: var(--deckit-muted);
        font: var(--deckit-type-body);
        font-weight: 600;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .deckit-desktop-down { position: fixed; inset: 0; display: flex; background: var(--deckit-background); }
    .deckit-desktop-down[hidden] { display: none; }
    .deckit-desktop-backdrop { position: fixed; inset: 0; }
    .deckit-panel-material {
        position: fixed;
        border-radius: var(--deckit-radius-round);
        background: color-mix(in srgb, var(--deckit-elevated) var(--deckit-glass), transparent);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
    }
    .deckit-panel-material[data-edge='right'] {
        border-radius: ${RADIUS}px;
        animation: deckit-panel-in var(--deckit-move-base) var(--deckit-easing-move);
    }
    .deckit-panel-material[data-edge='right'][data-leaving] {
        animation: deckit-panel-out var(--deckit-move-base) var(--deckit-easing-move) forwards;
    }
    @keyframes deckit-panel-in { from { transform: translateX(calc(100% + ${LAYOUT.PANEL.margin}px)); } }
    @keyframes deckit-panel-out { to { transform: translateX(calc(100% + ${LAYOUT.PANEL.margin}px)); } }
    @keyframes deckit-panel-fade-in { from { opacity: 0; } }
    @keyframes deckit-panel-fade-out { to { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
        .deckit-panel-material[data-edge='right'] { animation: deckit-panel-fade-in var(--deckit-fade) var(--deckit-easing); }
        .deckit-panel-material[data-edge='right'][data-leaving] {
            animation: deckit-panel-fade-out var(--deckit-fade) var(--deckit-easing) forwards;
        }
    }
    .deckit-window-material {
        position: fixed;
        inset: ${SHADOW}px;
        border-radius: ${RADIUS}px;
        background: var(--deckit-background);
        box-shadow: var(--deckit-shadow-inactive);
    }
    .deckit-window-material[data-key] { box-shadow: var(--deckit-shadow-key); }
    .deckit-window-title {
        position: fixed;
        top: ${SHADOW}px;
        left: ${SHADOW}px;
        right: ${SHADOW}px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-sizing: border-box;
        border-bottom: 1px solid var(--deckit-divider);
    }
    .deckit-window-title[hidden] { display: none; }
    .deckit-window-title[data-key] .deckit-window-title-text { color: var(--deckit-text); }
    .deckit-window-edge { position: fixed; }
    .deckit-window-edge[hidden] { display: none; }
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
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${BUTTON.size}px;
        height: ${BUTTON.size}px;
        padding: 0;
        border: 0;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-disabled);
        box-shadow: inset 0 0 0 0.5px rgba(0, 0, 0, 0.15);
        color: rgba(0, 0, 0, 0.5);
    }
    .deckit-window-button[data-button='close'] { --deckit-window-light: #ff5f57; }
    .deckit-window-button[data-button='minimize'] { --deckit-window-light: #febc2e; }
    .deckit-window-button[data-button='zoom'] { --deckit-window-light: #28c840; }
    :is([data-key], .deckit-window-buttons:hover) > .deckit-window-button:enabled {
        background: var(--deckit-window-light);
    }
    .deckit-window-button:enabled:active { filter: brightness(0.85); }
    .deckit-window-button svg { width: 8px; height: 8px; opacity: 0; }
    :is(.deckit-window-buttons:hover .deckit-window-button, .deckit-window-button:focus-visible):enabled svg {
        opacity: 1;
    }
    .deckit-window-buttons { position: fixed; inset: 0; }
`;
const LABELS = Object.freeze({ close: 'Close', minimize: 'Minimize', zoom: 'Zoom' });
// The glyph each button shows while the pointer is over them.
const GLYPHS = Object.freeze({
    close: 'M2 2l4 4M6 2L2 6',
    minimize: 'M1.5 4h5',
    zoom: 'M4 1.5v5M1.5 4h5',
});
const EDGES = Object.freeze(['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);

// MARK: - Initializer
// MARK: - Public
// The desktop, in the desktop's own page: the backdrop under every window, and each window's frame under its content
// and its buttons over it, each a document this page opens beside itself and main lays where the window is. The page
// itself is laid over the whole desktop, with the Dock at its left edge and the host window's bar at its top, an empty
// strip that drags the host window, its controls in it, the backdrop showing through. Under each panel window in that
// strip it draws the panel's material: the backdrop is cut away there, so the host window's own material shows
// through the panel's tint, opaque where the person asks for less transparency. Main lays a material under the page
// where it draws glass: the Dock's card while it is out and still, and each panel's material while it stands still at
// its frame, so what lies under them in the host window is blurred too, none where the person asks for less
// transparency. It takes the pointer only in the
// strip, or over all of it once deckit's core is down, with a note that asks for a restart. `channels` binds the
// desktop's and the Dock's channels in the page.
function boot(theme, channels) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const ui = KIT.make(theme, { fonts: FONTS.installed({ channels }) });
    KIT.addStyle(STYLE);
    let { state } = PROTOCOL.setup.invoke();
    const drawn = new Map(); // a window's id -> { material, buttons, off }, its frame's parts as drawn
    const materials = new Map(); // a panel window's id -> { element, edge, settled }, the material drawn under it
    const glass = { dock: null, panels: [] }; // where the page draws glass: the Dock's card, the panels standing still
    let toldGlass = '[]';

    const backdrop = surface(PAGE.BACKDROP);
    const backdropRoot = element(backdrop.document, 'div', 'deckit-desktop-backdrop');
    backdropRoot.style.background = 'color-mix(in srgb, var(--deckit-background) var(--deckit-glass), transparent)';
    backdrop.document.body.append(backdropRoot);

    const dock = DOCK.make({
        ui,
        channels,
        onOut: (out) => PROTOCOL.dock.send({ out }),
        onGlass: (material) => {
            glass.dock = material;
            tellGlass();
        },
    });
    const strip = element(document, 'div', 'deckit-desktop-strip');
    const down = element(document, 'div', 'deckit-desktop-down');
    const downNote = ui.emptyState({
        actions: [
            ui.button({ label: 'Restart', variant: 'primary', onClick: () => PROTOCOL.restart.send({}) }).element,
        ],
    });
    down.append(downNote.element);
    document.body.append(dock.element, strip, down);

    MOD_STYLE.wear({ channels, onChange: () => LAYER.dress() });
    TOKEN.whenOpaque(tellGlass);
    draw();
    PROTOCOL.state.on((next) => {
        state = next;
        draw();
    });

    function draw() {
        strip.style.height = state.strip.height + 'px';
        drawPanels(state.panels);
        dock.setTop(state.strip.height);
        dock.update(state.dock);
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
            const { material, bar, text, buttons, edges } = drawn.get(window.id);
            const laid = window.bar;
            material.toggleAttribute('data-key', window.key);
            buttons.toggleAttribute('data-key', window.key);
            bar.toggleAttribute('data-key', window.key);
            bar.hidden = window.title === null;
            bar.style.height = laid.height + 'px';
            bar.style.padding = `0 ${laid.areaX}px`;
            text.textContent = window.title ?? '';
            for (const edge of edges) edge.hidden = !laid.enabled.zoom;
            for (const { name, x, y } of LAYOUT.buttonsOf(laid)) {
                const button = buttons.querySelector(`[data-button='${name}']`);
                Object.assign(button.style, { left: x + 'px', top: y + 'px' });
                button.disabled = !laid.enabled[name];
            }
        }
    }

    // Each panel window's material at its frame, rounded as LAYOUT.panelRadius has it, and the backdrop cut away
    // under it. One at the right edge slides in from past it as it opens and out as it closes, or fades where the
    // system asks for reduced motion, the backdrop cut away only while it stands still at its frame.
    function drawPanels(panels) {
        const open = new Set(panels.map(({ id }) => id));
        for (const [id, material] of materials) {
            if (open.has(id)) continue;
            materials.delete(id);
            if (material.edge !== 'right') {
                material.element.remove();
                continue;
            }
            material.element.toggleAttribute('data-leaving', true);
            finished(material.element, () => material.element.remove());
        }
        for (const { id, edge, frame } of panels) {
            if (!materials.has(id)) {
                const made = { element: element(document, 'div', 'deckit-panel-material'), edge, settled: true };
                document.body.insertBefore(made.element, strip);
                materials.set(id, made);
                if (edge === 'right') {
                    made.element.dataset.edge = edge;
                    made.settled = false;
                    finished(made.element, () => {
                        made.settled = true;
                        drawPanels(state.panels);
                    });
                }
            }
            Object.assign(materials.get(id).element.style, {
                left: frame.x + 'px',
                top: frame.y + 'px',
                width: frame.width + 'px',
                height: frame.height + 'px',
            });
        }
        const still = panels.filter(({ id }) => materials.get(id).settled);
        const holes = still.map(({ edge, frame }) => {
            const { x, y, width, height } = frame;
            const shape =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
                `<rect width="${width}" height="${height}" rx="${LAYOUT.panelRadius(edge, frame)}"/></svg>`;
            return { image: `url("data:image/svg+xml,${encodeURIComponent(shape)}")`, at: `${x}px ${y}px` };
        });
        glass.panels = still.map(({ edge, frame }) => ({
            material: 'popover',
            ...frame,
            cornerRadius: LAYOUT.panelRadius(edge, frame),
        }));
        tellGlass();
        const masked = holes.length > 0;
        const { style } = backdropRoot;
        const set = (name, values) =>
            masked ? style.setProperty(name, values.join(', ')) : style.removeProperty(name);
        set('mask-image', [...holes.map(({ image }) => image), 'linear-gradient(#000, #000)']);
        set('mask-position', [...holes.map(({ at }) => at), '0 0']);
        set('mask-size', [...still.map(({ frame }) => `${frame.width}px ${frame.height}px`), '100% 100%']);
        set('mask-repeat', ['no-repeat']);
        set('mask-composite', [...holes.map(() => 'exclude'), 'add']);
    }

    // Main hears where the page draws glass as it changes, none where the person asks for less transparency.
    function tellGlass() {
        const materials = TOKEN.opaque() ? [] : [...(glass.dock ? [glass.dock] : []), ...glass.panels];
        const written = JSON.stringify(materials);
        if (written === toldGlass) return;
        toldGlass = written;
        PROTOCOL.glass.send({ materials });
    }

    // A window's frame and buttons, in the two documents main lets this page open for it: a titled window's frame has
    // its title bar too.
    function frameOf(id) {
        const frame = surface(PAGE.frameOf(id));
        const material = element(frame.document, 'div', 'deckit-window-material');
        const bar = element(frame.document, 'div', 'deckit-window-title');
        const text = element(frame.document, 'span', 'deckit-window-title-text');
        bar.append(text);
        bar.addEventListener('pointerdown', (down) => move(id, bar, down));
        const edges = EDGES.map((edge) => {
            const band = element(frame.document, 'div', 'deckit-window-edge');
            band.dataset.edge = edge;
            band.addEventListener('pointerdown', (down) => resize(id, edge, band, down));
            return band;
        });
        frame.document.body.append(material, bar, ...edges);

        const held = surface(PAGE.buttonsOf(id));
        const buttons = element(held.document, 'div', 'deckit-window-buttons');
        buttons.addEventListener('pointerdown', () => PROTOCOL.press.send({ id }));
        LAYOUT.BUTTONS.forEach((name) => {
            const button = element(held.document, 'button', 'deckit-window-button');
            button.type = 'button';
            button.dataset.button = name;
            button.title = LABELS[name];
            button.setAttribute('aria-label', LABELS[name]);
            button.innerHTML =
                '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">' +
                `<path d="${GLYPHS[name]}"/></svg>`;
            button.addEventListener('click', () => PROTOCOL.button.send({ id, button: name }));
            buttons.append(button);
        });
        held.document.body.append(buttons);
        return { material, bar, text, buttons, edges, off: [frame.off, held.off] };
    }

    // A drag of a titled window's title bar, read on the screen, as the surface moves with the frame. The second press
    // of a double click is the title bar's.
    function move(id, bar, down) {
        if (down.button !== 0) return;
        down.preventDefault();
        PROTOCOL.press.send({ id });
        if (down.detail === 2) return PROTOCOL.doubleClick.send({ id });
        bar.setPointerCapture(down.pointerId);
        const send = (phase, event) =>
            PROTOCOL.move.send({ id, phase, dx: event.screenX - down.screenX, dy: event.screenY - down.screenY });
        const moved = (event) => send('changed', event);
        const up = (event) => {
            bar.removeEventListener('pointermove', moved);
            bar.removeEventListener('pointerup', up);
            bar.removeEventListener('pointercancel', up);
            send('ended', event);
        };
        bar.addEventListener('pointermove', moved);
        bar.addEventListener('pointerup', up);
        bar.addEventListener('pointercancel', up);
        send('began', down);
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

// `then` once each animation on `node` has run, as soon as what draws it now is done; at once where none runs.
function finished(node, then) {
    queueMicrotask(() => {
        const running = node.getAnimations().map(({ finished: done }) => done.catch(() => {}));
        Promise.all(running).then(then);
    });
}

export { boot };
