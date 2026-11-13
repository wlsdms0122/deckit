import * as LAYER from '../layer/index.js';
import * as TOKEN from '../token/index.js';
import * as ICON from '../icon/index.js';

// MARK: - Property
const STYLE = `
.deckit-toasts {
    position: fixed;
    right: 12px;
    bottom: 12px;
    display: flex;
    flex-direction: column-reverse;
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
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'text close';
    align-items: start;
    gap: 4px 8px;
    padding: 6px 6px 6px 14px;
    pointer-events: auto;
}
.deckit-toast[data-kind='failure']:has(> .deckit-toast-action) {
    grid-template-areas: 'text close' 'action action';
    padding-bottom: 8px;
}
.deckit-toast-text { grid-area: text; padding: 4px 0; }
.deckit-toast-close { grid-area: close; }
.deckit-toast-action { grid-area: action; justify-self: end; }
`;
// How long a toast stays, in ms: long enough to read, longer for more words.
const STAY = { base: 2500, perCharacter: 50, most: 8000 };
// The most toasts shown at once: one more closes the oldest.
const MOST = 4;
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
// `text` at the bottom right of the page, clear of its title bar and what heads its content, on a layer over it: what
// was just done, told where it was done, for a while, taking no presses. A `failure` stays until it is closed, takes
// presses and holds a close button beside its text and, with `action` (`{ label, run }`), one button under the text
// at its end that runs it and closes the toast. Toasts stack, the newest nearest the edge.
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
        const closer = ui.iconButton({
            icon: ICON.icon('x', { size: 14 }),
            title: 'Close',
            size: 'small',
            onClick: close,
        });
        closer.element.classList.add('deckit-toast-close');
        element.append(words, closer.element);
        if (action) {
            const button = ui.button({
                label: action.label,
                size: 'small',
                onClick: () => {
                    close();
                    action.run();
                },
            });
            button.element.classList.add('deckit-toast-action');
            element.append(button.element);
        }
    } else {
        element.setAttribute('role', 'status');
        element.textContent = text;
    }
    const { element: list } = stack || (stack = open());
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

// Slides and fades `element` in by the `enter` spring, or with `out` out by the quicker `exit` one, and keeps it out:
// answers once both are over. Going out plays the frames backwards, not the curve, so it leaves easing out too.
function slide(element, { out = false } = {}) {
    const { length, fade, easing } = TOKEN.MOTION[out ? 'exit' : 'enter'];
    const way = (frames) => (out ? [...frames].reverse() : frames);
    const options = { easing, ...(out ? { fill: 'forwards' } : {}) };
    const played = [
        element.animate(way(SLIDE), { ...options, duration: length }),
        element.animate(way(FADE), { ...options, duration: fade }),
    ];
    return Promise.allSettled(played.map((animation) => animation.finished));
}

function open() {
    const element = document.createElement('div');
    element.className = 'deckit-toasts';
    return { layer: LAYER.add(element), element };
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
                duration: TOKEN.MOTION.move.length,
                easing: TOKEN.MOTION.move.easing,
            });
    }
}

export { STYLE, make };
