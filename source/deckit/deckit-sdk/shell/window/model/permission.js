import * as CHANNEL from '../../../deckit/channel/index.js';

// MARK: - Property
// What a mod holds for a window over every app's, and for one in the bar across the top of the app's window or over
// the desktop as a view, as a person reads it before installing.
const OVERLAY_WINDOWS = 'system.overlay-windows';
const PANEL_WINDOWS = 'deckit.panel-windows';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: OVERLAY_WINDOWS,
        name: 'Overlay Windows',
        description: "It can show a window of its own over every app's, on every desktop, whichever app is in front.",
    }),
    Object.freeze({
        id: PANEL_WINDOWS,
        name: 'Panel Windows',
        description:
            "It can show a window of its own in the bar across the top of the app's window, and one over the desktop, under a spot a mod names for it or at a top corner.",
    }),
]);
// The permission each level is guarded by, where one is.
const GUARDS = Object.freeze({ overlay: OVERLAY_WINDOWS, panel: PANEL_WINDOWS });

// MARK: - Initializer
// MARK: - Public
// The permission a window opened with `payload` (window/protocol.js: open) is guarded by: system.overlay-windows for
// the level `overlay`, deckit.panel-windows for the level `panel`, and none for any other.
function permissionOf(payload) {
    const level = CHANNEL.fieldOf(payload, 'level');
    return (typeof level === 'string' && Object.hasOwn(GUARDS, level) && GUARDS[level]) || null;
}

// MARK: - Private

export { OVERLAY_WINDOWS, PANEL_WINDOWS, PERMISSIONS, permissionOf };
