import * as TOKEN from '../token/index.js';

// MARK: - Property
const folding = new Map(); // box -> { timer, then }: a fold under way

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

// MARK: - Private
// A fold stops, its `then` not run, and the box and its item are as they were before it.
function settle(box) {
    const running = folding.get(box);
    if (running) clearTimeout(running.timer);
    folding.delete(box);
    Object.assign(box.style, { transition: '', gridTemplateRows: '', opacity: '' });
    if (box.firstElementChild) Object.assign(box.firstElementChild.style, { minHeight: '', overflow: '' });
}

export { fold, appear };
