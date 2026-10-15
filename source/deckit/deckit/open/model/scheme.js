// MARK: - Property
// RFC 3986, lower case as compared.
const SCHEME = /^[a-z][a-z0-9+.-]*$/;
// What a page runs or holds itself: nothing opens these.
const NOT_PLACES = new Set(['javascript', 'data', 'blob', 'about']);
const EVERY = '*';
// The manifest field that names the schemes a mod opens, held under `urlSchemes`.
const FIELD = 'url-schemes';

// MARK: - Initializer
// MARK: - Public
// How the manifest reads the field (deck/mod/manifest).
function field() {
    return { key: 'urlSchemes', read, problemOf };
}

// MARK: - Private
function read(raw) {
    return Array.isArray(raw) ? [...new Set(raw)] : [];
}

function problemOf(list, schemes) {
    const example = 'url-schemes = ["https"], or ["*"] for every scheme';
    if (!Array.isArray(list) || !list.length) return `url-schemes must be a list of schemes, as ${example}`;
    const bad = list.filter((scheme) => typeof scheme !== 'string' || (scheme !== EVERY && !SCHEME.test(scheme)));
    if (bad.length) {
        return `url-schemes: ${bad.map((scheme) => JSON.stringify(scheme)).join(', ')} is not a scheme; a scheme is lower case, as "https" or "my-app", with no ":"`;
    }
    const unplaced = list.filter((scheme) => NOT_PLACES.has(scheme));
    if (unplaced.length)
        return `url-schemes: ${unplaced.map((scheme) => `"${scheme}"`).join(', ')} is not a place; nothing opens it`;
    if (schemes.includes(EVERY) && schemes.length > 1)
        return `url-schemes: "${EVERY}" already takes every scheme, so it stands alone`;
    return '';
}

export { SCHEME, NOT_PLACES, EVERY, FIELD, field };
