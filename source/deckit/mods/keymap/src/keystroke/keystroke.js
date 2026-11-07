// A key as it is pressed, `{ code, meta, control, alt, shift }`: the physical key by its code, as a keyboard event
// names it, and the modifiers held with it. A chord is matched on the physical key, since a modifier can change the
// character typed. A spec is a chord as a manifest writes it, "mod+shift+k".

// MARK: - Property
// What a key that works past its page, taken from every page, text fields included, needs of its chord.
const WIDE_RULE = 'a key that works past its page needs ⌘, ⌃ or ⌥, and none a field with focus takes';

// A key's name in a spec, by its physical code, beside letters, digits and f1 to f19.
const CODES = Object.freeze({
    left: 'ArrowLeft',
    right: 'ArrowRight',
    up: 'ArrowUp',
    down: 'ArrowDown',
    enter: 'Enter',
    escape: 'Escape',
    space: 'Space',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    '[': 'BracketLeft',
    ']': 'BracketRight',
    ',': 'Comma',
    '.': 'Period',
    '/': 'Slash',
    '\\': 'Backslash',
    '-': 'Minus',
    '=': 'Equal',
    ';': 'Semicolon',
    "'": 'Quote',
    '`': 'Backquote',
});
const NAMES = Object.freeze(Object.fromEntries(Object.entries(CODES).map(([name, code]) => [code, name])));
// A modifier's words in a spec. `mod` is ⌘, the key the app's own chords are made with.
const MODIFIER_WORDS = Object.freeze({
    mod: 'meta',
    cmd: 'meta',
    meta: 'meta',
    ctrl: 'control',
    control: 'control',
    shift: 'shift',
    alt: 'alt',
    opt: 'alt',
    option: 'alt',
});
// The modifiers in the order a spec and a chord write them, with how each writes it.
const MODIFIERS = Object.freeze([
    Object.freeze(['control', 'ctrl', '⌃']),
    Object.freeze(['alt', 'alt', '⌥']),
    Object.freeze(['shift', 'shift', '⇧']),
    Object.freeze(['meta', 'cmd', '⌘']),
]);
const SYMBOLS = Object.freeze({
    backspace: '⌫',
    delete: '⌦',
    enter: '↩',
    escape: '⎋',
    tab: '⇥',
    left: '←',
    right: '→',
    up: '↑',
    down: '↓',
});
// Keys a focused text field owns whatever a mod binds them to: caret moves and deletion with any modifier (⌘← is the
// start of the line), and the ⌘ edit commands.
const EDITING = new Set([
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Backspace',
    'Delete',
]);
const EDIT_COMMANDS = new Set(['KeyA', 'KeyC', 'KeyX', 'KeyV', 'KeyZ']);

// MARK: - Initializer
// MARK: - Public
// A spec as the keystroke it names, or null. A second key or an unknown word refuses the whole spec, so a typo is not
// bound as another chord.
function parse(spec) {
    if (typeof spec !== 'string') return null;
    const held = { meta: false, control: false, alt: false, shift: false };
    let code = null;
    for (const written of spec.toLowerCase().split('+')) {
        const word = written.trim();
        if (!word) continue;
        if (Object.hasOwn(MODIFIER_WORDS, word)) {
            held[MODIFIER_WORDS[word]] = true;
            continue;
        }
        const named = codeOf(word);
        if (code || !named) return null;
        code = named;
    }
    return code ? keystrokeOf({ code, ...held }) : null;
}

// A keystroke with its five members alone, or null for what has no code.
function keystrokeOf(given) {
    if (!given || typeof given !== 'object' || typeof given.code !== 'string' || !given.code) return null;
    const { code, meta, control, alt, shift } = given;
    return Object.freeze({ code, meta: !!meta, control: !!control, alt: !!alt, shift: !!shift });
}

// One spelling per chord, so two specs compare as text: "ctrl+alt+shift+cmd+t". Null for a key a spec cannot name.
function specOf(keystroke) {
    const name = nameOf(keystroke.code);
    if (!name) return null;
    return [...MODIFIERS.filter(([member]) => keystroke[member]).map(([, word]) => word), name].join('+');
}

// A keystroke as a person reads it: ⌃⌥⇧⌘ in that order, then its key, as "⌥Space". Empty for a key a spec cannot name.
function chordOf(keystroke) {
    const name = nameOf(keystroke.code);
    if (!name) return '';
    const key = SYMBOLS[name] ?? (name.length === 1 ? name.toUpperCase() : name[0].toUpperCase() + name.slice(1));
    return (
        MODIFIERS.filter(([member]) => keystroke[member])
            .map(([, , symbol]) => symbol)
            .join('') + key
    );
}

// Whether two keystrokes are one chord.
function same(one, other) {
    return !!one && !!other && one.code === other.code && MODIFIERS.every(([member]) => one[member] === other[member]);
}

// Whether it may work past its page, taken from every page, by WIDE_RULE.
function fitsWide(keystroke) {
    return (keystroke.meta || keystroke.control || keystroke.alt) && !takenByFields(keystroke);
}

// MARK: - Private
// The code of a key's name in a spec, or null.
function codeOf(name) {
    if (/^[a-z]$/.test(name)) return `Key${name.toUpperCase()}`;
    if (/^[0-9]$/.test(name)) return `Digit${name}`;
    if (/^f([1-9]|1[0-9])$/.test(name)) return name.toUpperCase();
    return CODES[name] ?? null;
}

// The name a spec gives a key by its code, or null.
function nameOf(code) {
    if (/^Key[A-Z]$/.test(code)) return code.slice(3).toLowerCase();
    if (/^Digit[0-9]$/.test(code)) return code.slice(5);
    if (/^F([1-9]|1[0-9])$/.test(code)) return code.toLowerCase();
    return Object.hasOwn(NAMES, code) ? NAMES[code] : null;
}

// Whether a field with focus may take it: one that edits text, and Return with ⌘, ⌃ or ⌥, which a code editor or a
// text area acts on.
function takenByFields({ code, meta, control, alt }) {
    return (
        EDITING.has(code) ||
        (meta && !control && !alt && EDIT_COMMANDS.has(code)) ||
        (code === 'Enter' && (meta || control || alt))
    );
}

module.exports = { WIDE_RULE, parse, keystrokeOf, specOf, chordOf, same, fitsWide };
