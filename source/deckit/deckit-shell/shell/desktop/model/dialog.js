// MARK: - Property
// What of the rect `one` is in the rect `other`, or null where nothing is.
const cut = (one, other) => {
    const [x, y] = [Math.max(one.x, other.x), Math.max(one.y, other.y)];
    const width = Math.min(one.x + one.width, other.x + other.width) - x;
    const height = Math.min(one.y + one.height, other.y + other.height) - y;
    return width > 0 && height > 0 ? { x, y, width, height } : null;
};
const isRect = (rect) =>
    !!rect &&
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) &&
    rect.width > 0 &&
    rect.height > 0;
// The buttons of each kind, left to right, the last the one Return presses; and what each answers its page.
const BUTTONS = Object.freeze({
    alert: ['ok'],
    confirm: ['cancel', 'ok'],
    prompt: ['cancel', 'ok'],
    leave: ['stay', 'leave'],
});
const ESCAPED = Object.freeze({ confirm: 'cancel', prompt: 'cancel', leave: 'stay' });
const LABELS = Object.freeze({ ok: 'OK', cancel: 'Cancel', leave: 'Leave', stay: 'Stay' });
// The card, px: at most this wide, this far from the rect's sides and top, its padding, a line of text, the most
// lines of the message, about how wide a character of it is, the field's height and a button's size and gap.
const CARD = Object.freeze({ width: 320, margin: 16, padding: 16, line: 18, lines: 6, glyph: 7, field: 28 });
const BUTTON = Object.freeze({ width: 76, height: 28, gap: 8 });
// A picker's list, drawn as the kit draws a menu, px: a row's height, the padding round its rows and its least width.
const LIST = Object.freeze({ row: 28, padding: 4, width: 160 });
const STEPS = Object.freeze({ ArrowUp: -1, ArrowDown: 1 });

// MARK: - Initializer
// MARK: - Public
// The dialogs up, by window, and where each stands in its window: plain data the shell draws from. A dialog is
// `{ ask, kind, message, value, from }` as deckit hands it, or a picker, `kind` `select`, `{ ask, kind, name, options,
// rect, from }`, `rect` its control's in its page, and where its page shows, `at`, is what the shell knows of it, in
// the window's coordinates, from its frame's top left:
// - null: in no window, where it is refused;
// - `{ window, content }`: the window's content, `content` its rect; the dialog covers it, `whole` true;
// - `{ window, content, rect }`: a page shown in a part of it, `content` the rect of what shows the page (the window's
//   content, or a region's rect for a page laid in a region's child) and `rect` the page's in `content`'s coordinates;
//   the dialog covers that rect cut to `content`, `whole` false, and is refused where nothing of it is in `content`.
// Each up is `{ ask, window, rect, whole, kind, message, value, from }`, frozen. A picker up is `{ ask, window, rect,
// whole, kind, name, options, control, at, from }`: `rect` its list's, under its control, raised where it would pass
// the bottom of what shows its page, `control` the rect it was asked with, and `at` the index of the option moved to,
// first the one selected.
function createDialogs() {
    // MARK: - Property
    const up = new Map(); // ask -> the dialog, where it stands now

    // MARK: - Public
    // The dialog asked, where `at` places it, kept up: answers it, or null where it stands nowhere, to be refused.
    function ask({ ask: id, kind, message, value, from, name, options, rect }, at) {
        const held =
            kind === 'select'
                ? { kind, name, options, control: rect, at: options.findIndex(({ selected }) => selected), from }
                : { kind, message, value, from };
        const place = placeOf(at, held);
        if (!place || up.has(id)) return null;
        const dialog = Object.freeze({ ask: id, ...place, ...held });
        up.set(id, dialog);
        return dialog;
    }

    // The page of dialog `ask` shows somewhere else now: it stands where `at` places it. Where that is nowhere, the
    // page still waits on it, so it stays where it was. Answers it, or null for no dialog up.
    function move(id, at) {
        const held = up.get(id);
        const place = held && placeOf(at, held);
        if (!place) return held ?? null;
        const dialog = Object.freeze({ ...held, ...place });
        up.set(id, dialog);
        return dialog;
    }

    // The text of prompt `ask` is `text` now, as a seat typed it. Answers the dialog, or null for no prompt up.
    function type(id, text) {
        const held = up.get(id);
        if (held?.kind !== 'prompt' || typeof text !== 'string') return null;
        const dialog = Object.freeze({ ...held, value: text });
        up.set(id, dialog);
        return dialog;
    }

    // Picker `ask` moved to the next option not disabled up or down, as `key` steps, where there is one. Answers the
    // picker, or null for no picker up or a key that steps nowhere.
    function step(id, key) {
        const held = up.get(id);
        if (held?.kind !== 'select' || !(key in STEPS)) return null;
        const { options, at } = held;
        let next = at + STEPS[key];
        while (options[next]?.disabled) next += STEPS[key];
        if (!options[next]) return null;
        const picker = Object.freeze({ ...held, at: next });
        up.set(id, picker);
        return picker;
    }

    // Dialog `ask` is up no more. Answers whether it was.
    function withdraw(id) {
        return up.delete(id);
    }

    // The dialog `ask` up, or null.
    function of(id) {
        return up.get(id) ?? null;
    }

    // The dialogs up in window `id`, in the order they were asked.
    function inWindow(id) {
        return [...up.values()].filter(({ window }) => window === id);
    }

    // MARK: - Private
    // `{ window, rect, whole }` where `at` places the dialog `held`, or null.
    function placeOf(at, held) {
        if (!at || at.window === null || at.window === undefined || !isRect(at.content)) return null;
        const content = { x: at.content.x, y: at.content.y, width: at.content.width, height: at.content.height };
        const whole = !('rect' in at);
        if (!whole && !isRect(at.rect)) return null;
        if (held.kind === 'select') return { window: at.window, rect: listOf(held, content, at.rect), whole };
        if (whole) return { window: at.window, rect: content, whole: true };
        const { x, y, width, height } = at.rect;
        const rect = cut({ x: content.x + x, y: content.y + y, width, height }, content);
        return rect && { window: at.window, rect, whole: false };
    }

    return Object.freeze({ ask, move, type, step, withdraw, of, inWindow });
}

