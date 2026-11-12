import * as LAYER from '../layer/index.js';
import * as TOKEN from '../token/index.js';

// MARK: - Property
const STYLE = `
.deckit-toasts {
    position: fixed;
    right: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
    pointer-events: none;
}
.deckit-toast {
    box-sizing: border-box;
    max-width: min(360px, calc(100vw - 24px));
    padding: 8px 14px;
    border: var(--deckit-border);
    border-radius: var(--deckit-radius-card);
    background: var(--deckit-lifted);
    box-shadow: var(--deckit-shadow-raised);
    color: var(--deckit-text);
    font: var(--deckit-type-body);
    line-height: 1.45;
}
`;
// How long a toast stays, in ms: long enough to read, longer for more words.
const STAY = { base: 2500, perCharacter: 50, most: 8000 };
// The most toasts shown at once: one more closes the oldest.
const MOST = 4;
// The room between the stack and the top of the page, or the title bar it lies under.
const GAP = 8;
// A toast slides in from the right as it fades in, and back as it fades out.
const SLIDE = [{ transform: 'translateX(12px)' }, { transform: 'none' }];
const FADE = [{ opacity: 0 }, { opacity: 1 }];

// The stack on screen, `{ layer, element }`, while it holds a toast.
let stack = null;
const closers = new WeakMap(); // toast -> its close()

// MARK: - Initializer
// MARK: - Public
function make() {
    return { toast };
}

// MARK: - Private
// `text` at the top right of the page for a while, under its title bar, on a layer over it, taking no presses: what
// was just done, told where it was done. Toasts stack, the newest on top. It returns `{ close() }`.
function toast(text) {
    const element = document.createElement('div');
    element.className = 'deckit-toast';
    element.setAttribute('role', 'status');
    element.textContent = text;
    const { element: list } = stack || (stack = open());
    list.style.top = topOf() + 'px';
    glide(list, () => list.prepend(element));
    slide(element);
    const stay = setTimeout(close, Math.min(STAY.base + text.length * STAY.perCharacter, STAY.most));
    closers.set(element, close);
    for (const old of [...list.children].filter((child) => !child.dataset.leaving).slice(MOST)) closers.get(old)();
    return { close };

    function close() {
        if (element.dataset.leaving) return;
        element.dataset.leaving = 'true';
        clearTimeout(stay);
        slide(element, { out: true }).finally(() => {
            glide(list, () => element.remove());
            if (list.childElementCount || stack?.element !== list) return;
            stack.layer.remove();
            stack = null;
        });
    }
}

// Slides and fades `element` in, or with `out` out, faster, and keeps it out: answers once both are over.
function slide(element, { out = false } = {}) {
    const options = { easing: TOKEN.MOTION.easing, ...(out ? { direction: 'reverse', fill: 'forwards' } : {}) };
    const moved = TOKEN.MOTION.move[out ? 'base' : 'slow'];
    const played = [
        element.animate(SLIDE, { ...options, duration: moved }),
        element.animate(FADE, { ...options, duration: TOKEN.MOTION.fade }),
    ];
    return Promise.allSettled(played.map((animation) => animation.finished));
}

function open() {
    const element = document.createElement('div');
    element.className = 'deckit-toasts';
    return { layer: LAYER.add(element), element };
}

// Under the title bars the page's documents lay, or at their top.
function topOf() {
    const bars = LAYER.windows()
        .flatMap(({ document }) => [...document.querySelectorAll('.deckit-title-bar')])
        .map((bar) => bar.getBoundingClientRect());
    return Math.max(0, ...bars.filter((box) => box.width && box.height).map((box) => box.bottom)) + GAP;
}

// The toasts staying glide from where they were to where `change` puts them.
function glide(list, change) {
    const staying = [...list.children].filter((child) => !child.dataset.leaving);
    const before = new Map(staying.map((child) => [child, child.getBoundingClientRect().top]));
    change();
    for (const [child, top] of before) {
        const by = top - child.getBoundingClientRect().top;
        if (child.isConnected && by)
            child.animate([{ transform: `translateY(${by}px)` }, { transform: 'none' }], {
                duration: TOKEN.MOTION.move.base,
                easing: TOKEN.MOTION.easingMove,
            });
    }
}

export { STYLE, make };
