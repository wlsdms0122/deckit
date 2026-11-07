// MARK: - Property
// The shell's own keys, in the order a person reads them: `id`, `name` as a person reads it, and `keystroke`, its
// default chord, `{ code, meta, control, alt, shift }` with `code` as a keyboard event names the key.
const KEYS = Object.freeze([
    key('toggleSidebar', 'Toggle Sidebar', { code: 'Backslash', meta: true }),
    key('back', 'Back to the Previous Mod', { code: 'BracketLeft', meta: true, control: true }),
    key('forward', 'Forward to the Next Mod', { code: 'BracketRight', meta: true, control: true }),
]);
// The modifiers as a chord is written, in the order it writes them.
const MODIFIERS = Object.freeze([
    ['control', '⌃'],
    ['alt', '⌥'],
    ['shift', '⇧'],
    ['meta', '⌘'],
]);
// A key that is no letter or digit, by its code, as a chord writes it.
const WRITTEN = Object.freeze({
    Backslash: '\\',
    BracketLeft: '[',
    BracketRight: ']',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Semicolon: ';',
    Quote: "'",
    Backquote: '`',
    Minus: '-',
    Equal: '=',
    Space: 'Space',
    Enter: '↩',
    Tab: '⇥',
    Escape: '⎋',
    Backspace: '⌫',
    Delete: '⌦',
    ArrowUp: '↑',
    ArrowDown: '↓',
    ArrowLeft: '←',
    ArrowRight: '→',
});

// MARK: - Initializer
// MARK: - Public
// A keystroke as it is kept and compared, its five members alone, or null for what has no code.
function keystrokeOf(given) {
    if (!given || typeof given !== 'object' || typeof given.code !== 'string' || !given.code) return null;
    const { code, meta, control, alt, shift } = given;
    return Object.freeze({ code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift });
}

// Whether two keystrokes are one chord.
function same(one, other) {
    return !!one && !!other && MODIFIERS.every(([name]) => one[name] === other[name]) && one.code === other.code;
}

// A keystroke as a person reads it: its modifiers, then its key, as `⌃⌘[`.
function written(keystroke) {
    const held = MODIFIERS.filter(([name]) => keystroke[name]).map(([, symbol]) => symbol);
    const { code } = keystroke;
    const name = WRITTEN[code] ?? (/^(Key|Digit)./.test(code) ? code.slice(code.startsWith('Key') ? 3 : 5) : code);
    return held.join('') + name;
}

// The chords the person set, as the shell's state kept them: a key's id -> its keystroke, or null for none. What is
// no key of the shell's, or no keystroke, is left out.
function keptOf(read) {
    if (!read || typeof read !== 'object' || Array.isArray(read)) return {};
    const kept = {};
    for (const { id } of KEYS) {
        if (!Object.hasOwn(read, id)) continue;
        if (read[id] === null) kept[id] = null;
        else if (keystrokeOf(read[id])) kept[id] = keystrokeOf(read[id]);
    }
    return kept;
}

// MARK: - Private
function key(id, name, keystroke) {
    return Object.freeze({ id, name, keystroke: keystrokeOf(keystroke) });
}

export { KEYS, keystrokeOf, same, written, keptOf };
