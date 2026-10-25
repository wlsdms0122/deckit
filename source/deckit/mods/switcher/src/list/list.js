const VIEW_MODEL = require('./view-model.js');

// MARK: - Property
// How each tone looks on a row of the Now strip: its mark, its glyph, the row's wash and the colour it breathes
// when it asks for attention. Only `alert` tints the row and `info` has no colour, so a colour still means
// something.
const TONE_LOOK = {
    info: {
        mark: 'rgba(128,128,128,.45)',
        glyph: '',
        wash: '',
        attention: 'rgba(128,128,128,.9)',
        peak: 'rgba(128,128,128,.26)',
    },
    ok: {
        mark: 'var(--deckit-ok)',
        glyph: 'var(--deckit-ok)',
        wash: '',
        attention: '',
        peak: 'color-mix(in srgb, var(--deckit-ok) 20%, transparent)',
    },
    warn: {
        mark: 'var(--deckit-warn)',
        glyph: 'var(--deckit-warn)',
        wash: '',
        attention: '',
        peak: 'color-mix(in srgb, var(--deckit-warn) 20%, transparent)',
    },
    alert: {
        mark: 'var(--deckit-alert)',
        glyph: 'var(--deckit-alert)',
        wash: 'color-mix(in srgb, var(--deckit-alert) 10%, transparent)',
        attention: '',
        peak: 'color-mix(in srgb, var(--deckit-alert) 24%, transparent)',
    },
};
const STYLE =
    `
    .switcher-row[data-numbers] .switcher-number { display: inline; }
    .switcher-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        padding: 7px 10px;
        border-radius: var(--deckit-radius-medium);
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .switcher-row[data-actionable] { cursor: pointer; }
    .switcher-row[data-lead] {
        gap: 11px;
        margin-bottom: 4px;
        padding: 9px 11px;
        border-radius: var(--deckit-radius-large);
        background: var(--switcher-wash, rgba(128, 128, 128, 0.1));
    }
    .switcher-row[data-active],
    .switcher-row[data-lead][data-active] { background: var(--deckit-selected); }
    .switcher-row[data-attention] { overflow: hidden; }
    .switcher-glyph { display: flex; flex: 0 0 auto; justify-content: center; width: 18px; opacity: 0.8; }
    .switcher-row[data-lead] .switcher-glyph { width: 22px; opacity: 0.75; }
    .switcher-mark {
        flex: 0 0 auto;
        align-self: stretch;
        width: 3px;
        border-radius: 2px;
        background: var(--switcher-mark);
    }
    .switcher-stack { display: flex; flex-direction: column; gap: 1px; flex: 1 1 auto; min-width: 0; }
    .switcher-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .switcher-label b { font-weight: 800; }
    .switcher-row[data-lead] .switcher-label { font: 600 var(--deckit-type-large); }
    .switcher-hint {
        flex: 0 0 auto;
        max-width: 45%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.45;
        font: var(--deckit-type-small);
    }
    .switcher-row[data-lead] .switcher-hint { max-width: none; opacity: 0.6; }
    .switcher-number {
        display: none;
        flex: 0 0 auto;
        margin-left: 10px;
        opacity: 0.55;
        font: var(--deckit-type-small);
        font-variant-numeric: tabular-nums;
    }
    .switcher-glow {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: var(--switcher-peak);
        opacity: 0;
        pointer-events: none;
    }
    .switcher-heading {
        padding: 12px 12px 4px;
        opacity: 0.45;
        font: 700 var(--deckit-type-caption);
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .switcher-heading[data-kind='group'] { padding: 8px 12px 3px; }
    .switcher-heading[data-kind='section'] {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        padding: 10px 12px 4px;
        border-top: var(--deckit-border);
        opacity: 0.55;
        font: 600 var(--deckit-type-small);
        letter-spacing: normal;
        text-transform: none;
    }
    .switcher-heading[data-first] { margin-top: 0; padding: 4px 12px 4px; border-top: 0; }
    .switcher-heading svg { width: 13px; height: 13px; }
` +
    Object.entries(TONE_LOOK)
        .map(([tone, look]) => {
            const row = `.switcher-row[data-tone='${tone}']`;
            return `
            ${row} { --switcher-mark: ${look.mark}; --switcher-peak: ${look.peak}; }
            ${look.wash ? `${row} { --switcher-wash: ${look.wash}; }` : ''}
            ${look.glyph ? `${row} .switcher-glyph { color: ${look.glyph}; opacity: 1; }` : ''}
            ${look.attention ? `${row}[data-attention] { --switcher-mark: ${look.attention}; }` : ''}
        `;
        })
        .join('');
