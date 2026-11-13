const VIEW_MODEL = require('./view-model.js');

// MARK: - Property
// The glyph an action that gives no icon leads with where its mod's section names the mod: run this.
const ACTION_GLYPH = 'play';
// How each tone looks on a row of the Now strip: its glyph, the row's wash and the colour it breathes when it asks for
// attention. Only `alert` tints the row and `info` has no colour, so a colour still means something.
const TONE_LOOK = {
    info: { glyph: '', wash: '', peak: 'var(--deckit-selected)' },
    ok: { glyph: 'var(--deckit-ok-ink)', wash: '', peak: 'color-mix(in srgb, var(--deckit-ok) 20%, transparent)' },
    warn: {
        glyph: 'var(--deckit-warn-ink)',
        wash: '',
        peak: 'color-mix(in srgb, var(--deckit-warn) 20%, transparent)',
    },
    alert: {
        glyph: 'var(--deckit-alert-ink)',
        wash: 'color-mix(in srgb, var(--deckit-alert) 10%, transparent)',
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
        transition: background-color var(--deckit-fade) var(--deckit-easing);
    }
    .switcher-row[data-actionable] { cursor: pointer; }
    .switcher-row[data-lead] {
        gap: 11px;
        margin-bottom: 4px;
        padding: 9px 11px;
        border-radius: var(--deckit-radius-large);
        background: var(--switcher-wash, var(--deckit-fill));
    }
    .switcher-row[data-active],
    .switcher-row[data-lead][data-active] { background: var(--deckit-selected); }
    .switcher-row[data-attention] { overflow: hidden; }
    .switcher-glyph {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: var(--deckit-app-icon-row);
        height: var(--deckit-app-icon-row);
        color: var(--deckit-muted);
    }
    /* The Switcher's own mark for an action that gives no icon: smaller and a step quieter than an action's own
       glyph, whatever the row's tone. */
    .switcher-glyph[data-action],
    .switcher-row[data-tone] .switcher-glyph[data-action] { color: var(--deckit-tertiary); }
    .switcher-row[data-lead] .switcher-glyph { width: var(--deckit-app-icon-lead); height: var(--deckit-app-icon-lead); }
    .switcher-stack { display: flex; flex-direction: column; gap: 1px; flex: 1 1 auto; min-width: 0; }
    .switcher-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .switcher-label b { font-weight: 600; }
    .switcher-row[data-lead] .switcher-label { font: 600 var(--deckit-type-large); }
    .switcher-hint {
        flex: 0 0 auto;
        max-width: 45%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--deckit-muted);
        font: var(--deckit-type-small);
    }
    .switcher-row[data-lead] .switcher-hint { max-width: none; }
    .switcher-hint[data-path] { display: flex; }
    .switcher-path-head { flex: 0 1 auto; min-width: 0; overflow: hidden; }
    .switcher-path-tail { flex: 0 0 auto; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
    .switcher-status {
        display: flex;
        flex: 0 0 auto;
        margin-left: 10px;
        color: var(--deckit-muted);
    }
    .switcher-status[data-status='done'] { color: var(--deckit-ok-ink); }
    .switcher-status[data-status='failed'] { color: var(--deckit-alert-ink); }
    .switcher-number {
        display: none;
        flex: 0 0 auto;
        margin-left: 10px;
        color: var(--deckit-muted);
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
        color: var(--deckit-muted);
        font: var(--deckit-type-label);
    }
    .switcher-heading[data-kind='group'] { padding: 8px 12px 3px; }
    .switcher-heading[data-kind='section'] {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 6px;
        padding: 10px 12px 4px;
        border-top: var(--deckit-border);
    }
    .switcher-heading[data-first] { margin-top: 0; padding: 4px 12px 4px; border-top: 0; }
` +
    Object.entries(TONE_LOOK)
        .map(([tone, look]) => {
            const row = `.switcher-row[data-tone='${tone}']`;
            return `
            ${row} { --switcher-peak: ${look.peak}; }
            ${look.wash ? `${row} { --switcher-wash: ${look.wash}; }` : ''}
            ${look.glyph ? `${row} .switcher-glyph { color: ${look.glyph}; }` : ''}
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
// The switcher on screen: the kit's quick pick, filling the window, drawn from its view model. `ui` and `theme` are the
// shell's; `items` are what the list holds and `now` the rows of the Now strip, `onQuery(raw, submenuId)` asks for
// answers, `onHeight(px)` hears the height its content takes, and `onClose()` hears it start to go.
function open({ ui, theme }, { placeholder, items, now, onQuery, onHeight, onClose }) {
    ui.addStyle(STYLE);
    const model = VIEW_MODEL.make({
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
        onHeight,
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
            const scope = state.submenu;
            picker.setScope(scope ? { icon: scope.icon, appIcon: scope.appIcon, label: scope.label } : null);
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
        made.append(ui.appIcon(heading.icon, { size: 'small' }), title);
    } else made.textContent = heading.label;
    return made;
}

// Drawn again only when what it shows changed, so a breath under way is not restarted.
function fillRow(ui, theme, made, { item, lit, hint, number, actionable, status }) {
    const drawn = JSON.stringify([
        item.label,
        item.icon,
        item.appIcon,
        item.actionGlyph,
        item.tone,
        item.attention,
        item.lead,
        lit,
        hint,
        number,
        actionable,
        status,
    ]);
    if (made.dataset.drawn === drawn) return;
    made.dataset.drawn = drawn;
    made.toggleAttribute('data-actionable', actionable);
    made.toggleAttribute('data-lead', !!item.lead);
    made.toggleAttribute('data-attention', !!(item.lead && item.attention));
    made.dataset.tone = item.tone;
    const glyph = element('span', 'switcher-glyph');
    if (item.appIcon) glyph.append(ui.appIcon(item.icon, { size: item.lead ? 'lead' : 'row' }));
    else if (item.icon) glyph.append(ui.sanitizeIcon(item.icon));
    else if (item.actionGlyph) {
        glyph.dataset.action = '';
        glyph.innerHTML = ui.icon(ACTION_GLYPH, { size: 14 });
    }
    const label = element('span', 'switcher-label');
    label.append(...labelOf(item.label, lit));
    const note = hintOf(hint);
    if (item.lead) {
        const stack = element('div', 'switcher-stack');
        stack.append(label, note);
        made.replaceChildren(glyph, stack);
        // Its own layer behind the text: the row's background is the active wash's.
        if (item.attention && theme.motion.move.fast) {
            const glow = element('span', 'switcher-glow');
            made.append(glow);
            glow.animate(BREATH, { duration: BREATH_MS, easing: 'ease-in-out' });
        }
    } else made.replaceChildren(glyph, label, note);
    if (note.dataset.path !== undefined) watchPath(made);
    if (status) made.append(statusOf(ui, status));
    if (number) {
        const badge = element('span', 'switcher-number');
        badge.textContent = '⌘' + number;
        made.append(badge);
    }
}

// The rows whose hint is a path, cut again to the room their row gives it as it is laid out and as it resizes. The
// row's width is not the hint's to change, so the cut never feeds back into what it measures.
let paths = null; // made as the first such row is
let measure = null; // a canvas's 2D context, which measures text without laying it out

// The hint, a path cut in its middle where it does not fit: its start gives way, its last two segments stay.
function hintOf(hint) {
    const made = element('span', 'switcher-hint');
    const cut = /^[/~]/.test(hint) ? hint.lastIndexOf('/', hint.lastIndexOf('/') - 1) : -1;
    if (cut <= 0) {
        made.textContent = hint;
        return made;
    }
    made.dataset.path = '';
    made.title = hint;
    const head = element('span', 'switcher-path-head');
    head.textContent = head.dataset.whole = hint.slice(0, cut);
    const tail = element('span', 'switcher-path-tail');
    tail.textContent = hint.slice(cut);
    made.append(head, tail);
    return made;
}

function watchPath(row) {
    paths ??= new ResizeObserver((entries) => {
        for (const { target } of entries) {
            if (!target.isConnected) paths.unobserve(target);
            else cutPath(target.querySelector('.switcher-hint[data-path]'));
        }
    });
    paths.observe(row);
}

// The start of the path in `hint` cut to the room it has, its own "…" right after the last letter kept, so it reads
// on into the segments kept as one string.
function cutPath(hint) {
    const head = hint?.querySelector('.switcher-path-head');
    if (!head) return;
    const whole = head.dataset.whole;
    head.textContent = whole;
    const room = head.clientWidth;
    if (head.scrollWidth <= room) return;
    const style = getComputedStyle(head);
    measure ??= document.createElement('canvas').getContext('2d');
    measure.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    let fits = 0;
    let over = whole.length;
    while (over - fits > 1) {
        const middle = (fits + over) >> 1;
        if (measure.measureText(whole.slice(0, middle) + '…').width <= room) fits = middle;
        else over = middle;
    }
    // Where not even the "…" fits, the start goes whole and the segments kept are cut at their end.
    head.textContent = fits || measure.measureText('…').width <= room ? whole.slice(0, fits) + '…' : '';
}

// A run under way turns; one ended says how.
function statusOf(ui, status) {
    const made = element('span', 'switcher-status');
    made.dataset.status = status;
    if (status === 'running') made.append(ui.spinner({ size: 12 }).element);
    else made.innerHTML = ui.icon(status === 'done' ? 'check' : 'x', { size: 14 });
    return made;
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
