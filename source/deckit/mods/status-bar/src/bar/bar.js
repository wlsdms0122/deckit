// The capsule: a panel window as wide as its row, each child of `status-bar/items` in a region of its own, in the
// mods' order, as wide as the child last told (`setWidth`) or an icon's item until it tells. It follows the children
// as they join and leave, and closes while there is none.
const INTERFACE = 'status-bar/items';
// The capsule's height, and the inset around its row of 24px items, 4 apart: concentric with the capsule's round ends.
const HEIGHT = 28;
const INSET = 2;
const GAP = 4;
// An item that has told no width: a 16px glyph with 8 on each side.
const ICON_ITEM = 32;
// The widest an item is laid.
const WIDEST = 320;

const STYLE = `
    .status-bar {
        display: flex;
        align-items: stretch;
        gap: ${GAP}px;
        box-sizing: border-box;
        height: 100%;
        padding: ${INSET}px;
    }
    .status-bar-item { flex: 0 0 auto; border-radius: var(--deckit-radius-round); }
`;

function bar(shell) {
    // MARK: - Property
    const content = document.createElement('div');
    content.className = 'status-bar';
    shell.ui.addStyle(STYLE);
    const items = new Map(); // child id -> { element, region }
    const widths = new Map(); // child id -> the width it told
    let order = []; // the children's ids, in the mods' order
    let window = null; // the panel window, while it is open
    const off = shell.children.onChange((named, children) => named === INTERFACE && lay(children));

    // MARK: - Initializer
    shell.children.list(INTERFACE).then(lay, () => {});

    // MARK: - Public
    // The width the child `id` draws at: one past WIDEST is laid at WIDEST, and one that is no number above 0 is not
    // taken.
    function setWidth(id, width) {
        if (typeof width !== 'number' || !(width > 0)) return;
        widths.set(id, Math.min(Math.ceil(width), WIDEST));
        size();
    }

    function end() {
        off();
        window?.close();
        window = null;
    }

    // MARK: - Private
    // A child that left takes its region with it; one that joined is placed in a region of its own, which launches it
    // where it does not run.
    function lay(children) {
        order = children.map(({ id }) => id);
        for (const [id, { element }] of items) {
            if (order.includes(id)) continue;
            element.remove();
            items.delete(id);
            widths.delete(id);
        }
        for (const id of order) {
            if (items.has(id)) continue;
            const element = document.createElement('div');
            element.className = 'status-bar-item';
            element.dataset.child = id;
            const region = shell.region(element, INTERFACE);
            items.set(id, { element, region });
            region.place(id).catch(() => {});
        }
        content.append(...order.map((id) => items.get(id).element));
        size();
    }

    // Each item as wide as its child draws, and the window as wide as the row.
    function size() {
        let width = INSET * 2 + Math.max(0, order.length - 1) * GAP;
        for (const id of order) {
            const each = widths.get(id) ?? ICON_ITEM;
            items.get(id).element.style.width = `${each}px`;
            width += each;
        }
        if (!order.length) {
            window?.close();
            window = null;
            return;
        }
        if (window) return window.resize(width, HEIGHT);
        window = shell.windows.open({ name: 'bar', content, level: 'panel', width, height: HEIGHT });
    }

    return Object.freeze({ setWidth, end });
}

module.exports = { bar, INTERFACE };
