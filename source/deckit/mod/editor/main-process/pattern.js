// What a workspace search's query means as a pattern: the one reading the search and Replace all share. Unicode, as
// the editor's find in a file reads one, so a whole word is bounded by the letters, marks, digits and `_` of any script.
const WORD = '[\\p{L}\\p{M}\\p{N}_]';

function patternOf(text, { regex = false, caseSensitive = false, word = false } = {}) {
    let source = regex ? String(text) : String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (word) source = `(?<!${WORD})(?:${source})(?!${WORD})`;
    return { source, flags: caseSensitive ? 'u' : 'iu' };
}

module.exports = { patternOf };
