import * as KIT from '../../../deckit-sdk/shell/ui/kit/index.js';
import * as FONTS from '../../../deckit-sdk/shell/fonts/renderer.js';
import * as LAYER from '../../../deckit-sdk/shell/ui/layer/index.js';
import * as TOKEN from '../../../deckit-sdk/shell/ui/token/index.js';
import * as MOD_STYLE from '../../../deckit-sdk/shell/style/renderer.js';
import * as LAYOUT from './model/layout.js';
import * as MOTION from './model/motion.js';
import * as PAGE from './model/page-name.js';
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as DOCK from '../dock/view.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// Each frame's surface is the window grown by its shadow: the window's material at its middle, the title bar of a
// titled window at its top, the edges that resize it just outside it, as model/layout.js partsOf has them.
const { SHADOW, EDGE, RADIUS, BUTTON } = LAYOUT;
// How wide the holder's colour is drawn round a window's title bar, a seat's cursor, and the ring at its press, px.
const HOLDER = 2;
const CURSOR = 16;
const RING = 20;
// The path of everything a seat's mark may be drawn in, from which what covers it is taken out.
const EVERYWHERE = 'M-100000 -100000H100000V100000H-100000Z';
// How high the bar that says whose view the page shows is, px.
const FOLLOWING = 22;
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
        background: color-mix(in srgb, var(--deckit-elevated) var(--deckit-glass), transparent);
        box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
    }
    .deckit-window-material {
        position: fixed;
        inset: ${SHADOW}px;
        border-radius: ${RADIUS}px;
        background: var(--deckit-background);
        box-shadow: var(--deckit-shadow-inactive);
        transition: box-shadow var(--deckit-press-fade) var(--deckit-press-curve);
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
    .deckit-window-holder {
        position: fixed;
        top: ${SHADOW - HOLDER}px;
        left: ${SHADOW - HOLDER}px;
        right: ${SHADOW - HOLDER}px;
        box-sizing: border-box;
        border: ${HOLDER}px solid var(--deckit-seat);
        border-bottom: 0;
        border-radius: ${RADIUS + HOLDER}px ${RADIUS + HOLDER}px 0 0;
        mask-image: linear-gradient(#000 40%, transparent);
        pointer-events: none;
    }
    .deckit-window-holder[hidden] { display: none; }
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
    .deckit-drop {
        position: fixed;
        box-sizing: border-box;
        border-radius: ${RADIUS}px;
        background: color-mix(in srgb, var(--deckit-accent) 16%, transparent);
        box-shadow: var(--deckit-rim), inset 0 0 0 1px color-mix(in srgb, var(--deckit-accent) 48%, transparent);
        opacity: 0;
        transform: scale(${MOTION.SCALE});
        pointer-events: none;
        transition:
            opacity var(--deckit-exit-fade) var(--deckit-exit-curve),
            transform var(--deckit-exit) var(--deckit-exit-curve);
    }
    .deckit-seats, .deckit-seat-cursors { position: fixed; inset: 0; overflow: hidden; pointer-events: none; }
    .deckit-seat-cursor {
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: flex-start;
        color: var(--deckit-seat);
        transition: opacity var(--deckit-exit-fade) var(--deckit-exit-curve);
    }
    .deckit-seat-cursor[data-glide] {
        transition:
            transform var(--deckit-move) var(--deckit-move-curve),
            opacity var(--deckit-exit-fade) var(--deckit-exit-curve);
    }
    .deckit-seat-clips { position: absolute; width: 0; height: 0; }
    .deckit-seat-arrow {
        flex: none;
        width: ${CURSOR}px;
        height: ${CURSOR}px;
        transform-origin: 0 0;
        filter: var(--deckit-shadow-icon);
        transition: transform var(--deckit-press) var(--deckit-press-curve);
    }
    .deckit-seat-cursor[data-held] .deckit-seat-arrow { transform: scale(0.85); }
    .deckit-seat-name {
        margin: ${CURSOR - 4}px 0 0 2px;
        padding: 1px 6px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-seat);
        box-shadow: var(--deckit-shadow-control);
        color: var(--deckit-background);
        font: var(--deckit-type-caption);
        font-weight: 600;
        white-space: nowrap;
        opacity: 0;
        transform: scale(${MOTION.SCALE});
        transform-origin: 0 0;
        transition:
            opacity var(--deckit-exit-fade) var(--deckit-exit-curve),
            transform var(--deckit-exit) var(--deckit-exit-curve);
    }
    .deckit-seat-cursor[data-named] .deckit-seat-name {
        opacity: 1;
        transform: none;
        transition:
            opacity var(--deckit-enter-fade) var(--deckit-enter-curve),
            transform var(--deckit-enter) var(--deckit-enter-curve);
    }
    .deckit-seat-focus, .deckit-seat-bar {
        position: absolute;
        top: 0;
        left: 0;
        box-sizing: border-box;
        transition: transform var(--deckit-move) var(--deckit-move-curve);
    }
    .deckit-seat-focus { border: 0 solid var(--deckit-seat); }
    .deckit-seat-bar { background: var(--deckit-seat); opacity: 0.3; }
    .deckit-seat-bar[data-caret] { opacity: 1; }
    .deckit-seat-tick { position: absolute; left: ${-CURSOR}px; top: 0; width: 12px; height: 12px; }
    .deckit-seat-tick[data-way='up'] { transform: rotate(180deg); }
    .deckit-seat-tick[data-way='left'] { transform: rotate(90deg); }
    .deckit-seat-tick[data-way='right'] { transform: rotate(-90deg); }
    .deckit-seat-press {
        position: absolute;
        top: 0;
        left: 0;
        color: var(--deckit-seat);
        transition: opacity var(--deckit-exit-fade) var(--deckit-exit-curve);
    }
    .deckit-seat-press[data-leaving] { opacity: 0; }
    .deckit-seat-ring {
        position: absolute;
        left: ${-RING / 2}px;
        top: ${-RING / 2}px;
        box-sizing: border-box;
        width: ${RING}px;
        height: ${RING}px;
        border: 2px solid currentColor;
        border-radius: var(--deckit-radius-round);
        background: color-mix(in srgb, currentColor 16%, transparent);
    }
    .deckit-seat-drag {
        position: absolute;
        left: 0;
        top: -1px;
        height: 2px;
        border-radius: var(--deckit-radius-round);
        background: color-mix(in srgb, currentColor 60%, transparent);
        transform-origin: 0 50%;
    }
    .deckit-following { position: fixed; inset: 0; color: var(--deckit-seat); }
    .deckit-following::after {
        content: '';
        position: absolute;
        inset: 0;
        border: ${HOLDER}px solid currentColor;
        pointer-events: none;
    }
    .deckit-following-bar {
        position: absolute;
        left: 50%;
        display: flex;
        align-items: center;
        gap: 8px;
        box-sizing: border-box;
        height: ${FOLLOWING}px;
        padding: 0 12px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-seat);
        box-shadow: var(--deckit-shadow-control);
        color: var(--deckit-background);
        font: var(--deckit-type-caption);
        font-weight: 600;
        white-space: nowrap;
        transform: translateX(-50%);
    }
    .deckit-following-hint { font-weight: 400; }
    .deckit-drop[data-shown] {
        opacity: 1;
        transform: none;
        transition:
            opacity var(--deckit-enter-fade) var(--deckit-enter-curve),
            transform var(--deckit-enter) var(--deckit-enter-curve);
    }
