// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const KEYMAP = 'deckit.keymap';
const APP_KEYS = 'deckit.app-keys';
const GLOBAL_KEYS = 'system.global-keys';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: KEYMAP,
        name: 'Keymap',
        means: 'It can bind, change and switch off the keys of every mod.',
    }),
    Object.freeze({
        id: APP_KEYS,
        name: 'App Keys',
        means: 'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
    }),
    Object.freeze({
        id: GLOBAL_KEYS,
        name: 'Global Keys',
        means: 'Its keys work in every app, this one in front or not, and are taken from all of them.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { KEYMAP, APP_KEYS, GLOBAL_KEYS, PERMISSIONS };
