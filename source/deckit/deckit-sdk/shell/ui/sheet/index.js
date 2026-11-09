// MARK: - Property
// A sheet made here -> the text it holds. A rule as the browser writes it back loses a shorthand holding a `var()` once
// a longhand of it follows (`font: var(--deckit-type-small); font-variant-numeric: tabular-nums`), so a copy is made
// from the text. Held until dropped: the document answers a sheet nothing holds as a new object.
const texts = new Map();
// A sheet made elsewhere -> { count, text }, its rules as last read.
const read = new WeakMap();

// MARK: - Initializer
// MARK: - Public
// A style sheet holding `text`, which a page adopts and another document can wear a copy of.
function make(text) {
    const sheet = new CSSStyleSheet();
    replace(sheet, text);
    return sheet;
}

// `sheet`, made here, holding `text` in place of what it held.
function replace(sheet, text) {
    sheet.replaceSync(text);
    texts.set(sheet, text);
}

// The rules of `sheet` as text, for another document to wear: as written for one made here, and for one made elsewhere
// as the browser writes them back, read again once their count changed.
function textOf(sheet) {
    if (texts.has(sheet)) return texts.get(sheet);
    const count = sheet.cssRules.length;
    const last = read.get(sheet);
    if (last?.count === count) return last.text;
    const text = [...sheet.cssRules].map((rule) => rule.cssText).join('\n');
    read.set(sheet, { count, text });
    return text;
}

// `sheet`, made here, no longer worn.
function drop(sheet) {
    texts.delete(sheet);
}

// MARK: - Private

export { make, replace, drop, textOf };
