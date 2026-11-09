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

// The scheme of an address, in lower case without its colon, or ''.
function schemeOf(url) {
    try {
        return new URL(String(url)).protocol.replace(/:$/, '').toLowerCase();
    } catch {
        return '';
    }
}

// MARK: - Private

export { originOf, schemeOf };
