import * as LAYER from '../layer/index.js';
import * as TOKEN from '../token/index.js';
import * as ICON from '../icon/index.js';

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
.deckit-toasts:has(> [data-kind='failure']) { pointer-events: auto; }
.deckit-toast {
    box-sizing: border-box;
    max-width: min(360px, calc(100vw - 24px));
    padding: 8px 14px;
    overflow-wrap: anywhere;
    border-radius: var(--deckit-radius-card);
    background: var(--deckit-elevated);
    box-shadow: var(--deckit-rim), var(--deckit-shadow-float);
    color: var(--deckit-text);
    font: var(--deckit-type-body);
    pointer-events: none;
}
.deckit-toast[data-kind='failure'] {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 6px 6px 6px 14px;
    pointer-events: auto;
}
.deckit-toast-text { flex: 1 1 auto; min-width: 0; padding: 4px 0; }
.deckit-toast-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }
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
function make(theme, ui) {
    return { toast: (text, options) => toast(ui, text, options) };
}

// MARK: - Private
// `text` at the top right of the page, under its title bar, on a layer over it: what was just done, told where it was
// done, for a while, taking no presses. A `failure` stays until it is closed, takes presses and holds a close button
// and, with `action` (`{ label, run }`), one button that runs it and closes the toast. Toasts stack, the newest on top.
// It returns `{ close() }`.
function toast(ui, text, { kind = 'done', action = null } = {}) {
    const element = document.createElement('div');
    element.className = 'deckit-toast';
    const failure = kind === 'failure';
    if (failure) {
        element.dataset.kind = kind;
        element.setAttribute('role', 'alert');
        const words = document.createElement('div');
        words.className = 'deckit-toast-text';
        words.textContent = text;
        const actions = document.createElement('div');
        actions.className = 'deckit-toast-actions';
        if (action)
            actions.append(
                ui.button({
                    label: action.label,
                    size: 'small',
                    onClick: () => {
                        close();
                        action.run();
                    },
                }).element
            );
        actions.append(
            ui.iconButton({ icon: ICON.icon('x', { size: 14 }), title: 'Close', size: 'small', onClick: close }).element
        );
        element.append(words, actions);
    } else {
        element.setAttribute('role', 'status');
        element.textContent = text;
    }
    const { element: list } = stack || (stack = open());
    list.style.top = topOf() + 'px';
    glide(list, () => list.prepend(element));
    slide(element);
    const stay = failure ? 0 : setTimeout(close, Math.min(STAY.base + text.length * STAY.perCharacter, STAY.most));
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
