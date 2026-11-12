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
.deckit-skeleton { display: flex; flex-direction: column; }
.deckit-skeleton-row { display: flex; align-items: center; padding: 0 12px; }
.deckit-skeleton-bar { height: 12px; border-radius: var(--deckit-radius-small); background: var(--deckit-fill); }
    `;
const TURN_MS = 750;
// A load shorter than WAIT_MS shows nothing; one that shows stays at least STAY_MS, so it never flashes.
const WAIT_MS = 200;
const STAY_MS = 400;
// The widths of a skeleton's bars, row after row.
const WIDTHS = Object.freeze(['60%', '40%', '75%']);

// MARK: - Initializer
// MARK: - Public
function make() {
    return { spinner, loading: Object.assign((options) => loading(options), { skeleton }) };
}

// MARK: - Private
// Still while the system asks for reduced motion. `wait` shows it only once the load has taken WAIT_MS, as a row's icon
// slot does.
function spinner({ size = 14, wait = false } = {}) {
    const made = document.createElement('span');
    made.className = 'deckit-spinner';
    made.style.width = made.style.height = size + 'px';
    if (TOKEN.MOTION.move.base)
        made.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], {
            duration: TURN_MS,
            iterations: Infinity,
        });
    if (wait) shown(made);
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
    return { element: box, settled: shown(box) };
}

// The shape of a list on its way: `rows` rows `height` px tall, each a still bar in `fill`, shown and settled as
// `loading` is.
function skeleton({ rows = 3, height = 28 } = {}) {
    const box = document.createElement('div');
    box.className = 'deckit-skeleton';
    box.setAttribute('aria-busy', 'true');
    for (let at = 0; at < rows; at++) {
        const row = document.createElement('div');
        row.className = 'deckit-skeleton-row';
        row.style.height = height + 'px';
        const bar = document.createElement('div');
        bar.className = 'deckit-skeleton-bar';
        bar.style.width = WIDTHS[at % WIDTHS.length];
        row.append(bar);
        box.append(row);
    }
    return { element: box, settled: shown(box) };
}

// `box` fades in to its own opacity once WAIT_MS has passed; answers `settled()`.
function shown(box) {
    const made = performance.now();
    box.animate([{ opacity: 0, offset: 0 }], {
        delay: WAIT_MS,
        duration: TOKEN.MOTION.fade,
        fill: 'backwards',
    });
    const settled = () => {
        const seen = performance.now() - made - WAIT_MS;
        const left = seen <= 0 ? 0 : STAY_MS - seen;
        return new Promise((resolve) => (left > 0 ? setTimeout(resolve, left) : resolve()));
    };
    return settled;
}

export { STYLE, make };
