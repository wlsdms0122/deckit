// MARK: - Property
// The permissions this concept checks, as a person reads them before installing. `reach`: `system`, past the
// app, or `app`, inside it.
const KEY_MAP = 'deckit.key-map';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: KEY_MAP,
        name: 'Key Map',
        means: 'It can bind, change and switch off the keys of every mod.',
        reach: 'app',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { KEY_MAP, PERMISSIONS };
