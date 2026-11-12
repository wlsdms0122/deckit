import * as TOKEN from '../token/index.js';

// MARK: - Property
const STYLE = `
.deckit-spinner {
    display: inline-block;
    flex: 0 0 auto;
    box-sizing: border-box;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: var(--deckit-radius-round);
    opacity: 0.55;
}
.deckit-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 24px 12px;
    font: var(--deckit-type-body);
    text-align: center;
}
.deckit-loading-text { color: var(--deckit-muted); }
    `;
const TURN_MS = 750;
// A load shorter than WAIT_MS shows nothing; one that shows stays at least STAY_MS, so it never flashes.
const WAIT_MS = 200;
const STAY_MS = 400;

// MARK: - Initializer
// MARK: - Public
function make() {
    return { spinner, loading };
}

// MARK: - Private
// Still while the system asks for reduced motion.
function spinner({ size = 14 } = {}) {
    const made = document.createElement('span');
    made.className = 'deckit-spinner';
    made.style.width = made.style.height = size + 'px';
    if (TOKEN.MOTION.move.base)
        made.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: TURN_MS,
            iterations: Infinity,
        });
    return { element: made };
}

// Shows once the load has taken WAIT_MS. `settled()` answers once it may go: at once if it has not shown, or once it
// has shown STAY_MS.
function loading({ text = '' } = {}) {
    const box = document.createElement('div');
    box.className = 'deckit-loading';
    box.append(spinner({ size: 20 }).element);
    if (text) {
        const words = document.createElement('div');
        words.className = 'deckit-loading-text';
        words.textContent = text;
        box.append(words);
    }
    const made = performance.now();
    box.animate([{ opacity: 0 }, { opacity: 1 }], {
        delay: WAIT_MS,
        duration: TOKEN.MOTION.fade,
        fill: 'backwards',
    });
    const settled = () => {
        const shown = performance.now() - made - WAIT_MS;
        const left = shown <= 0 ? 0 : STAY_MS - shown;
        return new Promise((resolve) => (left > 0 ? setTimeout(resolve, left) : resolve()));
    };
    return { element: box, settled };
}

export { STYLE, make };
