// MARK: - Property
// What a mod holds for a window over every app's, as a person reads it before installing.
const OVERLAY_WINDOWS = 'system.overlay-windows';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: OVERLAY_WINDOWS,
        name: 'Overlay Windows',
        means: "It can show a window of its own over every app's, on every desktop, whichever app is in front.",
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { OVERLAY_WINDOWS, PERMISSIONS };
