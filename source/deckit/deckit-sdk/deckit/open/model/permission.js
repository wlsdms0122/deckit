// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const FILE_HANDLERS = 'system.file-handlers';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: FILE_HANDLERS,
        name: 'File Handlers',
        description: 'It can open files in the app for them, which can start programs.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { FILE_HANDLERS, PERMISSIONS };
