// The keys a spec names that are not a letter or a digit: the physical key's code, and how a chord writes it.
const NAMED = {
    '[': ['BracketLeft', '['],
    ']': ['BracketRight', ']'],
    '.': ['Period', '.'],
    "'": ['Quote', "'"],
    up: ['ArrowUp', '↑'],
    down: ['ArrowDown', '↓'],
    left: ['ArrowLeft', '←'],
    right: ['ArrowRight', '→'],
    enter: ['Enter', '↩'],
    backspace: ['Backspace', '⌫'],
};

// The window's own keys, while it is key: `keys` is `{ name: { key, run, fieldsKeep } }`, `key` a spec of modifiers
// (`mod` for ⌘, `ctrl`, `alt`, `shift`) and a key joined by `+`, matched on the physical key, and `run()` what it does.
// `listen(on)` takes them from the document `within` is in while on, before anything in it hears them, but for one
// that is `fieldsKeep`, left to a field that has the keyboard; a key a web page shown in it did not handle comes to
// that document next, so they work there too. What a key throws is logged. `chordOf(name)` is a key's chord as a
// person reads it, or '' for none.
function viewKeys(keys, { log, within }) {
    const read = Object.entries(keys).map(([name, { key, run, fieldsKeep = false }]) => ({
        name,
        keystroke: keystrokeOf(key),
        run,
        fieldsKeep,
    }));
    const onKey = (event) => {
        if (event.defaultPrevented) return;
        const found = read.find(({ keystroke }) => matches(keystroke, event));
        if (!found || (found.fieldsKeep && typing(event.currentTarget.document))) return;
        event.preventDefault();
        event.stopPropagation();
        Promise.resolve()
            .then(found.run)
            .catch((error) => console.warn(`[${log}] the key ${found.name} did not run: ${error.message || error}`));
    };
    let listening = null; // the window of the document it takes them from
    return {
        chordOf: (name) => {
            const found = read.find((key) => key.name === name);
            return found ? written(found.keystroke) : '';
        },
        listen(on) {
            const view = on ? within.ownerDocument.defaultView : null;
            if (view === listening) return;
            listening?.removeEventListener('keydown', onKey, true);
            listening = view;
            view?.addEventListener('keydown', onKey, true);
        },
    };
}

function keystrokeOf(spec) {
    const words = spec.toLowerCase().split('+');
    const key = words.pop();
    const [code] = /^[a-z]$/.test(key) ? ['Key' + key.toUpperCase()] : /^\d$/.test(key) ? ['Digit' + key] : NAMED[key];
    const has = (word) => words.includes(word);
    return { code, meta: has('mod'), control: has('ctrl'), alt: has('alt'), shift: has('shift') };
}

function matches(keystroke, event) {
    return (
        event.code === keystroke.code &&
        event.metaKey === keystroke.meta &&
        event.ctrlKey === keystroke.control &&
        event.altKey === keystroke.alt &&
        event.shiftKey === keystroke.shift
    );
}

// ⌃⌥⇧⌘ and then the key.
function written({ code, meta, control, alt, shift }) {
    const sign = Object.values(NAMED).find(([named]) => named === code)?.[1] ?? code.replace(/^(Key|Digit)/, '');
    return (control ? '⌃' : '') + (alt ? '⌥' : '') + (shift ? '⇧' : '') + (meta ? '⌘' : '') + sign;
}

// A field of `document` has the keyboard: anything typed in.
function typing(document) {
    return !!document.activeElement?.closest('input, textarea, [contenteditable]');
}

module.exports = { viewKeys };
