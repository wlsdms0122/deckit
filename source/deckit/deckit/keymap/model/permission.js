// MARK: - Property
// The permissions this service checks, as a person reads them before installing. `reach`: `system`, past the
// app, or `app`, inside it.
const GLOBAL_KEYS = 'system.global-keys';
const KEY_MAP = 'deckit.key-map';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: GLOBAL_KEYS,
        name: 'Keys Everywhere',
        icon: 'monitor',
        means: 'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
        reach: 'system',
    }),
    Object.freeze({
        id: KEY_MAP,
        name: 'Key Map',
        icon: 'keyboard',
        means: 'It can bind, change and switch off the keys of every mod.',
        reach: 'app',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { GLOBAL_KEYS, KEY_MAP, PERMISSIONS };
