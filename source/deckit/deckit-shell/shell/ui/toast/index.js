import * as LAYER from '../layer/index.js';
import * as TOKEN from '../token/index.js';

// MARK: - Property
const STYLE = `
.deckit-toast {
    position: fixed;
    left: 50%;
    bottom: 20px;
    box-sizing: border-box;
    max-width: min(480px, calc(100vw - 32px));
    padding: 8px 14px;
    border: var(--deckit-border);
    border-radius: var(--deckit-radius-card);
    background: var(--deckit-lifted);
    box-shadow: var(--deckit-shadow-raised);
    color: var(--deckit-text);
    font: var(--deckit-type-body);
    line-height: 1.45;
    text-align: center;
    pointer-events: none;
    translate: -50% 0;
}
`;
// How long a toast stays, in ms: long enough to read, longer for more words.
const STAY = { base: 2500, perCharacter: 50, most: 8000 };
const FADE = [
    { opacity: 0, transform: 'translateY(6px)' },
    { opacity: 1, transform: 'none' },
];

// The toast on screen, which a new one takes the place of.
let shown = null;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { toast };
}

// MARK: - Private
// `text` at the bottom of the page for a while, on a layer over it, taking no presses: what was just done, told where
// it was done. It returns `{ close() }`.
function toast(text) {
    shown?.close();
    const element = document.createElement('div');
    element.className = 'deckit-toast';
    element.setAttribute('role', 'status');
    element.textContent = text;
    const layer = LAYER.add(element);
    element.animate(FADE, { duration: TOKEN.MOTION.slow, easing: TOKEN.MOTION.easing });
    const stay = setTimeout(close, Math.min(STAY.base + text.length * STAY.perCharacter, STAY.most));
    let closed = false;
    const made = { close };
    shown = made;
    return made;

    function close() {
        if (closed) return;
        closed = true;
        clearTimeout(stay);
        if (shown === made) shown = null;
        element
            .animate(FADE, {
                duration: TOKEN.MOTION.base,
                easing: TOKEN.MOTION.easing,
                direction: 'reverse',
                fill: 'forwards',
            })
            .finished.finally(() => layer.remove());
    }
}

export { STYLE, make };
