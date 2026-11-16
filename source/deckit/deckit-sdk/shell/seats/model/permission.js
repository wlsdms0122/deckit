// MARK: - Property
// What a mod holds to know who sits at the desktop and to act on it, as a person reads it before installing. Only a
// system mod is granted it.
const SEATS = 'deckit.seats';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: SEATS,
        name: 'Seats',
        description:
            'It can see who sits at the desktop and who asks to, answer one that asks, and show the view of one that sits.',
        privileged: true,
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { SEATS, PERMISSIONS };
