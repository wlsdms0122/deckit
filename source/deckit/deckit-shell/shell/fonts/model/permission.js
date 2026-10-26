// MARK: - Property
// What a mod holds to change the person's fonts, as a person reads it before installing.
const FONTS = 'deckit.fonts';
const PERMISSIONS = Object.freeze([
    Object.freeze({
        id: FONTS,
        name: 'Fonts',
        means: 'It can change the fonts and the text size every mod writes text in.',
    }),
]);

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { FONTS, PERMISSIONS };