// The rect of the list of `picker` whose page is at `page` in `content`, the content itself where none is given.
function listOf({ options, control }, content, page = { x: 0, y: 0 }) {
    const [x, y] = [content.x + page.x + control.x, content.y + page.y + control.y + control.height];
    const height = 2 * LIST.padding + rowsIn(options).length * LIST.row;
    const lowest = content.y + content.height - height;
    return { x, y: Math.max(content.y, Math.min(y, lowest)), width: Math.max(LIST.width, control.width), height };
}

// The rows of a picker's options in order, each `{ index }` of an option or `{ group }`, a group's label, before the
// first option of each group.
function rowsIn(options) {
    return options.flatMap(({ group }, index) => {
        const opens = group !== null && group !== undefined && options[index - 1]?.group !== group;
        return [...(opens ? [{ group }] : []), { index }];
    });
}

// The rows of `picker` where they are drawn, top to bottom, in its window's coordinates: `{ rect, group }` for a
// group's label, and `{ rect, index, label, disabled, selected, grouped, at }` for an option, `at` whether it is the
// one moved to.
function rowsOf({ rect, options, at }) {
    return rowsIn(options).map((row, n) => {
        const place = {
            x: rect.x + LIST.padding,
            y: rect.y + LIST.padding + n * LIST.row,
            width: rect.width - 2 * LIST.padding,
            height: LIST.row,
        };
        if ('group' in row) return { rect: place, group: row.group };
        const { label, disabled, selected, group } = options[row.index];
        const grouped = group !== null && group !== undefined;
        return { rect: place, index: row.index, label, disabled, selected, grouped, at: row.index === at };
    });
}

