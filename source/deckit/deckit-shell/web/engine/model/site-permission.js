import * as CLIPBOARD_PERMISSION from '../../../../deckit-sdk/deckit/clipboard/model/permission.js';

// MARK: - Property
// What a site may have, by the names the web platform gives each: asked of the mod showing it, as a browser asks the
// person, let through without asking, as a browser lets a site have it, or, for what a browser only checks, said yes to
// when checked and refused when asked for. Anything else is refused.
const ASKED = Object.freeze(['notifications', 'clipboard-read', 'geolocation', 'microphone', 'camera']);
const UNASKED = Object.freeze(['fullscreen', 'clipboard-write', 'pointer-lock', 'keyboard-lock', 'encrypted-media']);
const CHECKED = Object.freeze(['local-network-access']);
// What a site reaches that the system guards with a permission of its own, by the name the web platform gives it, and
// that permission: a mod's site has it only while the mod is granted that permission.
const GUARDED = new Map([
    ['clipboard-read', CLIPBOARD_PERMISSION.CLIPBOARD_READ],
    ['clipboard-write', CLIPBOARD_PERMISSION.CLIPBOARD_WRITE],
]);
// The schemes the web uses itself, whose addresses no site opens in an app. The app for any other scheme is asked per
// scheme, as `open:<scheme>`, so a site allowed one app is not allowed every app.
const NEVER_OUT = Object.freeze(
    new Set(['javascript', 'data', 'blob', 'file', 'filesystem', 'about', 'http', 'https', 'ws', 'wss'])
);
// A scheme as an address writes it, in lower case.
const SCHEME = /^[a-z][a-z0-9+.-]*$/;

// MARK: - Initializer
// MARK: - Public
// `ask`, `allow`, `checked` or `refuse`: what becomes of a site asking for `name`.
function ruleOf(name) {
    if (ASKED.includes(name)) return 'ask';
    if (CHECKED.includes(name)) return 'checked';
    return UNASKED.includes(name) ? 'allow' : 'refuse';
}

// The permission of the system's a mod is granted for its sites to have `name`, or '' where the system guards none.
function guardOf(name) {
    return GUARDED.get(name) ?? '';
}

// Whether a site may be asked for the app that opens addresses of `scheme`, in lower case.
function opensOut(scheme) {
    return SCHEME.test(scheme) && !NEVER_OUT.has(scheme);
}

// Whether `permission` is one a mod lets a site have, or takes back: one the site is asked for, or `open:<scheme>`, the
// app for addresses of a scheme a site may be asked for.
function isAsked(permission) {
    if (ruleOf(permission) === 'ask') return true;
    return permission.startsWith('open:') && opensOut(permission.slice('open:'.length));
}

// MARK: - Private

export { ASKED, UNASKED, CHECKED, NEVER_OUT, ruleOf, guardOf, opensOut, isAsked };