`;
const LABELS = Object.freeze({ close: 'Close', minimize: 'Minimize', zoom: 'Zoom' });
// The glyph each button shows while the pointer is over them.
const GLYPHS = Object.freeze({
    close: 'M2 2l4 4M6 2L2 6',
    minimize: 'M1.5 4h5',
    zoom: 'M4 1.5v5M1.5 4h5',
});
const ARROW =
    `<svg class="deckit-seat-arrow" viewBox="0 0 16 16" fill="currentColor" style="stroke: var(--deckit-background)" ` +
    'stroke-linejoin="round"><path d="M1.5 1.5l4.6 12.2 2-5.6 5.6-2z"/></svg>';
const TICK =
    '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round"><path d="M2.5 4.5l3.5 3.5 3.5-3.5"/></svg>';
const SVG = 'http://www.w3.org/2000/svg';
const EDGES = Object.freeze(['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']);

// MARK: - Initializer
// MARK: - Public
// The desktop, in the desktop's own page: the backdrop under every window, each window's frame under its content and
// its buttons over it, and the seats' cursors over everything on the stage, each a document this page opens beside
// itself and main lays where it belongs. The page itself is laid over the whole desktop, with the Dock at its left edge
// and the host window's bar at its top, an empty strip that drags the host window, its controls in it, the backdrop
// showing through. Under each panel window in that strip it draws the panel's material: the backdrop is cut away there,
// so the host window's own material shows through the panel's tint, opaque where the person asks for less transparency.
// Main lays a material under the page where it draws glass: the Dock's card while it is out and still, and each panel's
// material at its frame, so what lies under them in the host window is blurred too, none where
// the person asks for less transparency. It takes the pointer only in the strip, or over all of it once deckit's core
// is down, with a note that asks for a restart. `channels` binds the desktop's and the Dock's channels in the page.
function boot(theme, channels) {
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const ui = KIT.make(theme, { fonts: FONTS.installed({ channels }) });
    KIT.addStyle(STYLE);
    let { state } = PROTOCOL.setup.invoke();
    const drawn = new Map(); // a window's id -> { material, buttons, off }, its frame's parts as drawn
    const materials = new Map(); // a panel window's id -> { element }, the material drawn under it
    const glass = { dock: null, panels: [] }; // where the page draws glass: the Dock's card, the panels
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
    const drop = element(document, 'div', 'deckit-drop');
    const seats = element(document, 'div', 'deckit-seats');
    // What marks a seat on the screen is drawn in a document of its own, laid over everything on the stage, where it
    // takes no pointer and no keyboard: so a cursor shows on a panel window and on what a page presents over itself.
    const over = surface(PAGE.CURSORS);
    const seatsOver = element(over.document, 'div', 'deckit-seats');
    const pointers = element(over.document, 'div', 'deckit-seat-cursors');
    // The clip paths that cut what marks a seat by what covers it, each by its name.
    const clips = over.document.createElementNS(SVG, 'svg');
    clips.setAttribute('class', 'deckit-seat-clips');
    over.document.body.append(seatsOver, pointers, clips);
    let clipped = 0; // how many marks were given clip paths, each naming its own by its number
    const cursors = new Map(); // a seat's id -> { element, name, press }, its cursor and its press while it holds one
    const typings = new Map(); // a seat's id -> { ring, bars, over }, the ring and the bars drawn where it types
    // Over all but the host's bar while the page shows another seat's view: it takes every press, so none reaches
    // what the page draws, and says whose view it is, in the middle of the host's bar, over no window, or at the
    // desktop's top where the host has no bar.
    const following = element(document, 'div', 'deckit-following');
    const followingBar = element(document, 'div', 'deckit-following-bar');
    followingBar.setAttribute('role', 'status');
    const followingName = element(document, 'span', 'deckit-following-name');
    const followingHint = element(document, 'span', 'deckit-following-hint');
    followingHint.textContent = 'Press or type to return';
    followingBar.append(followingName, followingHint);
    following.append(followingBar);
    document.body.append(drop, seats, dock.element, following, strip, down);
    let dropped = null; // the tile the drop shows, or null
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const tellMotion = () => PROTOCOL.motion.send({ reduced: reduced.matches });
    reduced.addEventListener('change', tellMotion);
    tellMotion();

    MOD_STYLE.wear({ channels, onChange: () => LAYER.dress() });
    TOKEN.whenOpaque(tellGlass);
    draw();
    PROTOCOL.state.on((next) => {
        state = next;
        draw();
    });
    PROTOCOL.seat.on(pointed);

    function draw() {
        strip.style.height = state.strip.height + 'px';
        drawDrop(state.drop);
        drawPanels(state.panels);
        drawSeats(state.seats);
        following.hidden = !state.following;
        if (state.following) {
            following.style.setProperty('--deckit-seat', `var(--deckit-seat-${state.following.colour})`);
            followingBar.style.top = Math.max(8, Math.round((state.strip.height - FOLLOWING) / 2)) + 'px';
            followingName.textContent = `Following ${state.following.name}`;
        }
        dock.setTop(state.strip.height);
        dock.update(state.dock);
        // The page of a desktop down fades in, a rare sign of the system's own; it goes at once once it is back.
        if (state.down && down.hidden) ui.motion.appear(down);
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
            const { material, holder, bar, text, buttons, edges } = drawn.get(window.id);
            const laid = window.bar;
            holder.hidden = !window.holder;
            holder.style.height = laid.height + 'px';
            holder.style.setProperty('--deckit-seat', `var(--deckit-seat-${window.holder})`);
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

    // Each panel window's material at its frame, rounded by its `radius`, and the backdrop cut away under it.
    function drawPanels(panels) {
        const open = new Set(panels.map(({ id }) => id));
        for (const [id, material] of materials) {
            if (open.has(id)) continue;
            materials.delete(id);
            material.element.remove();
        }
        for (const { id, frame, radius } of panels) {
            if (!materials.has(id)) {
                const made = { element: element(document, 'div', 'deckit-panel-material') };
                document.body.insertBefore(made.element, strip);
                materials.set(id, made);
            }
            Object.assign(materials.get(id).element.style, {
                left: frame.x + 'px',
                top: frame.y + 'px',
                width: frame.width + 'px',
                height: frame.height + 'px',
                borderRadius: radius + 'px',
            });
        }
        const holes = panels.map(({ frame, radius }) => {
            const { x, y, width, height } = frame;
            const shape =
                `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
                `<rect width="${width}" height="${height}" rx="${radius}"/></svg>`;
            return { image: `url("data:image/svg+xml,${encodeURIComponent(shape)}")`, at: `${x}px ${y}px` };
        });
        glass.panels = panels.map(({ frame, radius }) => ({ material: 'popover', ...frame, cornerRadius: radius }));
        tellGlass();
        const masked = holes.length > 0;
        const { style } = backdropRoot;
        const set = (name, values) =>
            masked ? style.setProperty(name, values.join(', ')) : style.removeProperty(name);
        set('mask-image', [...holes.map(({ image }) => image), 'linear-gradient(#000, #000)']);
        set('mask-position', [...holes.map(({ at }) => at), '0 0']);
        set('mask-size', [...panels.map(({ frame }) => `${frame.width}px ${frame.height}px`), '100% 100%']);
        set('mask-repeat', ['no-repeat']);
        set('mask-composite', [...holes.map(() => 'exclude'), 'add']);
    }

    // A cursor for each seat but the one shown, in the cursors' surface: an arrow in the seat's colour at its pointer,
    // cut by what the state says it is under, its user's name beside it while the state says it shows, folded to the
    // arrow alone while not.
    function drawSeats(all) {
        const seen = new Map(all.filter(({ shown, at }) => !shown && at).map((seat) => [seat.id, seat]));
        for (const [id, cursor] of cursors) {
            if (seen.has(id)) continue;
            unclipped(cursor.element).remove();
            if (cursor.press) unclipped(cursor.press).remove();
            cursors.delete(id);
        }
        for (const { id, name, colour, at, buttons, under, named } of seen.values()) {
            if (!cursors.has(id)) {
                const made = { element: element(over.document, 'div', 'deckit-seat-cursor'), press: null };
                made.element.innerHTML = ARROW;
                made.name = element(over.document, 'span', 'deckit-seat-name');
                made.element.append(made.name);
                pointers.append(made.element);
                cursors.set(id, made);
            }
            const cursor = cursors.get(id);
            cursor.colour = `var(--deckit-seat-${colour})`;
            cursor.element.style.setProperty('--deckit-seat', cursor.colour);
            cursor.element.dataset.seat = id;
            cursor.name.textContent = name;
            put(cursor, { ...at, buttons, under, named });
        }
        drawTypings(all);
    }

    // Where each seat types in a window that does not have the machine's keyboard, in this page, over the windows, or,
    // where the state says `over`, in the cursors' surface under the cursors: the ring the state says, in the seat's
    // colour, its line as wide and its corners as round as told, and a bar in that colour at its caret, 2 px wide, or
    // over each rect of what is selected in it. The ring goes to another place by the `move` spring, and is made anew
    // as `over` changes.
    function drawTypings(all) {
        const seen = new Map(all.filter(({ typing }) => typing).map((seat) => [seat.id, seat]));
        for (const [id, drawn] of typings) {
            if (seen.get(id)?.typing.over === drawn.over) continue;
            for (const each of [drawn.ring, ...drawn.bars]) each.remove();
            typings.delete(id);
        }
        const place = (made, { x, y, width, height }) =>
            Object.assign(made.style, {
                transform: `translate(${x}px, ${y}px)`,
                width: `${width}px`,
                height: `${height}px`,
            });
        for (const { id, colour, typing } of seen.values()) {
            if (!typings.has(id)) {
                const root = typing.over ? seatsOver : seats;
                const ring = element(root.ownerDocument, 'div', 'deckit-seat-focus');
                ring.dataset.seat = id;
                root.insertBefore(ring, root.firstChild);
                typings.set(id, { ring, bars: [], over: typing.over });
            }
            const drawn = typings.get(id);
            const { ring, bars } = typing;
            drawn.ring.style.setProperty('--deckit-seat', `var(--deckit-seat-${colour})`);
            place(drawn.ring, ring);
            Object.assign(drawn.ring.style, { borderWidth: `${ring.line}px`, borderRadius: `${ring.radius}px` });
            for (const gone of drawn.bars.splice(bars.length)) gone.remove();
            bars.forEach((bar, at) => {
                if (!drawn.bars[at]) {
                    drawn.bars[at] = element(drawn.ring.ownerDocument, 'div', 'deckit-seat-bar');
                    drawn.bars[at].dataset.seat = id;
                    drawn.ring.after(drawn.bars[at]);
                }
                drawn.bars[at].style.setProperty('--deckit-seat', `var(--deckit-seat-${colour})`);
                drawn.bars[at].toggleAttribute('data-caret', typing.caret);
                place(drawn.bars[at], typing.caret ? { ...bar, x: bar.x - 1, width: 2 } : bar);
            });
        }
    }

    // What a seat's pointer just did, or that it rests, drawn as it comes: the cursor is there at once, so one that
    // moves is where its pointer is, or gliding by the `move` spring where the event says `glide`. A scroll shows a
    // tick beside it, pointing its way, that fades.
    function pointed({ id, type, x, y, buttons, under, named, glide, dx = 0, dy = 0 }) {
        const told = state.seats.find((seat) => seat.id === id);
        if (!told || told.shown) return;
        if (!cursors.has(id)) drawSeats(state.seats.map((seat) => (seat === told ? { ...seat, at: { x, y } } : seat)));
        const cursor = cursors.get(id);
        cursor.element.toggleAttribute('data-glide', glide);
        put(cursor, { x, y, buttons, under, named });
        if (type !== 'scroll') return;
        cursor.element.querySelector('.deckit-seat-tick')?.remove();
        const tick = element(over.document, 'span', 'deckit-seat-tick');
        tick.innerHTML = TICK;
        tick.dataset.way = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
        cursor.element.append(tick);
        const { fade, easing } = TOKEN.MOTION.exit;
        tick.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing, fill: 'forwards' });
        finished(tick, () => tick.remove());
    }

    // A cursor at a point with the buttons it holds, cut by what it is `under`, its name shown or folded: a press
    // leaves a ring where it began, which stays while a button is held, the line of the drag running from it to the
    // cursor, both cut as the cursor is, and both fade as the last button is let go, cut as they last were.
    function put(cursor, { x, y, buttons, under, named }) {
        const held = buttons.length > 0;
        cursor.element.toggleAttribute('data-held', held);
        cursor.element.toggleAttribute('data-named', named);
        cursor.element.style.transform = `translate(${x}px, ${y}px)`;
        clip(cursor.element, under, { x, y });
        if (held && !cursor.press) {
            const press = element(over.document, 'div', 'deckit-seat-press');
            press.style.setProperty('--deckit-seat', cursor.colour);
            press.style.transform = `translate(${x}px, ${y}px)`;
            const ring = element(over.document, 'div', 'deckit-seat-ring');
            press.append(element(over.document, 'div', 'deckit-seat-drag'), ring);
            pointers.insertBefore(press, pointers.firstChild);
            const { length, easing } = TOKEN.MOTION.press;
            if (length)
                ring.animate([{ transform: 'scale(0.5)' }, { transform: 'none' }], { duration: length, easing });
            cursor.press = Object.assign(press, { from: { x, y } });
        }
        if (!cursor.press) return;
        const { from } = cursor.press;
        const line = cursor.press.firstChild;
        line.style.width = Math.hypot(x - from.x, y - from.y) + 'px';
        line.style.transform = `rotate(${Math.atan2(y - from.y, x - from.x)}rad)`;
        if (held) return clip(cursor.press, under, from);
        const gone = cursor.press;
        cursor.press = null;
        gone.toggleAttribute('data-leaving', true);
        finished(gone, () => unclipped(gone).remove());
    }

    // `made`, drawn from `at` on the stage, shows nothing of itself inside the rects of `under`, `[{ x, y, width,
    // height, radius }]` on the stage, and nothing at all for null. Each rect is taken out by a clip path of its own,
    // the next one clipping it, so rects that overlap take out all they cover.
    function clip(made, under, at) {
        made.clips ??= { name: `deckit-seat-clip-${(clipped += 1)}`, links: [] };
        const { name, links } = made.clips;
        const rects = under ?? [];
        for (const gone of links.splice(rects.length)) gone.remove();
        rects.forEach((rect, nth) => {
            if (!links[nth]) {
                links[nth] = over.document.createElementNS(SVG, 'clipPath');
                links[nth].id = `${name}-${nth}`;
                links[nth].append(over.document.createElementNS(SVG, 'path'));
                links[nth].firstChild.setAttribute('clip-rule', 'evenodd');
                clips.append(links[nth]);
            }
            links[nth].firstChild.setAttribute('d', EVERYWHERE + rounded(rect, at));
            if (nth + 1 < rects.length) links[nth].setAttribute('clip-path', `url(#${name}-${nth + 1})`);
            else links[nth].removeAttribute('clip-path');
        });
        made.style.clipPath = under === null ? 'inset(50%)' : rects.length ? `url(#${name}-0)` : '';
    }

    // `made` with no clip path left of it.
    function unclipped(made) {
        for (const gone of made.clips?.links ?? []) gone.remove();
        return made;
    }

    // The path of a rect of the stage with round corners, as it lies from `at`.
    function rounded({ x, y, width, height, radius }, at) {
        const r = Math.max(0, Math.min(radius, width / 2, height / 2));
        const [left, top] = [x - at.x, y - at.y];
        const arc = (dx, dy) => `a${r} ${r} 0 0 1 ${dx} ${dy}`;
        return (
            `M${left + r} ${top}h${width - 2 * r}${arc(r, r)}v${height - 2 * r}${arc(-r, r)}` +
            `h${2 * r - width}${arc(-r, -r)}v${2 * r - height}${arc(r, -r)}Z`
        );
    }

    // The tile a window dragged by its title bar takes let go now, drawn at its frame over the windows: it grows in
    // from a little smaller at the side the pointer is at as it comes, goes from one tile to the next by the `move`
    // spring from where it stands, and shrinks back out as the pointer leaves the side or the drag ends.
    function drawDrop(next) {
        const tile = next?.tile ?? null;
        if (tile === dropped) return;
        const was = dropped && drop.getBoundingClientRect();
        dropped = tile;
        drop.toggleAttribute('data-shown', !!tile);
        if (!tile) return;
        const { x, y, width, height } = next.frame;
        const sides = tile.split('-');
        const across = sides.includes('left') ? 'left' : sides.includes('right') ? 'right' : 'center';
        const down = sides.includes('top') || tile === 'fill' ? 'top' : sides.includes('bottom') ? 'bottom' : 'center';
        Object.assign(drop.style, {
            left: x + 'px',
            top: y + 'px',
            width: width + 'px',
            height: height + 'px',
            transformOrigin: `${across} ${down}`,
        });
        if (!was) return;
        const { length, easing } = TOKEN.MOTION.over('move', Math.hypot(was.left - x, was.top - y, was.width - width));
        if (!length) return;
        const from =
            `translate(${was.left - x}px, ${was.top - y}px) ` + `scale(${was.width / width}, ${was.height / height})`;
        drop.animate(
            [
                { transformOrigin: '0 0', transform: from },
                { transformOrigin: '0 0', transform: 'none' },
            ],
            {
                duration: length,
                easing,
            }
        );
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
        const holder = element(frame.document, 'div', 'deckit-window-holder');
        const bar = element(frame.document, 'div', 'deckit-window-title');
        const text = element(frame.document, 'span', 'deckit-window-title-text');
        bar.append(text);
        forward(id, bar, () => 'bar', { takes: true });
        const edges = EDGES.map((edge) => {
            const band = element(frame.document, 'div', 'deckit-window-edge');
            band.dataset.edge = edge;
            forward(id, band, () => edge, { takes: true });
            return band;
        });
        frame.document.body.append(material, holder, bar, ...edges);

        const held = surface(PAGE.buttonsOf(id));
        const buttons = element(held.document, 'div', 'deckit-window-buttons');
        const under = ({ clientX, clientY }) =>
            held.document.elementFromPoint(clientX, clientY)?.closest('[data-button]')?.dataset.button ?? 'buttons';
        forward(id, buttons, under);
        LAYOUT.BUTTONS.forEach((name) => {
            const button = element(held.document, 'button', 'deckit-window-button');
            button.type = 'button';
            button.dataset.button = name;
            button.title = LABELS[name];
            button.setAttribute('aria-label', LABELS[name]);
            button.innerHTML =
                '<svg viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round">' +
                `<path d="${GLYPHS[name]}"/></svg>`;
            // A button the keyboard clicks is pressed and let go where it is.
            button.addEventListener('click', ({ detail }) => {
                if (detail !== 0) return;
                for (const type of ['down', 'up'])
                    PROTOCOL.pointer.send({ id, part: name, type, x: 0, y: 0, button: 0 });
            });
            buttons.append(button);
        });
        held.document.body.append(buttons);
        return { material, holder, bar, text, buttons, edges, off: [frame.off, held.off] };
    }

    // What the pointer does on `node`, a part of the window `id`, told to main as it does it: its press there, and
    // with the button held, each move and the up, wherever it goes, read on the screen as the surface moves with the
    // frame. `partOf(event)` names the part under it. A part that `takes` its press leaves the document none of it.
    function forward(id, node, partOf, { takes = false } = {}) {
        const send = (type, event, more = {}) =>
            PROTOCOL.pointer.send({
                id,
                part: partOf(event),
                type,
                x: event.screenX,
                y: event.screenY,
                button: event.button,
                ...more,
            });
        const held = (event) => node.hasPointerCapture(event.pointerId);
        node.addEventListener('pointerdown', (down) => {
            if (takes) down.preventDefault();
            node.setPointerCapture(down.pointerId);
            send('down', down, { count: down.detail, grabX: down.clientX - SHADOW, grabY: down.clientY - SHADOW });
        });
        node.addEventListener('pointermove', (event) => held(event) && send('move', event));
        for (const ends of ['pointerup', 'pointercancel'])
            node.addEventListener(ends, (event) => held(event) && send('up', event));
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
