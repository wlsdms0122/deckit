// What a step answers held to what it expects, as the case format fixes matching (spec/DECKIT-1): strictly, a key
// answered with null a key not answered, and, format 29, the stand-in in an expected string matching any run of
// code points within one line.
const TOML = require('./toml.js');

// The stand-in: a code point no reading prints, as a quoted string writes it as an escape.
const STAND_IN = '\u001A';

function same(expected, actual) {
    if (Array.isArray(expected))
        return (
            Array.isArray(actual) &&
            actual.length === expected.length &&
            expected.every((one, at) => same(one, actual[at]))
        );
    if (TOML.isTable(expected)) {
        if (!TOML.isTable(actual)) return false;
        const answered = Object.keys(actual).filter((key) => actual[key] !== null);
        const keys = Object.keys(expected);
        return (
            answered.length === keys.length &&
            keys.every((key) => answered.includes(key) && same(expected[key], actual[key]))
        );
    }
    if (typeof expected === 'string' && expected.includes(STAND_IN))
        return typeof actual === 'string' && fits(expected.split(STAND_IN), actual);
    return expected === actual;
}

// Whether a text is the pieces in order, each two apart by a run that holds no LF.
function fits(pieces, text) {
    const literal = pieces.map((piece) => piece.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&'));
    return new RegExp(`^${literal.join('[^\\n]*')}$`).test(text);
}

// Whether a value holds the stand-in in a string anywhere.
function holdsStandIn(value) {
    if (typeof value === 'string') return value.includes(STAND_IN);
    if (Array.isArray(value)) return value.some(holdsStandIn);
    if (TOML.isTable(value)) return Object.values(value).some(holdsStandIn);
    return false;
}

module.exports = { same, holdsStandIn, STAND_IN };
