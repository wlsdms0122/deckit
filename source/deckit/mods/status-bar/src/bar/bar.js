// The capsule: a panel window in the host's bar holding one button for each item that stands (items.js), laid as the
// model says (model/bar.js). A press on an item runs its command on its mod, and each item's rect is told the shell as
// an anchor given to the item's mod, which stands a view of its own under it. The capsule closes while it lays no
// item.
const BAR = require('./model/bar.js');

const NAME = 'Status Bar';
const { ITEM } = BAR;

const STYLE = `
    .status-bar { position: relative; height: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
    .status-bar-item {
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: ${ITEM.gap}px;
        box-sizing: border-box;
        padding: 0 ${ITEM.padding}px;
        border: 0;
        border-radius: var(--deckit-radius-round);
        background: transparent;
        color: var(--deckit-text);
        font: inherit;
        white-space: nowrap;
    }
    .status-bar-item:not(:disabled):hover { background: var(--deckit-hover); }
    .status-bar-item:not(:disabled):active { background: var(--deckit-pressed); }
    .status-bar-item[data-tone='attention'] { color: var(--deckit-accent); }
    .status-bar-label { overflow: hidden; text-overflow: ellipsis; }
    .status-bar-measure { position: absolute; visibility: hidden; white-space: nowrap; }
`;

// `held` is the items as they stand; `commands()` is the owner of deckit/commands while one is connected, or null.
function bar(shell, held, { commands = () => null } = {}) {
    // MARK: - Property
    const content = document.createElement('div');
    content.className = 'status-bar';
    content.setAttribute('role', 'toolbar');
    const measure = document.createElement('span');
    measure.className = 'status-bar-measure';
    shell.ui.addStyle(STYLE);
    const widths = {}; // label -> the width it was measured at
    let window = null; // the panel window, while it is open
    let told = { size: '', anchors: '' }; // the size and the anchors the shell was last told of it
    held.drawnBy(drawn);
    const off = held.onChange(lay);

    // MARK: - Initializer
    lay();

    // MARK: - Public
    function end() {
        off();
        held.drawnBy(null);
        window?.close();
        window = null;
    }

    // MARK: - Private
    // Whether the kit draws the glyph `icon`.
    function drawn(icon) {
        try {
            return !!shell.ui.icon(icon);
        } catch {
            return false;
        }
    }

    // The capsule as wide as the model lays its items, each item's rect told as an anchor given to the item's mod. The
    // shell is told a size and the anchors only as they change.
    function lay() {
        const items = held.standing();
        if (content.isConnected) for (const { label } of items) if (label && !(label in widths)) measured(label);
        const laid = BAR.barOf(items, widths, BAR.limitOf(null));
        content.setAttribute('aria-label', BAR.nameOf(NAME, laid.hidden));
        content.replaceChildren(
            measure,
            ...laid.items.map(({ id, rect }) =>
                buttonOf(
                    items.find((item) => item.id === id),
                    rect
                )
            )
        );
        if (!laid.width) {
            window?.close();
            window = null;
            return;
        }
        const { width, height } = laid;
        const anchors = laid.items.map(({ id, rect }) => ({ id, rect, mod: id }));
        const next = { size: `${width} ${height}`, anchors: JSON.stringify(anchors) };
        if (!window) {
            window = shell.windows.open({ name: 'bar', content, level: 'panel', width, height, didAppear: lay });
            told = { size: next.size, anchors: '' };
        }
        if (next.size !== told.size) window.resize(width, height);
        if (next.anchors !== told.anchors) window.setAnchors(anchors);
        told = next;
    }

    function measured(label) {
        measure.textContent = label;
        const { width } = measure.getBoundingClientRect();
        if (width) widths[label] = width;
    }

    function buttonOf(item, rect) {
        const button = document.createElement('button');
        button.className = 'status-bar-item';
        button.dataset.item = item.id;
        button.dataset.tone = item.tone;
        button.setAttribute('aria-label', BAR.titleOf(item));
        button.disabled = item.command === null;
        for (const side of ['width', 'height']) button.style[side] = `${rect[side]}px`;
        button.style.left = `${rect.x}px`;
        button.style.top = `${rect.y}px`;
        if (item.icon) button.insertAdjacentHTML('beforeend', shell.ui.icon(item.icon, { size: ITEM.glyph }));
        for (const [part, text] of [
            ['label', item.label],
            ['count', item.count === null ? '' : BAR.countText(item.count)],
        ]) {
            if (!text) continue;
            const span = document.createElement('span');
            span.className = `status-bar-${part}`;
            span.textContent = text;
            button.append(span);
        }
        button.addEventListener('click', () => press(item));
        return button;
    }

    // A press on an item runs its command on its mod, which launches the mod if it does not run.
    async function press({ id, name, command }) {
        try {
            const owner = commands();
            if (!owner) throw new Error('no mod runs commands now');
            await owner.run(id, command);
        } catch (error) {
            console.error(`[status-bar] the command of ${name} did not run`, error);
        }
    }

    return Object.freeze({ end });
}

module.exports = { bar };
