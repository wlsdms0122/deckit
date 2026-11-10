// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The site of a web address, as a permission is held for it: its origin, or '' for an address that is no web site's.
function originOf(url) {
    try {
        const parsed = new URL(url);
        return /^https?:$/.test(parsed.protocol) ? parsed.origin : '';
    } catch {
        return '';
    }
}

// Whether `url` is a web address, an address of the http or https scheme.
function isWebAddress(url) {
    return originOf(url) !== '';
}

// Whether `url` names a blank page: no address, or `about:blank`.
function isBlank(url) {
    return url === '' || /^about:blank(?:[?#]|$)/i.test(String(url));
}

// The scheme of an address, in lower case without its colon, or ''.
function schemeOf(url) {
    try {
        return new URL(String(url)).protocol.replace(/:$/, '').toLowerCase();
    } catch {
        return '';
    }
}

// MARK: - Private

export { originOf, isWebAddress, isBlank, schemeOf };
