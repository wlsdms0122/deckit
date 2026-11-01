import * as TOKEN from '../token/index.js';

// MARK: - Property
// A float (a toolbar, an autocomplete) is in the page, above its own fixed things, placed by its caller and answering
// nothing. In the overlay a layer is above the layers under it, by its place in the stack, and what a drag carries is
// above them all.
const Z = Object.freeze({ float: 1150, layer: 1200, drag: 2147483646 });
// How far inside the window a placed box stays.
const MARGIN = 8;
// How far a submenu overlaps the menu it opens from.
const OVERLAP = 6;
const STYLE = `
    .deckit-surface {
        position: fixed;
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
`;
// What floats and is dismissed, bottom first.
const stack = [];
const layers = Object.freeze({
    top: () => stack.at(-1) || null,
    count: () => stack.length,
});
// The page's overlay: `{ window, document, tell({ shows, layered }) }`, a document beside the page's own, laid over the
// page while it shows anything, where what floats is drawn. Elements made in the page are drawn there as they are,
// with the page's rules copied in.
let overlay = null;
const copies = new WeakMap(); // a sheet of the page -> { count, text }, its rules as last copied
let style = null; // what wears the copies in the overlay
let told = '';

// MARK: - Initializer
// MARK: - Public
// Presses and keys are heard in the page and in its overlay. On pointerdown, so a control that cancels the mouse
// events after it (a resize handle) still dismisses what is open. Keys are the top layer's first, in the capture
// phase, before the page sees them. The keyboard moving between the page and its overlay is no blur.
function start(given) {
    overlay = given;
    style = overlay.document.createElement('style');
    overlay.document.head.replaceChildren(style);
    overlay.document.body.replaceChildren();
    for (const each of [window, overlay.window]) {
        each.addEventListener('pointerdown', dismissOutside, true);
        each.addEventListener('keydown', route, true);
        each.addEventListener('blur', () => requestAnimationFrame(() => setTimeout(dismissUnfocused)));
    }
    window.addEventListener('scroll', dismissScrolledAway, true);
    overlay.window.addEventListener('wheel', dismissWheeledOutside, true);
    window.addEventListener('resize', () => {
        dismissTransient();
        placeAgain();
    });
    new MutationObserver(report).observe(overlay.document.body, { childList: true });
}

// What floats over the page goes into its overlay, which wears the page's rules first.
function append(element) {
    if (!overlay.document.body.childElementCount) dress();
    overlay.document.body.append(element);
}

// The page and its overlay, where what floats hears the pointer and the keys.
function windows() {
    return [window, overlay.window];
}

// The overlay wears the page's rules as they are now; `again`, every sheet read anew, as one whose rules were replaced
// in place (the theme's) keeps their count.
function dress({ again = false } = {}) {
    if (!overlay) return;
    const text = document.adoptedStyleSheets.map((sheet) => textOf(sheet, again)).join('\n');
    if (style.textContent !== text) style.textContent = text;
    overlay.document.documentElement.style.colorScheme = document.documentElement.style.colorScheme;
}

