import * as CHANNEL from '../../../deckit/channel/index.js';

// MARK: - Property
// What a mod holds for a window over every app's, as a person reads it before installing.
const OVERLAY_WINDOWS = 'system.overlay-windows';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: OVERLAY_WINDOWS,
        name: 'Overlay Windows',
        description: "It can show a window of its own over every app's, on every desktop, whichever app is in front.",
    }),
]);

// MARK: - Initializer
// MARK: - Public
// The permission a window opened with `payload` (window/protocol.js: open) is guarded by: system.overlay-windows for
// the level `overlay`, and none for any other.
function permissionOf(payload) {
    return CHANNEL.fieldOf(payload, 'level') === 'overlay' ? OVERLAY_WINDOWS : null;
}

// MARK: - Private

export { OVERLAY_WINDOWS, PERMISSIONS, permissionOf };