// Where the parts of `dialog` are drawn, in its window's coordinates: the card at the top centre of its rect, the
// line that names who asks (`from`), the message with how many lines it takes, the field of a prompt, and each
// button, `{ name, label, rect }`, left to right; of a picker, its `list` and its rows (rowsOf).
function partsOf(dialog) {
    const { rect, kind, message } = dialog;
    if (kind === 'select') return { list: rect, rows: rowsOf(dialog) };
    const { margin, padding, line } = CARD;
    const width = Math.max(0, Math.min(CARD.width, rect.width - 2 * margin));
    const inner = width - 2 * padding;
    const x = rect.x + (rect.width - width) / 2;
    const top = rect.y + margin;
    const from = { x: x + padding, y: top + padding, width: inner, height: line };
    const lines = Math.min(CARD.lines, Math.max(1, Math.ceil((String(message).length * CARD.glyph) / (inner || 1))));
    const said = { x: from.x, y: from.y + line + 4, width: inner, height: lines * line, lines };
    const field =
        kind === 'prompt' ? { x: from.x, y: said.y + said.height + 12, width: inner, height: CARD.field } : null;
    const row = (field ?? said).y + (field ?? said).height + 16;
    const names = BUTTONS[kind] ?? [];
    const buttons = names.map((name, at) => ({
        name,
        label: LABELS[name],
        rect: {
            x: x + width - padding - (names.length - at) * BUTTON.width - (names.length - at - 1) * BUTTON.gap,
            y: row,
            width: BUTTON.width,
            height: BUTTON.height,
        },
    }));
    const card = { x, y: top, width, height: row + BUTTON.height + padding - top };
    return { card, from, message: said, field, buttons };
}

// The part of `dialog` at `point`, in its window's coordinates: 'dialog-' and a button's name, 'dialog-field',
// 'dialog-option-' and the number of a picker's option, from 1, or 'dialog' anywhere else over its rect.
function partAt(dialog, point) {
    const holds = ({ x, y, width, height }) =>
        point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
    if (dialog.kind === 'select') {
        const row = rowsOf(dialog).find(({ rect, group }) => group === undefined && holds(rect));
        return row ? `dialog-option-${row.index + 1}` : 'dialog';
    }
    const { field, buttons } = partsOf(dialog);
    const button = buttons.find(({ rect }) => holds(rect));
    if (button) return `dialog-${button.name}`;
    return field && holds(field) ? 'dialog-field' : 'dialog';
}

// What `dialog` is answered by its part `part` (partAt) pressed, `{ value }`, or null for a part that answers nothing:
// `ok` done, true, or a prompt's text, `cancel` false or null, `leave` true and `stay` false; of a picker, an option
// not disabled its index, and `away` null, which puts it away.
function answerOf({ kind, value, options }, part) {
    const name = String(part).replace(/^dialog-/, '');
    if (kind === 'select') {
        const [, number] = /^option-(\d+)$/.exec(name) ?? [];
        const option = number && options[number - 1];
        if (name === 'away') return { value: null };
        return option && !option.disabled ? { value: number - 1 } : null;
    }
    if (!(BUTTONS[kind] ?? []).includes(name)) return null;
    if (name === 'ok') return { value: kind === 'prompt' ? value : true };
    if (name === 'cancel') return { value: kind === 'prompt' ? null : false };
    return { value: name === 'leave' };
}

// The part of `dialog` a key presses: Return the last button, OK or Leave, Escape Cancel or Stay; of a picker, Return
// the option moved to and Escape `away`; or null.
function keyed({ kind, at }, key) {
    if (kind === 'select') {
        if (key === 'Enter') return at >= 0 ? `dialog-option-${at + 1}` : null;
        return key === 'Escape' ? 'dialog-away' : null;
    }
    if (key === 'Enter') return `dialog-${BUTTONS[kind]?.at(-1)}`;
    return key === 'Escape' && ESCAPED[kind] ? `dialog-${ESCAPED[kind]}` : null;
}

// Whether `dialog` covers a page of the window it stands in, `asked` whether that page asked it: a dialog of the
// window's content covers every page laid over it, any other the page that waits on it alone, and a picker the page
// that asked it alone.
function covers({ whole, kind }, asked) {
    return !!asked || (!!whole && kind !== 'select');
}

// Whether the page that asked `dialog` waits on it: on any but a picker.
function waitsOn({ kind }) {
    return kind !== 'select';
}

export { createDialogs, partsOf, partAt, answerOf, keyed, covers, waitsOn };
