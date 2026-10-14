// MARK: - Property
// The permissions this service checks, as a person reads them before installing. `reach`: `system`, past the
// app, or `app`, inside it.
// What a mod holds to show notifications.
const NOTIFICATIONS = 'system.notifications';

const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: NOTIFICATIONS,
        name: 'Notifications',
        icon: 'bell',
        means: 'It can show notifications in the corner of the screen, while you are looking at something else.',
        reach: 'system',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { NOTIFICATIONS, PERMISSIONS };
