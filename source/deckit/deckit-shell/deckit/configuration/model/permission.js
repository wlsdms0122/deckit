// MARK: - Property
// What a mod holds to read and change every mod's configuration, as a person reads it before installing.
const MOD_CONFIGURATION = 'deckit.mod-configuration';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: MOD_CONFIGURATION,
        name: 'Mod Configuration',
        means: 'It can read and change the configuration of every mod, not only its own.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { MOD_CONFIGURATION, PERMISSIONS };
