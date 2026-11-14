// MARK: - Property
// What a declaration names for every scheme, and the pattern of every address.
const EVERY = '*';
// A scheme's name, lower case as compared (RFC 3986).
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
// What a page runs or holds itself: nothing opens these.
const NOT_PLACES = new Set(['javascript', 'data', 'blob', 'about']);

// MARK: - Initializer
// MARK: - Public
// The scheme `address` is written with, lower case, or '' for none.
function schemeOf(address) {
    const colon = address.indexOf(':');
    if (colon <= 0) return '';
    const scheme = address.slice(0, colon).toLowerCase();
    return SCHEME.test(scheme) ? scheme : '';
}

// Whether `name` is a scheme's name, lower case.
function isScheme(name) {
    return SCHEME.test(name);
}

// Whether an address of `scheme` is a place something opens.
function isPlace(scheme) {
    return !NOT_PLACES.has(scheme);
}

// Which addresses a pattern takes, as written: `*` every address, `<scheme>:*` every one of a scheme, and
// `<scheme>://<host>/<path>*` those of a host whose path starts so. `{ written, scheme, host, path, specificity }`,
// host and path null for the first two, scheme `*` for the first, or null for what is no pattern. Scheme and host are
// lower case as compared; a `*` stands only at the end, after the scheme's `:` or a `/` of the path. `specificity` is
// how narrow it is: a pattern that takes less comes first.
function patternOf(written) {
    if (typeof written !== 'string') return null;
    if (written === EVERY) return pattern(written, EVERY, null, null);
    const colon = written.indexOf(':');
    if (!written.endsWith('*') || colon < 0) return null;
    const scheme = written.slice(0, colon).toLowerCase();
    if (!SCHEME.test(scheme)) return null;
    const rest = written.slice(colon + 1, -1);
    if (!rest) return pattern(written, scheme, null, null);
    if (!rest.startsWith('//') || rest.includes('*')) return null;
    const place = rest.slice(2);
    const slash = place.indexOf('/');
    if (slash <= 0) return null;
    return pattern(written, scheme, place.slice(0, slash).toLowerCase(), place.slice(slash));
}

// Whether `address` is one `pattern` takes: its scheme, and its host and the start of its path where it names them.
function matches(pattern, address) {
    const scheme = schemeOf(address);
    if (!scheme) return false;
    if (pattern.scheme === EVERY) return true;
    if (scheme !== pattern.scheme) return false;
    if (pattern.host === null) return true;
    const after = address.slice(scheme.length + 1);
    if (!after.startsWith('//')) return false;
    const place = after.slice(2);
    const end = place.search(/[/?#]/);
    const at = end < 0 ? place.length : end;
    if (place.slice(0, at).toLowerCase() !== pattern.host) return false;
    const located = place.slice(at).match(/^[^?#]*/)[0];
    return located.startsWith(pattern.path) || (pattern.path === '/' && located === '');
}

// MARK: - Private
function pattern(written, scheme, host, path) {
    const specificity = scheme === EVERY ? 0 : host === null ? 1 : 2 + [...path].length;
    return Object.freeze({ written, scheme, host, path, specificity });
}

module.exports = { EVERY, schemeOf, isScheme, isPlace, patternOf, matches };
