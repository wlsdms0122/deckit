import * as KIT from '../ui/kit/index.js';
import * as GESTURE from '../ui/gesture/index.js';
import * as MOD_STYLE from '../style/renderer.js';
import * as SIDEBAR from './sidebar.js';
import * as WIDTH from './model/width.js';
import * as PROTOCOL from './protocol.js';

// MARK: - Property
// The card's inset from the panel's edges, and how far the handle stands past it, over the content's edge.
const INSET = 8;
const HANDLE_OUT = 6;
const HANDLE = { width: 16, height: 64 };
// Folded, the handle stays at the panel's edge, this far in.
const HANDLE_FOLDED = 3;
// The card's surface, drawn in the content's ink rather than the sidebar colour, which is chosen against a
// sidebar fill: white over a dark ground, black over a light one.
const SURFACE = `:root {
    --deckit-sidebar-top: light-dark(rgba(0,0,0,.03), rgba(255,255,255,.045));
    --deckit-sidebar-bottom: light-dark(rgba(0,0,0,.015), rgba(255,255,255,.025));
    --deckit-sidebar-rim: light-dark(rgba(0,0,0,.08), rgba(255,255,255,.1));
    --deckit-sidebar-shadow: inset 0 1px 0 light-dark(rgba(255,255,255,.8), rgba(255,255,255,.09)),
        0 1px 2px light-dark(rgba(0,0,0,.08), rgba(0,0,0,.35)), 0 10px 28px light-dark(rgba(0,0,0,.1), rgba(0,0,0,.32));
}`;
const STYLE = `
    .deckit-panel { position: fixed; left: 0; top: 0; overflow: hidden; color: var(--deckit-text); font: 15px var(--deckit-font); }
    .deckit-panel-backdrop { inset: 0; box-sizing: border-box; }
    .deckit-panel-buttons { position: absolute; top: 0; left: 0; -webkit-app-region: drag; }
    .deckit-sidebar {
        position: absolute;
        box-sizing: border-box;
        overflow: hidden;
        border: 1px solid transparent;
        border-radius: var(--deckit-radius-card);
    }
    .deckit-sidebar-card {
        border-color: var(--deckit-sidebar-rim);
        background: linear-gradient(180deg, var(--deckit-sidebar-top), var(--deckit-sidebar-bottom));
        box-shadow: var(--deckit-sidebar-shadow);
    }
    .deckit-sidebar-title-bar { position: absolute; top: 0; left: 0; right: 0; -webkit-app-region: drag; }
    .deckit-sidebar-handle {
        position: fixed;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: col-resize;
    }
    .deckit-sidebar-handle[aria-expanded='false'] { cursor: pointer; }
    .deckit-sidebar-handle::before {
        content: '';
        width: 4px;
        height: 36px;
        border-radius: var(--deckit-radius-round);
        background: var(--deckit-disabled);
        transition:
            background-color var(--deckit-fast) var(--deckit-easing),
            height var(--deckit-fast) var(--deckit-easing),
            width var(--deckit-fast) var(--deckit-easing);
    }
    .deckit-sidebar-handle:hover::before,
    .deckit-sidebar-handle[data-dragging]::before { width: 5px; height: 48px; background: var(--deckit-muted); }
`;

