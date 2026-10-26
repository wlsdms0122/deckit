// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const KEYMAP = 'deckit.keymap';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: KEYMAP,
        name: 'Keymap',
        means: 'It can bind, change and switch off the keys of every mod.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { KEYMAP, PERMISSIONS };
