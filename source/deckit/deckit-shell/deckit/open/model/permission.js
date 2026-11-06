// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const FILE_HANDLERS = 'system.file-handlers';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: FILE_HANDLERS,
        name: 'File Handlers',
        means: 'It can hand files on this Mac to whatever opens them, a mod or the app for them, which can start programs, and show them in Finder.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { FILE_HANDLERS, PERMISSIONS };
