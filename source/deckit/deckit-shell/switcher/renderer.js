import * as TOKEN from '../ui/token/index.js';
import * as ICON from '../ui/icon/index.js';
import * as KIT from '../ui/kit/index.js';
import * as MOD_STYLE from '../style/renderer.js';
import * as VIEW_MODEL from './view-model.js';
import * as PROTOCOL from './protocol.js';

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
    .deckit-switcher-row[data-numbers] .deckit-switcher-number { display: inline; }
    .deckit-switcher-row {
        position: relative;
        display: flex;
        align-items: center;
        gap: 9px;
        min-width: 0;
        padding: 7px 10px;
        border-radius: var(--deckit-radius-medium);
        transition: background-color var(--deckit-fast) var(--deckit-easing);
    }
    .deckit-switcher-row[data-actionable] { cursor: pointer; }
    .deckit-switcher-row[data-lead] {
        gap: 11px;
        margin-bottom: 4px;
        padding: 9px 11px;
        border-radius: var(--deckit-radius-large);
        background: var(--deckit-switcher-wash, rgba(128, 128, 128, 0.1));
    }
    .deckit-switcher-row[data-active],
    .deckit-switcher-row[data-lead][data-active] { background: var(--deckit-selected); }
    .deckit-switcher-row[data-attention] { overflow: hidden; }
    .deckit-switcher-glyph { display: flex; flex: 0 0 auto; justify-content: center; width: 18px; opacity: 0.8; }
    .deckit-switcher-row[data-lead] .deckit-switcher-glyph { width: 22px; opacity: 0.75; }
    .deckit-switcher-mark {
        flex: 0 0 auto;
        align-self: stretch;
        width: 3px;
        border-radius: 2px;
        background: var(--deckit-switcher-mark);
    }
    .deckit-switcher-stack { display: flex; flex-direction: column; gap: 1px; flex: 1 1 auto; min-width: 0; }
    .deckit-switcher-label { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .deckit-switcher-label b { font-weight: 800; }
    .deckit-switcher-row[data-lead] .deckit-switcher-label { font: 600 var(--deckit-type-large); }
    .deckit-switcher-hint {
        flex: 0 0 auto;
        max-width: 45%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        opacity: 0.45;
        font: var(--deckit-type-small);
    }
    .deckit-switcher-row[data-lead] .deckit-switcher-hint { max-width: none; opacity: 0.6; }
    .deckit-switcher-number {
        display: none;
        flex: 0 0 auto;
        margin-left: 10px;
        opacity: 0.55;
        font: var(--deckit-type-small);
        font-variant-numeric: tabular-nums;
    }
    .deckit-switcher-glow {
        position: absolute;
        inset: 0;
        z-index: -1;
        border-radius: inherit;
        background: var(--deckit-switcher-peak);
        opacity: 0;
        pointer-events: none;
    }
    .deckit-switcher-heading {
        padding: 12px 12px 4px;
        opacity: 0.45;
        font: 700 var(--deckit-type-caption);
        letter-spacing: 0.06em;
        text-transform: uppercase;
    }
    .deckit-switcher-heading[data-kind='group'] { padding: 8px 12px 3px; }
    .deckit-switcher-heading[data-kind='section'] {
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
    .deckit-switcher-heading[data-first] { margin-top: 0; padding: 4px 12px 4px; border-top: 0; }
    .deckit-switcher-heading svg { width: 13px; height: 13px; }
` +
    Object.entries(TONE_LOOK)
        .map(([tone, look]) => {
            const row = `.deckit-switcher-row[data-tone='${tone}']`;
            return `
            ${row} { --deckit-switcher-mark: ${look.mark}; --deckit-switcher-peak: ${look.peak}; }
            ${look.wash ? `${row} { --deckit-switcher-wash: ${look.wash}; }` : ''}
            ${look.glyph ? `${row} .deckit-switcher-glyph { color: ${look.glyph}; opacity: 1; }` : ''}
            ${look.attention ? `${row}[data-attention] { --deckit-switcher-mark: ${look.attention}; }` : ''}
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
// If no entries come (the panel's page never came up), the switcher puts itself away so it does not hold the
// keyboard empty.
const GIVE_UP_MILLISECONDS = 4000;

// MARK: - Initializer
// MARK: - Public
function boot(theme) {
    const ui = KIT.make(theme);
    KIT.addStyle(STYLE);
    MOD_STYLE.wear();
    let switcher = null;
    // Reported from the close itself: Escape and a click away close here first and main hears afterwards. It
    // answers the dismiss main waits on, and an exit overtaken by a reopen never answers, or it would answer the
    // next dismiss mid-fade.
    let closing = false;
    let exitTimer = null;
    let hiddenAnswer = null; // answers main's dismiss, once the exit has played
    let giveUpTimer = null;

    Object.assign(document.body.style, { margin: '0', background: 'transparent' });

    const entries = {
        need: () => PROTOCOL.need.send(),
        query: (raw, submenu) => PROTOCOL.query.send({ raw, submenu: submenu || null }),
        pick: (id) => PROTOCOL.pick.send({ id }),
    };
    let toned = false;
    PROTOCOL.supply.on(({ items, now, tones }) => {
        // A readout's tone with no look here is drawn as info: said once, in the log.
        if (!toned) {
            toned = true;
            const missing = tones.filter((tone) => !Object.hasOwn(TONE_LOOK, tone));
            if (missing.length) console.error(`[deckit] the switcher has no look for the tone ${missing.join(', ')}`);
        }
        clearTimeout(giveUpTimer);
        if (switcher) return;
        clearTimeout(exitTimer);
        closing = false;
        switcher = open(ui, {
            placeholder: 'Jump to a mod, bookmark or view…',
            items: hydrate(items),
            now: hydrate(now),
            // Resolvers and submenu searches live with the mods, in their pages.
            onQuery: (raw, submenuId) => entries.query(raw, submenuId),
            onPick: (item) => item.run(),
            onClose: () => {
                switcher = null;
                PROTOCOL.close.send();
                reportAfterExit();
            },
        });
    });
    PROTOCOL.now.on(({ rows }) => switcher?.model.setNow(hydrate(rows)));
    PROTOCOL.resolved.on(({ raw, entries: found, submenu }) =>
        switcher?.model.setResolved(String(raw || ''), hydrate(found), submenu || null)
    );
    PROTOCOL.open.on(() => {
        if (switcher) return;
        entries.need();
        clearTimeout(giveUpTimer);
        giveUpTimer = setTimeout(() => !switcher && PROTOCOL.close.send(), GIVE_UP_MILLISECONDS);
    });
    // ⌘1 to ⌘9 are caught in main, where only a chord taken first wins over the app's menu.
    PROTOCOL.number.on(({ number }) => switcher?.model.takeNumber(number));
    // The list goes with the view, so a reopen never shows stale entries.
    PROTOCOL.dismiss.handle(() => {
        const hidden = new Promise((resolve) => (hiddenAnswer = resolve));
        const closed = switcher;
        switcher = null;
        // Closing reports through onClose. With nothing open or closing, report now so main does not wait out
        // its guard timer.
        if (closed) closed.close();
        else if (!closing) reportHidden();
        return hidden;
    });
    PROTOCOL.ready.send();
    console.log('[deckit] switcher up');

    function reportHidden() {
        closing = false;
        exitTimer = null;
        hiddenAnswer?.();
        hiddenAnswer = null;
    }

    function reportAfterExit() {
        clearTimeout(exitTimer);
        const length = TOKEN.MOTION.base;
        if (!length) return reportHidden();
        closing = true;
        exitTimer = setTimeout(reportHidden, length);
    }

    // A function does not cross processes: `runnable` says an entry had run(), which becomes a pick sent back.
    function hydrate(list) {
        return (list || []).map((entry) => ({
            ...entry,
            run: entry.runnable ? () => entries.pick(entry.id) : undefined,
        }));
    }
}

// MARK: - Private
// The switcher on screen: the kit's quick pick, drawn from its view model.
function open(ui, { placeholder, items, now, onQuery, onPick, onClose }) {
    const model = VIEW_MODEL.make({ placeholder, items, now, onQuery, onPick, onClose: () => picker.close() });
    const rows = new Set(); // the rows made, which show their ⌘ numbers while Command is held
    let numbered = false;
    const numbers = (on) => {
        numbered = on;
        for (const row of rows) row.toggleAttribute('data-numbers', on);
    };
    const picker = ui.quickPick({
        placeholder,
        key: (entry) => entry.key,
        create: (entry) => {
            if (entry.heading) return headingOf(entry);
            const row = rowOf(entry);
            row.toggleAttribute('data-numbers', numbered);
            rows.add(row);
            return row;
        },
        update: (made, entry) =>
            entry.heading ? made.toggleAttribute('data-first', entry.first) : fillRow(made, entry),
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

    // The view model owns the active row, so the arrows and Enter are its. Escape, and Backspace in an empty
    // field, leave a submenu before they close anything.
    function onKey(event) {
        if (event.key === 'Escape' || (event.key === 'Backspace' && !picker.text())) return model.back();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') model.move(event.key === 'ArrowDown' ? 1 : -1);
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
        picker.set(entries, { active: state.active, message: state.rows.length ? '' : 'No match' });
    }
}

function headingOf({ heading, first }) {
    const made = element('div', 'deckit-switcher-heading');
    made.dataset.kind = heading.kind;
    made.toggleAttribute('data-first', !!first);
    if (heading.kind === 'section') {
        const title = element('span', '');
        title.textContent = heading.label;
        made.append(ICON.sanitize(heading.icon), title);
    } else made.textContent = heading.label;
    return made;
}

function rowOf(entry) {
    const made = element('div', 'deckit-switcher-row');
    fillRow(made, entry);
    return made;
}

// Drawn again only when what it shows changed, so a breath under way is not restarted.
function fillRow(made, { item, lit, hint, number, actionable }) {
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
    made.dataset.tone = TONE_LOOK[item.tone] ? item.tone : 'info';
    const glyph = element('span', 'deckit-switcher-glyph');
    if (item.icon) glyph.append(ICON.sanitize(item.icon));
    const label = element('span', 'deckit-switcher-label');
    label.append(...labelOf(item.label, lit));
    const note = element('span', 'deckit-switcher-hint');
    note.textContent = hint;
    if (item.lead) {
        const stack = element('div', 'deckit-switcher-stack');
        stack.append(label, note);
        made.replaceChildren(element('span', 'deckit-switcher-mark'), glyph, stack);
        // Its own layer behind the text: the row's background is the active wash's.
        if (item.attention && TOKEN.MOTION.fast) {
            const glow = element('span', 'deckit-switcher-glow');
            made.append(glow);
            glow.animate(BREATH, { duration: BREATH_MS, easing: 'ease-in-out' });
        }
    } else made.replaceChildren(glyph, label, note);
    if (number) {
        const badge = element('span', 'deckit-switcher-number');
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

export { boot };
