import * as LAYER from '../layer/index.js';
import * as TOKEN from '../token/index.js';

// MARK: - Property
const STYLE = `
    .deckit-floating-panel {
        position: fixed;
        box-sizing: border-box;
        border-radius: var(--deckit-radius-large);
        border: var(--deckit-border);
        background: var(--deckit-background);
        box-shadow: var(--deckit-shadow-raised);
        color: var(--deckit-text);
        transform-origin: top center;
        transition: opacity var(--deckit-fast) var(--deckit-easing), transform var(--deckit-base) var(--deckit-easing);
    }
    .deckit-floating-panel[data-state='closed'] {
        opacity: 0;
        transform: translateY(-6px) scale(.96);
        pointer-events: none;
    }
`;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { floatingPanel };
}

// MARK: - Private
// A panel over the page and its web pages, in the page's overlay, placed by its caller: it stays while the person
// presses elsewhere, takes presses only where it lies, and has the keyboard while an element in it holds the focus.
// It fades in as it shows and out as it hides. `focus(target)` shows it and gives `target` the focus and the keyboard
// the page has.
function floatingPanel() {
    const element = document.createElement('div');
    element.className = 'deckit-floating-panel';
    element.dataset.state = 'closed';
    element.style.zIndex = String(LAYER.Z.float);
    element.style.setProperty('--app-region', 'no-drag');
    const isOpen = () => element.isConnected && element.dataset.state === 'open';
    const show = () => {
        if (isOpen()) return;
        if (!element.isConnected) {
            LAYER.append(element);
            void element.offsetHeight;
        }
        element.dataset.state = 'open';
    };
    const hide = () => {
        if (!isOpen()) return;
        element.dataset.state = 'closed';
        const length = TOKEN.MOTION.fast;
        if (length) setTimeout(() => element.dataset.state === 'closed' && element.remove(), length);
        else element.remove();
    };
    const focus = (target) => {
        show();
        target.focus();
        LAYER.take();
    };
    return { element, show, hide, isOpen, focus };
}

export { STYLE, make };