// A row that asks for attention breathes three times, fading.
const BREATH = [
    { opacity: 0, offset: 0 },
    { opacity: 1, offset: 0.17 },
    { opacity: 0, offset: 0.34 },
    { opacity: 0.65, offset: 0.5 },
    { opacity: 0, offset: 0.67 },
    { opacity: 0.35, offset: 0.83 },
    { opacity: 0, offset: 1 },
];
const BREATH_MS = 2700;
// MARK: - Initializer
// MARK: - Public
// The switcher on screen: the kit's quick pick, filling the window, drawn from its view model. `deck` is the mod's;
// `items` are what the list holds and `now` the rows of the Now strip, `onQuery(raw, submenuId)` asks for answers and
// `onClose()` hears it start to go.
function open(deck, { placeholder, items, now, onQuery, onClose }) {
    const { ui, theme, util } = deck;
    ui.addStyle(STYLE);
    const model = VIEW_MODEL.make({
        util,
        placeholder,
        items,
        now,
        onQuery,
        onPick: (item) => item.run(),
    });
    const rows = new Set(); // the rows made, which show their ⌘ numbers while Command is held
    let numbered = false;
    const numbers = (on) => {
        numbered = on;
        for (const row of rows) row.toggleAttribute('data-numbers', on);
    };
    const picker = ui.quickPick({
        placeholder,
        fills: true,
        // It is all there is to move the window by.
        drags: true,
        glass: theme.glass,
        key: (entry) => entry.key,
        create: (entry) => {
            if (entry.heading) return headingOf(ui, entry);
            const row = element('div', 'switcher-row');
            fillRow(ui, theme, row, entry);
            row.toggleAttribute('data-numbers', numbered);
            rows.add(row);
            return row;
        },
        update: (made, entry) =>
            entry.heading ? made.toggleAttribute('data-first', entry.first) : fillRow(ui, theme, made, entry),
        optionOf: (entry) => (entry.heading ? null : { disabled: !entry.actionable }),
        onInput: (text) => model.type(text),
        onPick: (_entry, index) => model.choose(index),
        onActive: (_entry, index, { pointer }) => pointer && model.point(index),
        onCommandKey: numbers,
        onKey,
        onClose,
    });
    let submenuShown;
    draw();
    model.onChange(draw);
    return { model, close: () => picker.close() };

    // The view model owns the active row, so the arrows, Enter and ⌘1 to ⌘9 are its. Escape, and Backspace in an
    // empty field, leave a submenu before they close anything.
    function onKey(event) {
        const number = /^Digit([1-9])$/.exec(event.code);
        if (number && event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey)
            model.takeNumber(Number(number[1]));
        else if (event.key === 'Escape' || (event.key === 'Backspace' && !picker.text())) return model.back();
        else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') model.move(event.key === 'ArrowDown' ? 1 : -1);
        else if (event.key === 'Enter') model.confirm();
        else return false;
        return true;
    }

    function draw() {
        const state = model.state();
        if ((state.submenu?.id ?? null) !== submenuShown) {
            submenuShown = state.submenu?.id ?? null;
            picker.setText('');
            picker.setPlaceholder(state.placeholder);
            picker.setScope(state.submenu ? { icon: state.submenu.icon, label: state.submenu.label } : null);
            picker.focus();
        }
        const entries = state.rows.flatMap((row, index) => [
            ...row.headings.map((heading, level) => ({
                key: `${row.key}^${level}`,
                heading,
                first: index === 0 && level === 0,
            })),
            row,
        ]);
        const message = state.said?.text || (state.rows.length ? '' : 'No match');
        picker.set(entries, { active: state.active, message, alert: !!state.said?.alert });
    }
}

// MARK: - Private
function headingOf(ui, { heading, first }) {
    const made = element('div', 'switcher-heading');
    made.dataset.kind = heading.kind;
    made.toggleAttribute('data-first', !!first);
    if (heading.kind === 'section') {
        const title = element('span', '');
        title.textContent = heading.label;
        made.append(ui.sanitizeIcon(heading.icon), title);
    } else made.textContent = heading.label;
    return made;
}

// Drawn again only when what it shows changed, so a breath under way is not restarted.
function fillRow(ui, theme, made, { item, lit, hint, number, actionable }) {
    const drawn = JSON.stringify([
        item.label,
        item.icon,
        item.tone,
        item.attention,
        item.lead,
        lit,
        hint,
        number,
        actionable,
    ]);
    if (made.dataset.drawn === drawn) return;
    made.dataset.drawn = drawn;
    made.toggleAttribute('data-actionable', actionable);
    made.toggleAttribute('data-lead', !!item.lead);
    made.toggleAttribute('data-attention', !!(item.lead && item.attention));
    made.dataset.tone = item.tone;
    const glyph = element('span', 'switcher-glyph');
    if (item.icon) glyph.append(ui.sanitizeIcon(item.icon));
    const label = element('span', 'switcher-label');
    label.append(...labelOf(item.label, lit));
    const note = element('span', 'switcher-hint');
    note.textContent = hint;
    if (item.lead) {
        const stack = element('div', 'switcher-stack');
        stack.append(label, note);
        made.replaceChildren(element('span', 'switcher-mark'), glyph, stack);
        // Its own layer behind the text: the row's background is the active wash's.
        if (item.attention && theme.motion.fast) {
            const glow = element('span', 'switcher-glow');
            made.append(glow);
            glow.animate(BREATH, { duration: BREATH_MS, easing: 'ease-in-out' });
        }
    } else made.replaceChildren(glyph, label, note);
    if (number) {
        const badge = element('span', 'switcher-number');
        badge.textContent = '⌘' + number;
        made.append(badge);
    }
}

// The label with the letters the query matched drawn heavier.
function labelOf(text, positions) {
    const marked = new Set(positions);
    const parts = [];
    let segment = '';
    let heavy = false;
    const flush = () => {
        if (!segment) return;
        if (heavy) {
            const bold = document.createElement('b');
            bold.textContent = segment;
            parts.push(bold);
        } else parts.push(segment);
        segment = '';
    };
    for (let index = 0; index < text.length; index++) {
        if (marked.has(index) !== heavy) {
            flush();
            heavy = marked.has(index);
        }
        segment += text[index];
    }
    flush();
    return parts;
}

function element(tag, className) {
    const made = document.createElement(tag);
    if (className) made.className = className;
    return made;
}

module.exports = { open };