// Opens a layer: `element` (optional) goes in the page's overlay, placed by `anchor`, `rect`, `point` or `beside`.
// - A press outside the layer and what it hangs from dismisses it, then the next layer, until one holds the
//   press. A `modal` layer holds every press.
// - A key goes to `onKey` first; one it does not take (it returns falsy) that is Escape dismisses the layer.
// - A `transient` layer is also dismissed by a scroll outside it, a resize and the keyboard leaving the page and its
//   overlay. One that stays through a resize is placed again, against what it hangs from where that is now.
// - Dismissing calls `onDismiss`; `close()` plays the exit, `fast` or `base` long by `speed`, or none for null, and
//   takes the element away.
function open({
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
    const layer = {
        element,
        z: Z.layer + stack.length,
        modal,
        transient,
        isTop: () => stack.at(-1) === layer,
        holds: (target) =>
            !!element?.contains(target) || !!anchor?.contains(target) || !!beside?.contains(target) || contains(target),
        onKey,
        dismiss: () => onDismiss(),
        place: () => (anchor || rect || point || beside) && place(element, { anchor, rect, point, beside, gap }),
        close: () => close(layer, speed),
    };
    stack.push(layer);
    if (element) show(element, layer);
    report();
    return layer;
}

// Places a fixed box against a target, kept MARGIN inside the window, and returns the side it went to.
// - `anchor` (an element) or `rect`: below it, or above when only that fits. `align` is `start` or `center`.
// - `point`: at it, or above it.
// - `beside` (a row of a menu): right of the menu, overlapping it, or left of it when only that fits.
// `prefer` puts a box above its target first. A placed box takes presses where it lies, over a part of the
// page that drags the window too.
function place(
    element,
    { anchor = null, rect = null, point = null, beside = null, gap = 4, align = 'start', prefer = 'bottom' }
) {
    element.style.webkitAppRegion = 'no-drag';
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    let x;
    let y;
    let side;
    if (beside) {
        const row = beside.getBoundingClientRect();
        const menu = beside.parentElement.getBoundingClientRect();
        side = menu.right - OVERLAP + width > window.innerWidth - MARGIN ? 'left' : 'right';
        x = side === 'right' ? menu.right - OVERLAP : menu.left + OVERLAP - width;
        y = row.top - 4;
    } else if (anchor || rect) {
        const box = rect || anchor.getBoundingClientRect();
        const below = box.bottom + gap;
        const above = box.top - gap - height;
        const fitsBelow = below + height <= window.innerHeight - MARGIN;
        const fitsAbove = above >= MARGIN;
        side =
            prefer === 'top'
                ? fitsAbove || !fitsBelow
                    ? 'top'
                    : 'bottom'
                : fitsBelow || !fitsAbove
                  ? 'bottom'
                  : 'top';
        x = align === 'center' ? (box.left + box.right) / 2 - width / 2 : box.left;
        y = side === 'bottom' ? below : above;
    } else {
        side = point.y + height > window.innerHeight - MARGIN ? 'top' : 'bottom';
        x = point.x;
        y = side === 'bottom' ? point.y : point.y - height;
    }
    element.style.left = clamp(x, MARGIN, window.innerWidth - width - MARGIN) + 'px';
    element.style.top = clamp(y, MARGIN, window.innerHeight - height - MARGIN) + 'px';
    element.dataset.side = side;
    return side;
}

// MARK: - Private
// The box arrives from its closed state: laid out closed first, or both states land in one style pass. What
// floats takes presses where it lies, a part of the page that drags the window included.
function show(element, layer) {
    element.classList.add('deckit-surface');
    element.dataset.state = 'closed';
    element.style.zIndex = String(layer.z);
    element.style.webkitAppRegion = 'no-drag';
    append(element);
    layer.place();
    void element.offsetHeight;
    element.dataset.state = 'open';
}

function close(layer, speed) {
    const index = stack.indexOf(layer);
    if (index < 0) return;
    stack.splice(index, 1);
    report();
    const { element } = layer;
    if (!element) return;
    element.dataset.state = 'closed';
    const length = TOKEN.MOTION[speed];
    if (length) setTimeout(() => element.dataset.state === 'closed' && element.remove(), length);
    else element.remove();
}

function dismissOutside(event) {
    for (const layer of [...stack].reverse()) {
        if (layer.modal || layer.holds(event.target)) return;
        layer.dismiss();
    }
}

function route(event) {
    const top = stack.at(-1);
    if (!top) return;
    if (top.onKey(event)) {
        event.preventDefault();
        event.stopPropagation();
    } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        top.dismiss();
    }
}

// A box placed against something that scrolled away points at nothing.
function dismissScrolledAway(event) {
    for (const layer of [...stack].reverse()) {
        if (layer.transient && !layer.element?.contains(event.target)) layer.dismiss();
    }
}

// The wheel turned over the overlay outside what floats would scroll the page under it.
function dismissWheeledOutside(event) {
    if (!stack.some((layer) => layer.element?.contains(event.target))) dismissTransient();
}

function placeAgain() {
    for (const layer of stack) if (layer.element) layer.place();
}

function dismissTransient() {
    for (const layer of [...stack].reverse()) if (layer.transient) layer.dismiss();
}

// Once neither the page nor its overlay has the keyboard: it went to another page or another app.
function dismissUnfocused() {
    if (!document.hasFocus() && !overlay.document.hasFocus()) dismissTransient();
}

// Whether the overlay draws anything, so it is laid over the page.
function draws() {
    return overlay.document.body.childElementCount > 0;
}

// Told only when it changed: whether the overlay draws anything, and whether a layer is open.
function report() {
    const state = { shows: draws(), layered: stack.length > 0 };
    const written = JSON.stringify(state);
    if (written === told) return;
    told = written;
    overlay.tell(state);
}

// A sheet's rules as text, read again only once their count changed.
function textOf(sheet, again) {
    const count = sheet.cssRules.length;
    const copy = copies.get(sheet);
    if (!again && copy?.count === count) return copy.text;
    const text = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
    copies.set(sheet, { count, text });
    return text;
}

function clamp(value, low, high) {
    return Math.max(low, Math.min(value, high));
}

export { Z, STYLE, start, append, dress, windows, draws, open, place, layers };
