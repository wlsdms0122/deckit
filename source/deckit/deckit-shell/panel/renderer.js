import * as SIDEBAR from './sidebar.js';
import * as PROTOCOL from './protocol.js';

// MARK: - Property
// What a mod with deckit.mods reads and changes of the panel's list, on deck.mods: `pinned()`, the children the
// person pinned to it, and `setPinned(id, pinned)`.
const pins = Object.freeze({
    pinned: () => PROTOCOL.pinned.invoke(),
    setPinned: (id, pinned) => PROTOCOL.setPinned.invoke({ id: String(id), pinned: !!pinned }),
});

// MARK: - Initializer
// MARK: - Public
// The panel's frame around one mod's view, in its own page. `tell` calls a part of the view (didAppear,
// didDisappear); `layers` is what floats in the page; `chordOf(action)` is the chord of one of the panel's keys.
function mount({ theme, ui, view, tell, layers, chordOf }) {
    const setup = PROTOCOL.setup.invoke();
    const { motion: MOTION } = theme;
    let open = setup.shown;
    let look = setup.look;
    let leaving = null;
    let appeared = false;

    const root = element('div', {
        position: 'fixed',
        inset: '0',
        display: 'flex',
        overflow: 'hidden',
        flexDirection: 'row',
        font: '15px var(--deckit-font)',
        boxSizing: 'border-box',
    });
    const content = element('div', {
        flex: '1 1 auto',
        minWidth: '0',
        background: 'transparent',
        color: 'var(--deckit-text)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
    });
    Object.assign(view.content.style, { width: '100%', flex: '1 1 auto', minHeight: '0' });
    content.append(view.content);
    // Where the window's buttons stand is the panel's, whatever is drawn there: it drags the window, so the
    // window can be moved however the mod on screen draws its top. Last, so a region the mod keeps from dragging
    // does not take it back.
    const buttonsRoom = element('div', {
        position: 'absolute',
        top: '0',
        left: '0',
        display: 'none',
        webkitAppRegion: 'drag',
    });
    const sidebar = SIDEBAR.make({
        theme,
        ui,
        root,
        content,
        sidebar: view.sidebar || null,
        onPick: (id) => PROTOCOL.pick.send({ id }),
        onStep: (by) => PROTOCOL.step.send({ by }),
        onReorder: (ids) => PROTOCOL.reorder.send({ ids }),
        onLayout: (change) => PROTOCOL.layout.send(change),
        onCollapsedChange: () => dress(),
        chordOf,
    });
    root.append(sidebar.element, content, buttonsRoom);
    document.body.appendChild(root);
    dress();
    sidebar.update(setup.state, false);
    appear();

    layers.onChange((on) => PROTOCOL.floating.send({ on }));
    // Main took this Escape, so the field never saw it: it is played again as a keydown. A field that handles
    // it keeps the caret; one that does not is left, as a browser would, so the next Escape reaches the page.
    PROTOCOL.escape.on(({ last }) => {
        const top = layers.top();
        if (top) return top.dismiss();
        const field = document.activeElement;
        if (isField(field)) {
            const handled = !field.dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true })
            );
            if (!handled && document.activeElement === field) field.blur();
            return;
        }
        if (last) PROTOCOL.dismiss.send();
    });
    PROTOCOL.state.on((state) => sidebar.update(state, true));
    PROTOCOL.look.on((next) => {
        look = next;
        dress();
    });
    PROTOCOL.visible.on(({ open: on, animate }) => {
        if (open === on) return;
        open = on;
        appear();
        if (!animate) {
            if (on) enterAtOnce();
            return;
        }
        if (on) fadeIn();
        else fadeOut(() => {});
    });
    // Main waits for the exit of the page in front before it takes the panel off screen, or moves it, so neither is
    // seen as a flicker. An entrance cancels an exit under way, which is then never answered.
    PROTOCOL.exit.handle(
        () =>
            new Promise((resolve) => {
                if (!open) return resolve();
                open = false;
                appear();
                fadeOut(resolve);
            })
    );
    PROTOCOL.play.on(({ direction }) => (direction === 'out' ? fadeOut(() => {}) : fadeIn()));
    PROTOCOL.leave.handle(() => new Promise((resolve) => fadeOut(resolve)));

    // didAppear and didDisappear alternate, worked out in this one place.
    function appear() {
        if (open === appeared) return;
        appeared = open;
        tell(open ? 'didAppear' : 'didDisappear');
    }

    // Floating over an app, the ring makes the panel read as on top and the rounding needs the page behind
    // to be clear. Filling a window, the frame is the OS's, and the panel may share the window's top with its
    // title bar: the sidebar reaches up under it, and so does the content, whose title bar area is the mod's
    // (`ui.titleBar`): as tall as the bar, from past the window's buttons when the sidebar is collapsed. In a
    // region of another mod's, the frame is the region: no list of mods and no surface of its own, the parent's
    // showing through, and as much of the bar as lies over the region, from past the buttons that do.
    function dress() {
        const bar = look.titleBar;
        document.documentElement.toggleAttribute('data-deckit-title-bar', !!bar);
        Object.assign(buttonsRoom.style, {
            display: bar && !look.region ? 'block' : 'none',
            width: (bar?.controlsWidth || 0) + 'px',
            height: (bar?.height || 0) + 'px',
        });
        sidebar.setInRegion(!!look.region);
        const page = document.documentElement.style;
        page.setProperty('--deckit-title-bar-area-height', (bar?.height || 0) + 'px');
        page.setProperty(
            '--deckit-title-bar-area-x',
            (bar && (look.region || sidebar.collapsed()) ? bar.controlsWidth : 0) + 'px'
        );
        sidebar.setTitleBarHeight(bar?.height || 0);
        if (look.region) {
            Object.assign(root.style, {
                background: 'transparent',
                boxShadow: 'none',
                border: '0',
                borderRadius: '0',
                transform: 'none',
                transition: `opacity ${MOTION.fast}ms ${MOTION.easing}`,
            });
            return;
        }
        Object.assign(
            root.style,
            {
                background: `color-mix(in srgb, var(--deckit-background) ${setup.glass * 100}%, transparent)`,
                boxShadow: 'none',
            },
            look.floating
                ? {
                      border: '1px solid rgba(255,255,255,.14)',
                      borderRadius: '12px',
                      transformOrigin: 'center',
                      transition: `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`,
                  }
                : { border: '0', borderRadius: '0', opacity: '1', transform: 'none', transition: 'none' }
        );
    }

    // An entrance cancels an exit under way, so a quick close, open and close never reports the first exit done.
    function fadeIn() {
        clearTimeout(leaving);
        leaving = null;
        root.style.transition = 'none';
        root.style.opacity = '0';
        root.style.transform = entrance();
        requestAnimationFrame(() => {
            root.style.transition = `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
            root.style.opacity = '1';
            root.style.transform = 'none';
        });
    }

    // A view that faded out while it was on screen comes back where it stood.
    function enterAtOnce() {
        clearTimeout(leaving);
        leaving = null;
        root.style.transition = 'none';
        root.style.opacity = '1';
        root.style.transform = 'none';
    }

    // A region's page fades in place: the parent around it does not grow or shrink with it.
    function entrance() {
        return look.region ? 'none' : MOTION.entrance;
    }

    function fadeOut(then) {
        root.style.transition = `opacity ${MOTION.fast}ms ${MOTION.easing}, transform ${MOTION.base}ms ${MOTION.easing}`;
        root.style.opacity = '0';
        root.style.transform = entrance();
        clearTimeout(leaving);
        const duration = MOTION.base;
        if (!duration) return then();
        leaving = setTimeout(() => {
            leaving = null;
            then();
        }, duration);
    }
}

// The mod asks to be on screen.
function show() {
    PROTOCOL.show.send();
}

// Why what `deck.view` was handed is not a view, or ''. Its parent is the region's to judge.
function viewProblem(value) {
    if (value?.content?.nodeType !== Node.ELEMENT_NODE)
        return 'takes { content, sidebar, parent, didAppear, didDisappear }, content an element';
    return '';
}

// A mod's own key runs only in its page in front, so one with no view has only its global keys.
function keyProblem(key, view) {
    return !key.global && !view ? 'a mod with no view is never in front, so only a global key does' : '';
}

// MARK: - Private
function isField(element) {
    return !!element?.matches?.("input, textarea, select, [contenteditable]:not([contenteditable='false'])");
}

function element(tag, style) {
    const made = document.createElement(tag);
    Object.assign(made.style, style);
    return made;
}

export { mount, show, pins, viewProblem, keyProblem };
