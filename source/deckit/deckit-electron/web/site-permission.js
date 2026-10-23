import * as SITE from '../../deckit-shell/deckit/web/model/site.js';

// Chromium's questions about a web page's permissions, put in the names deck rules on (deckit-shell/deckit/web/model/
// site-permission.js), and what deck answers, done. `permits(session, origin, name)` answers at once whether a site may
// have `name` in a mod's session, `{ mod, name }` or null; `request(embedder, id, { origin, permissions })` and
// `requestApp(embedder, id, { url, origin })` answer, each a promise, whether the web page of that id, or the tab it
// answers to, may have it.
export function createSitePermission({ SESSION, REGISTRY, hold, sessionOf, permits, request, requestApp }) {
    // MARK: - Property
    // Chromium's names for what a site asks, by the web platform's.
    const NAMES = {
        notifications: 'notifications',
        'clipboard-read': 'clipboard-read',
        geolocation: 'geolocation',
        fullscreen: 'fullscreen',
        'clipboard-sanitized-write': 'clipboard-write',
        pointerLock: 'pointer-lock',
        keyboardLock: 'keyboard-lock',
        mediaKeySystem: 'encrypted-media',
        'local-network-access': 'local-network-access',
        'local-network': 'local-network-access',
        'loopback-network': 'local-network-access',
    };
    const MEDIA = { audio: 'microphone', video: 'camera' };

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        SESSION.onCreate((session) => {
            hold(session, 'setPermissionRequestHandler', onRequest);
            hold(session, 'setPermissionCheckHandler', onCheck);
        });
    }

    // MARK: - Private
    // What a page asks is put to deck, by the web platform's names; a name Chromium has and the web platform does not
    // goes as none, which deck refuses.
    function onRequest(page, permission, callback, details) {
        const at = REGISTRY.tabOf(page);
        if (!at) return callback(false);
        if (permission === 'openExternal') {
            requestApp(at.embedder, at.tab.id, {
                url: details?.externalURL,
                origin: SITE.originOf(page.getURL()),
            }).then(callback);
            return;
        }
        const origin = SITE.originOf(details?.securityOrigin || details?.requestingUrl || page.getURL());
        request(at.embedder, at.tab.id, { origin, permissions: namesOf(permission, details) }).then(callback);
    }

    // Chromium checks media without saying which: a check has no way to ask, and a page told no stops before it ever
    // asks, so it says yes and the request that follows, naming the camera or the microphone, is put to deck.
    function onCheck(page, permission, requestingOrigin, details) {
        if (permission === 'media') return true;
        const name = NAMES[permission];
        if (!name) return false;
        const origin = SITE.originOf(details?.securityOrigin || requestingOrigin);
        return !!permits(page ? sessionOf(page) : null, origin, name);
    }

    // What a site asks, by the web platform's names: a camera or a microphone for media.
    function namesOf(permission, details) {
        if (permission === 'media')
            return [...new Set((details?.mediaTypes || []).map((type) => MEDIA[type]).filter(Boolean))];
        return Object.hasOwn(NAMES, permission) ? [NAMES[permission]] : [];
    }

    return { start };
}
