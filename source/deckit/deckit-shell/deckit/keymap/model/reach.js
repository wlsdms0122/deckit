// MARK: - Property
// How far a key works: in the page in front, anywhere in the app, or in any app too.
const REACHES = Object.freeze(['front', 'app', 'system']);

// MARK: - Initializer
// MARK: - Public
// Whether a key of this reach works past its page, taken from every page.
function isWide(reach) {
    return reach !== 'front';
}

// MARK: - Private

export { REACHES, isWide };
