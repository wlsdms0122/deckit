// MARK: - Property
// The permissions this concept checks, as a person reads them before installing.
const APP_KEYS = 'deckit.app-keys';
const GLOBAL_KEYS = 'system.global-keys';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: APP_KEYS,
        name: 'App Keys',
        description: 'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
    }),
    Object.freeze({
        id: GLOBAL_KEYS,
        name: 'Global Keys',
        description: 'Its keys work in every app, this one in front or not, and are taken from all of them.',
    }),
]);

// Where a chord a mod takes works, by the permission it holds for it: in every page of the app, or in every app too.
const SCOPES = Object.freeze({ app: APP_KEYS, global: GLOBAL_KEYS });

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { APP_KEYS, GLOBAL_KEYS, PERMISSIONS, SCOPES };
