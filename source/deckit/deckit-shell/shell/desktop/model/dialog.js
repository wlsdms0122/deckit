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

// MARK: - Initializer
// MARK: - Public
// The dialogs up, by window, and where each stands in its window: plain data the shell draws from. A dialog is
// `{ ask, kind, message, value, from }` as deckit hands it, and where its page shows, `at`, is what the shell knows of
// it, in the window's coordinates, from its frame's top left:
// - null: in no window, where it is refused;
// - `{ window, content }`: the window's content, `content` its rect; the dialog covers it, `whole` true;
// - `{ window, content, rect }`: a page shown in a part of it, `content` the rect of what shows the page (the window's
//   content, or a region's rect for a page laid in a region's child) and `rect` the page's in `content`'s coordinates;
//   the dialog covers that rect cut to `content`, `whole` false, and is refused where nothing of it is in `content`.
// Each up is `{ ask, window, rect, whole, kind, message, value, from }`, frozen.
function createDialogs() {
    // MARK: - Property
    const up = new Map(); // ask -> the dialog, where it stands now

    // MARK: - Public
    // The dialog asked, where `at` places it, kept up: answers it, or null where it stands nowhere, to be refused.
    function ask({ ask: id, kind, message, value, from }, at) {
        const place = placeOf(at);
        if (!place || up.has(id)) return null;
        const dialog = Object.freeze({ ask: id, ...place, kind, message, value, from });
        up.set(id, dialog);
        return dialog;
    }

    // The page of dialog `ask` shows somewhere else now: it stands where `at` places it. Where that is nowhere, the
    // page still waits on it, so it stays where it was. Answers it, or null for no dialog up.
    function move(id, at) {
        const held = up.get(id);
        const place = held && placeOf(at);
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
    // `{ window, rect, whole }` where `at` places a dialog, or null.
    function placeOf(at) {
        if (!at || at.window === null || at.window === undefined || !isRect(at.content)) return null;
        const content = { x: at.content.x, y: at.content.y, width: at.content.width, height: at.content.height };
        if (!('rect' in at)) return { window: at.window, rect: content, whole: true };
        if (!isRect(at.rect)) return null;
        const { x, y, width, height } = at.rect;
        const rect = cut({ x: content.x + x, y: content.y + y, width, height }, content);
        return rect && { window: at.window, rect, whole: false };
    }

    return Object.freeze({ ask, move, type, withdraw, of, inWindow });
}

// Where the parts of `dialog` are drawn, in its window's coordinates: the card at the top centre of its rect, the
// line that names who asks (`from`), the message with how many lines it takes, the field of a prompt, and each
// button, `{ name, label, rect }`, left to right.
function partsOf({ rect, kind, message }) {
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

// The part of `dialog` at `point`, in its window's coordinates: 'dialog-' and a button's name, 'dialog-field', or
// 'dialog' anywhere else over its rect.
function partAt(dialog, point) {
    const holds = ({ x, y, width, height }) =>
        point.x >= x && point.y >= y && point.x < x + width && point.y < y + height;
    const { field, buttons } = partsOf(dialog);
    const button = buttons.find(({ rect }) => holds(rect));
    if (button) return `dialog-${button.name}`;
    return field && holds(field) ? 'dialog-field' : 'dialog';
}

// What `dialog` is answered by its part `part` (partAt) pressed, `{ value }`, or null for a part that answers nothing:
// `ok` done, true, or a prompt's text, `cancel` false or null, `leave` true and `stay` false.
function answerOf({ kind, value }, part) {
    const name = String(part).replace(/^dialog-/, '');
    if (!(BUTTONS[kind] ?? []).includes(name)) return null;
    if (name === 'ok') return { value: kind === 'prompt' ? value : true };
    if (name === 'cancel') return { value: kind === 'prompt' ? null : false };
    return { value: name === 'leave' };
}

// The part of `dialog` a key presses: Return the last button, OK or Leave, Escape Cancel or Stay; or null.
function keyed({ kind }, key) {
    if (key === 'Enter') return `dialog-${BUTTONS[kind]?.at(-1)}`;
    return key === 'Escape' && ESCAPED[kind] ? `dialog-${ESCAPED[kind]}` : null;
}

export { createDialogs, partsOf, partAt, answerOf, keyed };