// MARK: - Initializer
// MARK: - Public
// The panel's frame, in the panel's own page: the mods' list, the card under it and the window's buttons'
// room. This page covers only the frame's top over the mod on screen; what lies under the mod, the glass and
// the card, is drawn in the backdrop, and the width's handle in a surface of its own, both opened from here, so
// one pass changes all three. Where the parts land is told to main, which lays the views and the mods' rooms
// by it.
function boot(theme) {
    const ui = KIT.make(theme);
    KIT.addStyle(SURFACE + STYLE);
    const setup = PROTOCOL.frameSetup.invoke();
    const { motion: MOTION } = theme;
    let { look, state } = setup;
    let open = setup.shown;
    let width = null; // the width a drag of the handle draws, until main keeps it
    let leaving = null;
    let returning = null; // brings the handle back once the card has moved
    let sent = '';

    const backdrop = surface('backdrop');
    const grip = surface('handle');
    const backdropRoot = element(backdrop.document, 'div', 'deckit-panel deckit-panel-backdrop');
    const backdropCard = element(backdrop.document, 'div', 'deckit-sidebar deckit-sidebar-card');
    backdropRoot.append(backdropCard);
    backdrop.document.body.append(backdropRoot);

    const root = element(document, 'div', 'deckit-panel');
    const card = element(document, 'div', 'deckit-sidebar');
    const titleBarRoom = element(document, 'div', 'deckit-sidebar-title-bar');
    // Where the window's buttons stand is the panel's, whatever is drawn there: it drags the window, so the
    // window can be moved however the mod on screen draws its top.
    const buttonsRoom = element(document, 'div', 'deckit-panel-buttons');
    const sidebar = SIDEBAR.make({
        ui,
        chordOf: (action) => state.chords[action] || '',
        onPick: (id) => PROTOCOL.pick.send({ id }),
        onStep: (by) => PROTOCOL.step.send({ by }),
        onReorder: (ids) => PROTOCOL.reorder.send({ ids }),
        onLayout: (change) => PROTOCOL.layout.send(change),
        onMove: () => report(false),
    });
    card.append(sidebar.element, titleBarRoom);
    root.append(card, buttonsRoom);
    document.body.append(root);

    const handle = element(grip.document, 'button', 'deckit-sidebar-handle');
    handle.type = 'button';
    grip.document.body.append(handle);
    drag();

    dressSurfaces();
    theme.onChange(dressSurfaces);
    MOD_STYLE.wear({ onChange: dressSurfaces });
    sidebar.update(state);
    dress();
    apply(false);
    if (open) enterAtOnce();

    PROTOCOL.state.on((next) => {
        const moved = next.frame.collapsed !== state.frame.collapsed || next.frame.width !== state.frame.width;
        state = next;
        width = null;
        sidebar.update(state);
        apply(moved);
    });
    PROTOCOL.look.on((next) => {
        look = next;
        dress();
        apply(false);
    });
    PROTOCOL.visible.on(({ open: on, animate }) => {
        if (open === on) return;
        open = on;
        if (!animate) {
            if (on) enterAtOnce();
            return;
        }
        if (on) fadeIn();
        else fadeOut(() => {});
    });
    // Main waits for the frame's exit before it takes the panel off screen, or moves it, so neither is seen as a
    // flicker. An entrance cancels an exit under way, which is then never answered.
    PROTOCOL.exit.handle(
        () =>
            new Promise((resolve) => {
                if (!open) return resolve();
                open = false;
                fadeOut(resolve);
            })
    );
    PROTOCOL.play.on(({ direction }) => (direction === 'out' ? fadeOut(() => {}) : fadeIn()));
    PROTOCOL.leave.handle(() => new Promise((resolve) => fadeOut(resolve)));

    // A document of this page's, laid where main puts it. It draws nothing of its own: what is in it is drawn from
    // here, in this page's styles.
    function surface(name) {
        const opened = window.open('', name);
        const style = opened.document.createElement('style');
        opened.document.head.append(style);
        return { window: opened, document: opened.document, style };
    }

    // A style sheet made here cannot be taken by another document, so the surfaces wear a copy of the rules.
    function dressSurfaces() {
        const rules = document.adoptedStyleSheets
            .flatMap((sheet) => [...sheet.cssRules].map((rule) => rule.cssText))
            .join('\n');
        for (const { document: page, style } of [backdrop, grip]) {
            style.textContent = rules;
            page.documentElement.style.colorScheme = document.documentElement.style.colorScheme;
        }
    }

    // Floating over an app, the ring makes the panel read as on top and the rounding needs the page behind to be
    // clear. Filling a window, the frame is the OS's, and the panel may share the window's top with its title bar:
    // the card reaches up under it, and holds what it lists from below it.
    function dress() {
        const bar = look.titleBar;
        Object.assign(backdropRoot.style, {
            background: `color-mix(in srgb, var(--deckit-background) ${setup.glass * 100}%, transparent)`,
            border: look.floating ? '1px solid rgba(255,255,255,.14)' : '0',
            borderRadius: look.floating ? '12px' : '0',
        });
        root.style.borderRadius = look.floating ? '12px' : '0';
        Object.assign(buttonsRoom.style, {
            display: bar ? 'block' : 'none',
            width: (bar?.controlsWidth || 0) + 'px',
            height: (bar?.height || 0) + 'px',
        });
        const room = bar ? Math.max(0, bar.height - INSET) : 0;
        sidebar.setTop(room);
        titleBarRoom.style.height = room + 'px';
    }

    // The card in both documents, at once, then where it all lands told to main. Folding animates width, a
    // layout property, so the mod's content is laid out again each frame; a transform would make it jump to its
    // final width instead.
    function apply(animate) {
        const { panel, card: box, collapsed, drawn } = geometry();
        const transition = animate
            ? ['left', 'width', 'opacity'].map((property) => `${property} ${MOTION.base}ms ${MOTION.easing}`).join(', ')
            : 'none';
        for (const each of [card, backdropCard])
            Object.assign(each.style, {
                transition,
                left: box.x + 'px',
                top: box.y + 'px',
                width: box.width + 'px',
                height: box.height + 'px',
                // Folded, the rim would still leave a sliver at the edge.
                borderWidth: collapsed ? '0px' : '1px',
                opacity: collapsed ? '0' : '1',
            });
        // The card animates its width while what it holds keeps its own, so the list does not reflow against its
        // minimum widths every frame.
        sidebar.element.style.width = drawn + 'px';
        Object.assign(root.style, { width: panel.width + 'px', height: panel.height + 'px' });
        handle.title = collapsed ? 'Show sidebar' : 'Hide sidebar · drag to resize';
        handle.setAttribute('aria-label', handle.title);
        handle.setAttribute('aria-expanded', String(!collapsed));
        // The handle's surface moves at once: it is out of sight until the card has.
        if (animate) {
            clearTimeout(returning);
            Object.assign(handle.style, { transition: 'none', opacity: '0' });
            returning = setTimeout(() => {
                handle.style.transition = `opacity ${MOTION.fast}ms ${MOTION.easing}`;
                handle.style.opacity = '1';
            }, MOTION.base);
        }
        report(animate);
    }

    // Told only when it changed. The card does not move up or down, so the slot's top and height are read off the
    // layout, under any transform the entrance plays; across, the card animates, so its place is the one it goes to.
    function report(animate) {
        const { panel, card: box, collapsed } = geometry();
        const bar = look.titleBar;
        const border = collapsed ? 0 : 1;
        const laid = sidebar.slot.getBoundingClientRect();
        const slot = {
            x: box.x + border,
            y: laid.top,
            width: Math.max(0, box.width - 2 * border),
            height: laid.height,
        };
        const contentX = collapsed ? 0 : box.x + box.width + INSET;
        const content = { x: contentX, y: 0, width: Math.max(0, panel.width - contentX), height: panel.height };
        const handleRect = {
            x: collapsed ? HANDLE_FOLDED : contentX + HANDLE_OUT - HANDLE.width / 2,
            y: (panel.height - HANDLE.height) / 2,
            ...HANDLE,
        };
        const overlay = {
            x: 0,
            y: 0,
            width: Math.max(collapsed ? 0 : box.x + box.width, bar?.controlsWidth || 0),
            height: Math.max(collapsed ? 0 : slot.y, bar?.height || 0),
        };
        const rects = Object.fromEntries(
            Object.entries({ overlay, slot, content, handle: handleRect }).map(([name, rect]) => [name, rounded(rect)])
        );
        const written = JSON.stringify(rects);
        if (written === sent) return;
        sent = written;
        PROTOCOL.rects.send({
            ...rects,
            animation: animate ? { duration: MOTION.base, easing: MOTION.easing } : null,
        });
    }

    // Where the card goes: `drawn` is its width open, which what it holds keeps while it folds.
    function geometry() {
        const { size: panel } = look;
        const { collapsed } = state.frame;
        const drawn = WIDTH.fitted(width ?? state.frame.width, panel.width);
        const inset = collapsed ? 0 : INSET;
        return {
            panel,
            collapsed,
            drawn,
            card: { x: inset, y: INSET, width: collapsed ? 0 : drawn, height: Math.max(0, panel.height - 2 * INSET) },
        };
    }

    // The handle's surface moves as the card does, so a press is read on the screen and not in the surface.
    // Folded, a press is only a click: a drag that folded or opened the card would animate its width under the
    // pointer.
    function drag() {
        let travelled = false;
        handle.addEventListener('pointerdown', (down) => {
            if (down.button !== 0) return;
            down.preventDefault();
            const start = down.screenX;
            const from = geometry().drawn;
            const sizing = !state.frame.collapsed;
            let moving = false;
            travelled = false;
            handle.setPointerCapture(down.pointerId);
            const move = (event) => {
                const delta = event.screenX - start;
                if (!moving) {
                    if (Math.abs(delta) < GESTURE.SLOP) return;
                    travelled = true;
                    if (!sizing) return;
                    moving = true;
                    handle.toggleAttribute('data-dragging', true);
                }
                width = WIDTH.fitted(from + delta, geometry().panel.width);
                apply(false);
            };
            const up = () => {
                handle.removeEventListener('pointermove', move);
                handle.removeEventListener('pointerup', up);
                handle.removeEventListener('pointercancel', up);
                if (!moving) return;
                handle.toggleAttribute('data-dragging', false);
                PROTOCOL.layout.send({ width: Math.round(width) });
            };
            handle.addEventListener('pointermove', move);
            handle.addEventListener('pointerup', up);
            handle.addEventListener('pointercancel', up);
        });
        // The click event is also what Enter and Space on the handle make.
        handle.addEventListener('click', (event) => {
            event.preventDefault();
            if (travelled) {
                travelled = false;
                return;
            }
            PROTOCOL.layout.send({ collapsed: !state.frame.collapsed });
        });
    }

    // What fades: this page's, and the documents it draws in. The handle fades in place.
    function faded() {
        return [root, backdropRoot];
    }

    // An entrance cancels an exit under way, so a quick close, open and close never reports the first exit done.
    // The start is read back before the end is written, or both land in one style pass and nothing transitions.
    function fadeIn() {
        clearTimeout(leaving);
        leaving = null;
        for (const each of faded())
            Object.assign(each.style, {
                transition: 'none',
                opacity: '0',
                transform: MOTION.entrance,
            });
        grip.document.body.style.transition = 'none';
        grip.document.body.style.opacity = '0';
        void root.offsetHeight;
        void backdropRoot.offsetHeight;
        void grip.document.body.offsetHeight;
        for (const each of [...faded(), grip.document.body])
            Object.assign(each.style, { transition: motion(), opacity: '1', transform: 'none' });
    }

    // A frame that faded out while it was on screen comes back where it stood.
    function enterAtOnce() {
        clearTimeout(leaving);
        leaving = null;
        for (const each of [...faded(), grip.document.body])
            Object.assign(each.style, { transition: 'none', opacity: '1', transform: 'none' });
    }

    function fadeOut(then) {
        for (const each of faded())
            Object.assign(each.style, { transition: motion(), opacity: '0', transform: MOTION.entrance });
        Object.assign(grip.document.body.style, { transition: motion(), opacity: '0' });
        clearTimeout(leaving);
        const duration = MOTION.base;
        if (!duration) return then();
        leaving = setTimeout(() => {
            leaving = null;
            then();
        }, duration);
    }

    function motion() {
        return `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
    }
}

// MARK: - Private
function element(page, tag, className) {
    const made = page.createElement(tag);
    made.className = className;
    return made;
}

function rounded({ x, y, width, height }) {
    return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

export { boot };
