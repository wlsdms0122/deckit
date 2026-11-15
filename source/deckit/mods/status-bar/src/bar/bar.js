// The capsule: a panel window in the host's bar holding one button for each item that stands (items.js), laid as the
// model says (model/bar.js) in two regions: the fixed items at its right end, and left of them the others in a strip.
// A press on an item runs its command on its mod, and the rect of each item in view is told the shell as an anchor
// given to the item's mod, which stands a view of its own under it. The capsule closes while it lays no item.
const BAR = require('./model/bar.js');

const NAME = 'Status Bar';
const { ITEM } = BAR;
// How far from an end of the scrolled region what goes on past that end fades.
const FADE = 12;

const STYLE = `
    .status-bar { position: relative; height: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
    .status-bar-fixed, .status-bar-scrolled, .status-bar-strip { position: absolute; }
    .status-bar-scrolled { overflow: hidden; --status-bar-left: #000; --status-bar-right: #000; }
    .status-bar-scrolled[data-more~='left'] { --status-bar-left: transparent; }
    .status-bar-scrolled[data-more~='right'] { --status-bar-right: transparent; }
    .status-bar-scrolled[data-more] {
        -webkit-mask-image: linear-gradient(
            to right,
            var(--status-bar-left),
            #000 ${FADE}px,
            #000 calc(100% - ${FADE}px),
            var(--status-bar-right)
        );
        mask-image: linear-gradient(
            to right,
            var(--status-bar-left),
            #000 ${FADE}px,
            #000 calc(100% - ${FADE}px),
            var(--status-bar-right)
        );
    }
    .status-bar-strip { top: 0; left: 0; height: 100%; }
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
    const part = (tag, name) => Object.assign(document.createElement(tag), { className: `status-bar${name}` });
    const content = part('div', '');
    content.setAttribute('role', 'toolbar');
    content.setAttribute('aria-label', NAME);
    const measure = part('span', '-measure');
    const regions = { scrolled: part('div', '-scrolled'), fixed: part('div', '-fixed') };
    const strip = part('div', '-strip'); // what scrolls under the scrolled region
    regions.scrolled.append(strip);
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

    // The capsule as the model lays its items, the rect of each item in view told as an anchor given to the item's
    // mod. The shell is told a size and the anchors only as they change.
    function lay() {
        const items = held.standing();
        if (content.isConnected) for (const { label } of items) if (label && !(label in widths)) measured(label);
        const laid = BAR.barOf(items, { widths, fixed: held.fixed() });
        draw(laid, items);
        if (!laid.width) {
            window?.close();
            window = null;
            return;
        }
        const { width, height } = laid;
        const anchors = laid.items.flatMap(({ id, rect }) => (rect ? [{ id, rect, mod: id }] : []));
        const next = { size: `${width} ${height}`, anchors: JSON.stringify(anchors) };
        if (!window) {
            window = shell.windows.open({ name: 'bar', content, level: 'panel', width, height, didAppear: lay });
            told = { size: next.size, anchors: '' };
        }
        if (next.size !== told.size) window.resize(width, height);
        if (next.anchors !== told.anchors) window.setAnchors(anchors);
        told = next;
    }

    // The two regions where the model has them, each item a button where it is drawn in its region, and the strip
    // moved by how far it is scrolled. The scrolled region says at which ends more goes on past it.
    function draw(laid, items) {
        const buttons = (region) =>
            laid.items
                .filter((item) => item.region === region)
                .map(({ id, at }) =>
                    buttonOf(
                        items.find((item) => item.id === id),
                        at
                    )
                );
        const standing = Object.keys(regions).filter((region) => laid[region]);
        for (const region of standing) place(regions[region], laid[region]);
        regions.fixed.replaceChildren(...buttons('fixed'));
        strip.replaceChildren(...(laid.scrolled ? buttons('scrolled') : []));
        strip.style.width = `${laid.scrolled?.extent ?? 0}px`;
        strip.style.transform = `translateX(${-laid.scroll}px)`;
        const more = [...(laid.scroll > 0 ? ['left'] : []), ...(laid.scroll < laid.most ? ['right'] : [])];
        if (more.length) regions.scrolled.dataset.more = more.join(' ');
        else delete regions.scrolled.dataset.more;
        content.replaceChildren(measure, ...standing.map((region) => regions[region]));
    }

    function place(element, rect) {
        for (const side of ['width', 'height']) element.style[side] = `${rect[side]}px`;
        element.style.left = `${rect.x}px`;
        element.style.top = `${rect.y}px`;
    }

    function measured(label) {
        measure.textContent = label;
        const { width } = measure.getBoundingClientRect();
        if (width) widths[label] = width;
    }

    function buttonOf(item, at) {
        const button = part('button', '-item');
        button.dataset.item = item.id;
        button.dataset.tone = item.tone;
        button.setAttribute('aria-label', BAR.titleOf(item));
        button.disabled = item.command === null;
        place(button, at);
        if (item.icon) button.insertAdjacentHTML('beforeend', shell.ui.icon(item.icon, { size: ITEM.glyph }));
        for (const [name, text] of [
            ['label', item.label],
            ['count', item.count === null ? '' : BAR.countText(item.count)],
        ]) {
            if (!text) continue;
            const span = part('span', `-${name}`);
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
