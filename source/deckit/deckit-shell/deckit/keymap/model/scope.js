// MARK: - Property
// Where a key works: in the page in front, anywhere in the app, or in every app too.
const SCOPES = Object.freeze(['local', 'app', 'global']);

// MARK: - Initializer
// MARK: - Public
// Whether a key of this scope works past its page, taken from every page.
function isWide(scope) {
    return scope !== 'local';
}

// MARK: - Private

export { SCOPES, isWide };
