// MARK: - Property
// What a site may have, by the names the web platform gives each: asked of the mod showing it, as a browser asks the
// person, or let through without asking, as a browser lets a site have it. Anything else is refused.
const ASKED = Object.freeze(['notifications', 'clipboard-read', 'geolocation', 'microphone', 'camera']);
const UNASKED = Object.freeze([
    'fullscreen',
    'clipboard-write',
    'pointer-lock',
    'keyboard-lock',
    'encrypted-media',
    'local-network-access',
]);

// MARK: - Initializer
// MARK: - Public
// `ask`, `allow` or `refuse`: what becomes of a site asking for `name`.
function ruleOf(name) {
    if (ASKED.includes(name)) return 'ask';
    return UNASKED.includes(name) ? 'allow' : 'refuse';
}

// MARK: - Private

export { ASKED, UNASKED, ruleOf };
