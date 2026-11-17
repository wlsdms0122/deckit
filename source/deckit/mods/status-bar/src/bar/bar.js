// The capsule: a panel window in the host's bar holding one button for each item that stands (items.js), laid as the
// model says (model/bar.js) in two regions: the fixed items at its right end, and left of them the others in a strip
// that a turn of the wheel over it scrolls sideways. A press on an item runs its command on its mod, a context press
// on it opens the menu that fixes it or fixes it no more, and the rect of each item in view is told the shell as an
// anchor given to the item's mod, which stands a view of its own under it. The capsule closes while it lays no item.
const BAR = require('./model/bar.js');

const NAME = 'Status Bar';
const { ITEM } = BAR;
// How far from an end of the scrolled region what goes on past that end fades.
const FADE = 12;

const STYLE = `
    .status-bar { position: relative; height: 100%; font-size: 12px; font-variant-numeric: tabular-nums; }
    .status-bar-fixed, .status-bar-scrolled, .status-bar-strip { position: absolute; }
    /* How opaque each end of the scrolled region is drawn in its mask: none where more goes on past it. */
    .status-bar-scrolled { overflow: hidden; --status-bar-left: 1; --status-bar-right: 1; }
    .status-bar-scrolled[data-more~='left'] { --status-bar-left: 0; }
    .status-bar-scrolled[data-more~='right'] { --status-bar-right: 0; }
    .status-bar-scrolled[data-more] {
        -webkit-mask-image: linear-gradient(
            to right,
            rgb(0 0 0 / var(--status-bar-left)),
            #000 ${FADE}px,
            #000 calc(100% - ${FADE}px),
            rgb(0 0 0 / var(--status-bar-right))
        );
        mask-image: linear-gradient(
            to right,
            rgb(0 0 0 / var(--status-bar-left)),
            #000 ${FADE}px,
            #000 calc(100% - ${FADE}px),
            rgb(0 0 0 / var(--status-bar-right))
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
    .status-bar-item:disabled { pointer-events: none; }
    .status-bar-item:not(:disabled):hover { background: var(--deckit-hover); }
    .status-bar-item:not(:disabled):active { background: var(--deckit-pressed); }
    .status-bar-item[data-tone='attention'] { color: var(--deckit-accent); }
    /* A label is as wide as it was measured, the widest a label is laid at most: it is cut past that alone. */
    .status-bar-label { flex: none; max-width: ${ITEM.widest}px; overflow: hidden; text-overflow: ellipsis; }
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
    regions.scrolled.addEventListener('wheel', turned, { passive: false });
    content.addEventListener('contextmenu', asked);
    shell.ui.addStyle(STYLE);
    const widths = {}; // a label's or a count's text -> the width it was measured at
    let window = null; // the panel window, while it is open
    let told = { size: '', anchors: '' }; // the size and the anchors the shell was last told of it
    let scroll = 0; // how far the strip is scrolled (BAR.barOf)
    let scrolled = []; // the ids of the items in the strip as it was last laid
    let last = null; // the capsule as it was last laid (BAR.barOf)
    const kept = new Map(); // item id -> { button, face, item }: its button, kept while the item is laid
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

    // The capsule as the model lays its items in the room the shell told, an item that came into the strip scrolled
    // into view, and the rect of each item in view told as an anchor given to the item's mod. The shell is told a size
    // and the anchors only as they change.
    function lay() {
        const items = held.standing();
        const texts = items.flatMap(({ label, count }) => [label, count === null ? '' : BAR.countText(count)]);
        if (content.isConnected) for (const text of texts) if (text && !(text in widths)) measured(text);
        const given = { widths, fixed: held.fixed(), room: window?.room ?? null };
        let laid = BAR.barOf(items, { ...given, scroll });
        const inStrip = laid.items.filter(({ region }) => region === 'scrolled').map(({ id }) => id);
        const came = inStrip.filter((id) => !scrolled.includes(id)).at(-1);
        if (came !== undefined) laid = BAR.barOf(items, { ...given, scroll: BAR.scrollTo(laid, came) });
        scrolled = inStrip;
        scroll = laid.scroll;
        last = laid;
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
            const heard = { didAppear: lay, didChangeRoom: lay };
            window = shell.windows.open({ name: 'bar', content, level: 'panel', width, height, ...heard });
            told = { size: next.size, anchors: '' };
        }
        if (next.size !== told.size) window.resize(width, height);
        if (next.anchors !== told.anchors) window.setAnchors(anchors);
        told = next;
    }

    // The two regions where the model has them, left to right, each item a button where it is drawn in its region and
    // in the order it stands there (BAR.shownOf), so the document reads as the capsule shows; and the strip moved by
    // how far it is scrolled. The scrolled region says at which ends more goes on past it. An item's button is the
    // same element while the item is laid, and nothing that holds what it held already is written again, so what a
    // reader named and what has the focus stay as items are set anew.
    function draw(laid, items) {
        const given = new Map(items.map((item) => [item.id, item]));
        for (const id of [...kept.keys()]) if (!laid.items.some((item) => item.id === id)) kept.delete(id);
        const buttons = (region) => BAR.shownOf(laid, region).map(({ id, at }) => buttonOf(given.get(id), at));
        const standing = Object.keys(regions).filter((region) => laid[region]);
        for (const region of standing) place(regions[region], laid[region]);
        hold(regions.fixed, buttons('fixed'));
        hold(strip, laid.scrolled ? buttons('scrolled') : []);
        write(strip.style, 'width', `${laid.scrolled?.extent ?? 0}px`);
        write(strip.style, 'transform', `translateX(${-laid.scroll}px)`);
        const more = [...(laid.scroll > 0 ? ['left'] : []), ...(laid.scroll < laid.most ? ['right'] : [])];
        if (more.length) write(regions.scrolled.dataset, 'more', more.join(' '));
        else delete regions.scrolled.dataset.more;
        hold(content, [measure, ...standing.map((region) => regions[region])]);
    }

    // `parent` holds `children` in that order: left untouched where it does already.
    function hold(parent, children) {
        const now = parent.children;
        if (now.length === children.length && children.every((child, at) => now[at] === child)) return;
        parent.replaceChildren(...children);
    }

    function write(to, name, value) {
        if (to[name] !== value) to[name] = value;
    }

    function place(element, rect) {
        for (const side of ['width', 'height']) write(element.style, side, `${rect[side]}px`);
        write(element.style, 'left', `${rect.x}px`);
        write(element.style, 'top', `${rect.y}px`);
    }

    // A turn of the wheel over the scrolled region scrolls the strip.
    function turned(event) {
        event.preventDefault();
        scroll += BAR.turnOf({ dx: event.deltaX, dy: event.deltaY });
        lay();
    }

    // A context press on an item opens its menu under the capsule: one entry, which fixes the item or fixes it no more.
    function asked(event) {
        const menu = last && BAR.menuOf(last, held.fixed(), { x: event.clientX, y: event.clientY });
        if (!menu) return;
        event.preventDefault();
        const { id, label, on, point } = menu;
        shell.ui.menu({ items: [{ label, run: () => held.fix(id, on) }], point });
    }

    function measured(text) {
        measure.textContent = text;
        const { width } = measure.getBoundingClientRect();
        if (width) widths[text] = width;
    }

    // The button of `item` where it is drawn, `at`: made as the item is first laid, and from then on written only where
    // what it shows (BAR.faceOf) differs from what it drew.
    function buttonOf(item, at) {
        const { id } = item;
        if (!kept.has(id)) {
            const button = part('button', '-item');
            button.dataset.item = id;
            button.addEventListener('click', () => press(kept.get(id)?.item ?? item));
            kept.set(id, { button, face: {}, item });
        }
        const held = kept.get(id);
        const { button, face: drawn } = held;
        const face = BAR.faceOf(item);
        const differs = (...names) => names.some((name) => face[name] !== drawn[name]);
        if (differs('title')) button.setAttribute('aria-label', face.title);
        if (differs('tone')) button.dataset.tone = face.tone;
        if (differs('pressable')) button.disabled = !face.pressable;
        if (differs('icon', 'label', 'count')) fill(button, face);
        Object.assign(held, { face, item });
        place(button, at);
        return button;
    }

    // What a button holds: its glyph, its label and its count, each where the item shows one.
    function fill(button, { icon, label, count }) {
        const spans = Object.entries({ label, count }).flatMap(([name, text]) => {
            if (!text) return [];
            const span = part('span', `-${name}`);
            span.textContent = text;
            return [span];
        });
        button.replaceChildren(...spans);
        if (icon) button.insertAdjacentHTML('afterbegin', shell.ui.icon(icon, { size: ITEM.glyph }));
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
