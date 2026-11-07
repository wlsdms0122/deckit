// MARK: - Property
// What a mod holds to change the shell's own keys, as a person reads it before installing: only a system mod is
// granted it.
const SHELL_KEYS = 'deckit.shell-keys';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: SHELL_KEYS,
        name: 'Shell Keys',
        description: "It can change the keys of the app's panel and Dock.",
        privileged: true,
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { SHELL_KEYS, PERMISSIONS };
