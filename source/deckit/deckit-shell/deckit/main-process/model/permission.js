// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
// What a mod holds to run its own code in the app's main process.
const MAIN_PROCESS = 'system.main-process';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MAIN_PROCESS,
        name: 'Main Process',
        means: "It starts code in the app's main process, outside its own pages, where code can read and write your files, reach the network and start programs.",
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { MAIN_PROCESS, PERMISSIONS };
