// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const COMMAND_REGISTRY = 'deckit.command-registry';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: COMMAND_REGISTRY,
        name: 'Command Registry',
        means: 'It can list the commands of every mod and of the app, and run them, doing whatever they do.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { COMMAND_REGISTRY, PERMISSIONS };
