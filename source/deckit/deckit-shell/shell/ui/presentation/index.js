import * as TOKEN from '../token/index.js';
import * as LAYER from '../layer/index.js';
import * as PLACE from '../place/index.js';

// MARK: - Property
const STYLE = `
    .deckit-surface {
        position: fixed;
        outline: none;
        transition: opacity var(--deckit-fast) var(--deckit-easing), transform var(--deckit-base) var(--deckit-easing);
    }
    .deckit-surface[data-side='bottom'] { transform-origin: top left; }
    .deckit-surface[data-side='top'] { transform-origin: bottom left; }
    .deckit-surface[data-side='right'] { transform-origin: top left; }
    .deckit-surface[data-side='left'] { transform-origin: top right; }
    .deckit-surface[data-state='closed'] { opacity: 0; pointer-events: none; }
    .deckit-surface[data-state='closed'][data-side='bottom'] { transform: translateY(-6px) scale(.96); }
    .deckit-surface[data-state='closed'][data-side='top'] { transform: translateY(6px) scale(.96); }
    .deckit-surface[data-state='closed'][data-side='right'] { transform: translateX(-6px) scale(.96); }
    .deckit-surface[data-state='closed'][data-side='left'] { transform: translateX(6px) scale(.96); }
    .deckit-backdrop { position: fixed; inset: 0; }
`;
// What is presented over the page, bottom first.
const stack = [];
// The layer under what is presented, while an element of it is: a press outside it lands there, over the page and
// its web pages too.
let backdrop = null;

// MARK: - Initializer
// MARK: - Public
// Presses and keys are heard in the page and in its overlay. On pointerdown, so a control that cancels the mouse
// events after it (a resize handle) still dismisses what is presented. Keys are the top one's first, in the capture
// phase, before the page sees them. The keyboard moving between the page and its overlay is no blur.
function start() {
    const [page, overlay] = LAYER.windows();
    for (const each of [page, overlay]) {
        each.addEventListener('pointerdown', dismissOutside, true);
        each.addEventListener('keydown', route, true);
        each.addEventListener('blur', () => requestAnimationFrame(() => setTimeout(dismissUnfocused)));
    }
    page.addEventListener('focus', () => keepKeyboard(overlay.document));
    page.addEventListener('scroll', dismissScrolledAway, true);
    overlay.addEventListener('wheel', dismissWheeledOutside, true);
    page.addEventListener('resize', () => {
        dismissTransient();
        placeAgain();
    });
}

// Presents over the page: `element` (optional) on a layer of its own, placed by `anchor`, `rect`, `point` or `beside`,
// with the focus and the keyboard the page has.
// - A press outside it and what it hangs from dismisses it, then the next one down, until one holds the press. A
//   `modal` one holds every press.
// - A key goes to `onKey` first; one it does not take (it returns falsy) that is Escape dismisses it.
// - A `transient` one is also dismissed by a scroll outside it, a resize and the keyboard leaving the page and its
//   overlay. One that stays through a resize is placed again, against what it hangs from where that is now.
// - Dismissing calls `onDismiss`; `close()` plays the exit, `fast` or `base` long by `speed`, or none for null, takes
//   the element away and gives the focus back to what had it in the overlay as it was presented.
function present({
    element = null,
    anchor = null,
    rect = null,
    point = null,
    beside = null,
    gap = 4,
    modal = false,
    transient = false,
    contains = () => false,
    speed = 'fast',
    onKey = () => false,
    onDismiss,
}) {
    const presented = {
        element,
        modal,
        transient,
        layer: null,
        returns: LAYER.focused(),
        holds: (target) =>
            !!element?.contains(target) || !!anchor?.contains(target) || !!beside?.contains(target) || contains(target),
        onKey,
        dismiss: () => onDismiss(),
        place: () => (anchor || rect || point || beside) && PLACE.place(element, { anchor, rect, point, beside, gap }),
        close: () => close(presented, speed),
    };
    stack.push(presented);
    if (element) show(presented);
    return presented;
}

// The top of what is presented, or null.
function top() {
    return stack.at(-1) || null;
}

// How much is presented.
function count() {
    return stack.length;
}

// MARK: - Private
// The element arrives from its closed state: laid out closed first, or both states land in one style pass.
function show(presented) {
    const { element } = presented;
    if (!backdrop) backdrop = LAYER.add(Object.assign(document.createElement('div'), { className: 'deckit-backdrop' }));
    element.classList.add('deckit-surface');
    if (!element.hasAttribute('tabindex')) element.tabIndex = -1;
    element.dataset.state = 'closed';
    presented.layer = LAYER.add(element);
    presented.place();
    void element.offsetHeight;
    element.dataset.state = 'open';
    presented.layer.focus();
}

function close(presented, speed) {
    const index = stack.indexOf(presented);
    if (index < 0) return;
    stack.splice(index, 1);
    const { element, layer, returns } = presented;
    if (!element) return;
    if (!stack.some((each) => each.element)) {
        backdrop?.remove();
        backdrop = null;
    }
    const active = element.ownerDocument.activeElement;
    if (element.contains(active)) {
        if (returns?.isConnected) returns.focus();
        else active.blur();
    }
    element.dataset.state = 'closed';
    const length = TOKEN.MOTION[speed];
    if (length) setTimeout(() => element.dataset.state === 'closed' && layer.remove(), length);
    else layer.remove();
}

function dismissOutside(event) {
    for (const presented of [...stack].reverse()) {
        if (presented.modal || presented.holds(event.target)) return;
        presented.dismiss();
    }
}

function route(event) {
    const presented = stack.at(-1);
    if (!presented) return;
    if (presented.onKey(event)) {
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        presented.dismiss();
    }
}

// The keyboard the page takes goes on to what is presented over it, where the focus was in it.
function keepKeyboard(document) {
    if (stack.some((presented) => presented.element?.contains(document.activeElement))) LAYER.take();
}

// A box placed against something that scrolled away points at nothing.
function dismissScrolledAway(event) {
    for (const presented of [...stack].reverse()) {
        if (presented.transient && !presented.element?.contains(event.target)) presented.dismiss();
    }
}

// The wheel turned over the overlay outside what is presented would scroll the page under it.
function dismissWheeledOutside(event) {
    if (!stack.some((presented) => presented.element?.contains(event.target))) dismissTransient();
}

function placeAgain() {
    for (const presented of stack) if (presented.element) presented.place();
}

function dismissTransient() {
    for (const presented of [...stack].reverse()) if (presented.transient) presented.dismiss();
}

// Once neither the page nor its overlay has the keyboard: it went to another page or another app.
function dismissUnfocused() {
    const [page, overlay] = LAYER.windows();
    if (!page.document.hasFocus() && !overlay.document.hasFocus()) dismissTransient();
}

export { STYLE, start, present, top, count };
