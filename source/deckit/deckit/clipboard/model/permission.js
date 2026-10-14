// MARK: - Property
// The permissions this service checks, as a person reads them before installing. `reach`: `system`, past the
// app, or `app`, inside it.
// What a mod holds to read what was copied.
const CLIPBOARD = 'system.clipboard';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: CLIPBOARD,
        name: 'Clipboard',
        icon: 'copy',
        means: 'It can read what you copied, from any app. Copying text needs no permission.',
        reach: 'system',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { CLIPBOARD, PERMISSIONS };
