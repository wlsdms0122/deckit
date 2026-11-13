import * as TOKEN from '../token/index.js';

// MARK: - Property
const folding = new Map(); // box -> { timer, then }: a fold under way
const GLIDE = 'deckit-glide';

// MARK: - Initializer
// MARK: - Public
// Opens or closes `box`, a grid of one item, along its rows: the item grows from nothing to its height or folds away
// to nothing by the `move` spring settled to its height, so a taller one takes longer, and fades as it goes. `then`
// runs once it is over. A fold under way is turned back from where it stands.
function fold(box, open, then = null) {
    const item = box.firstElementChild;
    const running = folding.get(box);
    if (running) clearTimeout(running.timer);
    const height = item?.scrollHeight ?? 0;
    const { length, fade, easing } = TOKEN.MOTION.over('move', height);
    if (!length || !height) {
        settle(box);
        return then?.();
    }
    Object.assign(item.style, { minHeight: '0', overflow: 'hidden' });
    const shut = { gridTemplateRows: '0fr', opacity: '0' };
    const shown = { gridTemplateRows: '1fr', opacity: '1' };
    // The start is read back before the end is written, or both land in one style pass and nothing transitions.
    if (!running) {
        Object.assign(box.style, open ? shut : shown, { transition: 'none' });
        void box.offsetHeight;
    }
    const transition = `grid-template-rows ${length}ms ${easing}, opacity ${fade}ms ${easing}`;
    Object.assign(box.style, open ? shown : shut, { transition });
    const timer = setTimeout(() => {
        settle(box);
        then?.();
    }, length);
    folding.set(box, { timer, then });
}

// Fades `element` in, as a row that joins a list does.
function appear(element) {
    const { fade, easing } = TOKEN.MOTION.enter;
    element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing });
}

// Brings `element` on screen by the `enter` spring: it fades in and moves from `x`, `y` px away and `scale` to where
// it is, the move none while the system asks for reduced motion. Answers the motion, to `cancel` or wait for
// (`finished`).
function come(element, way = {}) {
    return play(element, way, TOKEN.MOTION.enter, false);
}

// Takes `element` off screen by the quicker `exit` spring along the same way, and keeps it there until the motion is
// cancelled. Going out plays the frames backwards, not the curve, so it leaves easing out too.
function go(element, way = {}) {
    return play(element, way, TOKEN.MOTION.exit, true);
}

// The elements of `staying` glide from where they were to where `change` lays them, each by the `move` spring settled
// to its own travel. A glide under way is cut and the element glides on from where it is drawn.
function glide(staying, change) {
    const before = new Map(staying.map((element) => [element, element.getBoundingClientRect()]));
    for (const element of staying)
        for (const running of element.getAnimations()) if (running.id === GLIDE) running.cancel();
    change();
    for (const [element, was] of before) {
        if (!element.isConnected) continue;
        const now = element.getBoundingClientRect();
        const [x, y] = [was.left - now.left, was.top - now.top];
        const { length, easing } = TOKEN.MOTION.over('move', Math.hypot(x, y));
        if (!length || (!x && !y)) continue;
        const frames = [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }];
        element.animate(frames, { id: GLIDE, duration: length, easing });
    }
}

// MARK: - Private
// The two animations of a coming or going: the move over the role's length, the fade over its fade length.
function play(element, { x = 0, y = 0, scale = 1 }, { length, fade, easing }, out) {
    const way = (frames) => (out ? [...frames].reverse() : frames);
    const options = { easing, ...(out ? { fill: 'forwards' } : {}) };
    const moves = x || y || scale !== 1;
    const from = `translate(${x}px, ${y}px) scale(${scale})`;
    const played = [element.animate(way([{ opacity: 0 }, { opacity: 1 }]), { ...options, duration: fade })];
    if (moves && length)
        played.push(
            element.animate(way([{ transform: from }, { transform: 'none' }]), { ...options, duration: length })
        );
    return {
        finished: Promise.allSettled(played.map((animation) => animation.finished)),
        cancel: () => played.forEach((animation) => animation.cancel()),
    };
}

// A fold stops, its `then` not run, and the box and its item are as they were before it.
function settle(box) {
    const running = folding.get(box);
    if (running) clearTimeout(running.timer);
    folding.delete(box);
    Object.assign(box.style, { transition: '', gridTemplateRows: '', opacity: '' });
    if (box.firstElementChild) Object.assign(box.firstElementChild.style, { minHeight: '', overflow: '' });
}

export { fold, appear, come, go, glide };
