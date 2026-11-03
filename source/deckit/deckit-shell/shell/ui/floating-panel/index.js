import * as LAYER from '../layer/index.js';

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
// `focus(target)` shows it and gives `target` the focus and the keyboard the page has.
function floatingPanel() {
    const element = document.createElement('div');
    element.className = 'deckit-floating-panel';
    element.style.zIndex = String(LAYER.Z.float);
    element.style.setProperty('--app-region', 'no-drag');
    const show = () => {
        if (!element.isConnected) LAYER.append(element);
    };
    const focus = (target) => {
        show();
        target.focus();
        LAYER.take();
    };
    return { element, show, hide: () => element.remove(), isOpen: () => element.isConnected, focus };
}

export { STYLE, make };
