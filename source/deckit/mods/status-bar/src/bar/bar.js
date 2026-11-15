// The capsule: a panel window in the host's bar holding one button for each item mods give, laid as the model says
// (model/bar.js). A fixed item is one a mod declares in its manifest; an item that comes and goes is set and removed
// by a running mod. A press on an item runs its command on its mod, and each item's rect is told the shell as an
// anchor given to the item's mod, which stands a view of its own under it. The capsule closes while it lays no item.
const BAR = require('./model/bar.js');

const INTERFACE = 'status-bar/items';
const NAME = 'Status Bar';
// The signals of the interface after which what is declared to it is read again.
const SIGNALS = ['contributions-changed', 'owner-changed'];
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

// `commands()` is the owner of deckit/commands while one is connected, or null.
function bar(shell, deckit, { commands = () => null } = {}) {
    // MARK: - Property
    const content = document.createElement('div');
    content.className = 'status-bar';
    content.setAttribute('role', 'toolbar');
    const measure = document.createElement('span');
    measure.className = 'status-bar-measure';
    shell.ui.addStyle(STYLE);
    let declared = new Map(); // mod id -> what it declared, in the mods' order
    const set = new Map(); // mod id -> its item as it last set it
    let came = []; // the ids of the mods whose item comes and goes, in the order they came
    const widths = {}; // label -> the width it was measured at
    let window = null; // the panel window, while it is open
    const offs = SIGNALS.map((signal) => deckit.events.on(`${INTERFACE}:${signal}`, read));

    // MARK: - Initializer
    read();

    // MARK: - Public
    // The exports for a connection: `set(item)` gives the mod's item, or what changes of the one it declared, and
    // `remove()` takes it back. Another shape is refused, kind `INVALID_ARGUMENT`.
    function exportsFor(connection) {
        const id = connection.credential.mod;
        return Object.freeze({
            set: async (given) => {
                const held = BAR.heldTo(given, declared.get(id) ?? null);
                if (!held || !drawn(held.icon)) throw refusal(`${connection.mod.name} set an item of another shape`);
                set.set(id, held);
                lay();
            },
            remove: async () => leave(id),
        });
    }

    // A mod's item goes with its connection.
    function leave(id) {
        if (set.delete(id)) lay();
    }

    function end() {
        for (const off of offs) off();
        window?.close();
        window = null;
    }

    // MARK: - Private
    // What mods declare, one item a mod, the first it declares: an entry of another shape is left out.
    async function read() {
        const next = new Map();
        for (const { credential, entry } of await deckit.exports.contributions(INTERFACE).catch(() => [])) {
            const held = BAR.declaredOf(entry);
            if (held && drawn(held.icon) && !next.has(credential.mod)) next.set(credential.mod, held);
            else console.warn(`[status-bar] an item ${credential.mod} declares is left out`);
        }
        // What a mod set stays over what it declares now; one that declares an item where it did not, or no more,
        // sets its item anew.
        for (const [id, { label, count, tone }] of set) {
            if (declared.has(id) !== next.has(id)) set.delete(id);
            else if (next.has(id)) set.set(id, BAR.heldTo({ label, count, tone }, next.get(id)));
        }
        declared = next;
        lay();
    }

    // Whether the kit draws the glyph `icon`, or there is none to draw.
    function drawn(icon) {
        try {
            return icon === null || !!shell.ui.icon(icon);
        } catch {
            return false;
        }
    }

    // The items in the order they stand: the fixed ones in the mods' order, then the others as they came.
    function standing() {
        came = BAR.orderOf(
            came,
            [...set.keys()].filter((id) => !declared.has(id))
        );
        const fixed = [...declared].map(([id, item]) => ({ id, ...(set.get(id) ?? BAR.restOf(item)) }));
        return [...fixed, ...came.map((id) => ({ id, ...set.get(id) }))];
    }

    // The capsule as wide as the model lays its items, each item's rect told as an anchor given to the item's mod.
    function lay() {
        const items = standing();
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
        if (window) window.resize(laid.width, laid.height);
        else {
            const { width, height } = laid;
            window = shell.windows.open({ name: 'bar', content, level: 'panel', width, height, didAppear: lay });
        }
        window.setAnchors(laid.items.map(({ id, rect }) => ({ id, rect, mod: id })));
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

    function refusal(message) {
        return Object.assign(new Error(message), { kind: 'INVALID_ARGUMENT' });
    }

    return Object.freeze({ exportsFor, leave, end });
}

module.exports = { bar, INTERFACE };
