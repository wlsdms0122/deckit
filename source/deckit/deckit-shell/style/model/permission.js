// MARK: - Property
// What a mod holds to style other pages, as a person reads it before installing.
const STYLES = 'deckit.styles';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: STYLES,
        name: 'Styles',
        icon: 'eye',
        means: "It can change how every page in the app looks, other mods' among them, and so read what they show.",
        reach: 'app',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { STYLES, PERMISSIONS };
