import * as CHANNEL from '../../../deckit/channel/index.js';

// MARK: - Property
// The permissions a chord a mod takes works by, as a person reads them before installing: in every page of the app, or
// in every app too. The shell's key checks them as a mod takes a chord.
const APP_KEYS = 'deckit.app-keys';
const GLOBAL_KEYS = 'system.global-keys';
// What a mod holds to change the shell's own keys, as a person reads it before installing: only a system mod is
// granted it.
const SHELL_KEYS = 'deckit.shell-keys';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: APP_KEYS,
        name: 'App Keys',
        description:
            'Its keys work wherever you are in the app, whatever is in front, and are taken from every page there.',
    }),
    Object.freeze({
        id: GLOBAL_KEYS,
        name: 'Global Keys',
        description: 'Its keys work in every app, this one in front or not, and are taken from all of them.',
    }),
    Object.freeze({
        id: SHELL_KEYS,
        name: 'Shell Keys',
        description: "It can change the keys of the app's desktop.",
        privileged: true,
    }),
]);

// Where a chord a mod takes works, by the permission it holds for it: in every page of the app, or in every app too.
const SCOPES = Object.freeze({ app: APP_KEYS, global: GLOBAL_KEYS });

// MARK: - Initializer
// MARK: - Public
// The permission a chord taken with `payload` (key/protocol.js: take) is guarded by: its scope's, and for a scope that
// names none the scope `app`'s.
function permissionOf(payload) {
    const scope = CHANNEL.fieldOf(payload, 'scope');
    return typeof scope === 'string' && Object.hasOwn(SCOPES, scope) ? SCOPES[scope] : APP_KEYS;
}

// MARK: - Private

export { APP_KEYS, GLOBAL_KEYS, SHELL_KEYS, PERMISSIONS, SCOPES, permissionOf };
