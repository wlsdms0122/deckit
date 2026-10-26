// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const CLIPBOARD_READ = 'system.clipboard-read';
const CLIPBOARD_WRITE = 'system.clipboard-write';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: CLIPBOARD_READ,
        name: 'Clipboard Read',
        means: 'It can read what you copied, from any app.',
    }),
    Object.freeze({
        id: CLIPBOARD_WRITE,
        name: 'Clipboard Write',
        means: 'It can replace what you copied with text of its own, which you then paste in any app.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { CLIPBOARD_READ, CLIPBOARD_WRITE, PERMISSIONS };
