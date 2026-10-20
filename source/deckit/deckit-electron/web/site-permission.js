import * as SITE from '../../deckit-shell/web/model/site.js';
import * as SITE_PERMISSION from '../../deckit-shell/web/model/site-permission.js';

// What a site was allowed in a mod's session, and Chromium's questions about a web page's permissions put in the names
// deck rules on (deckit-shell/web/model/site-permission.js). Deck decides what is asked: `request(embedder, id,
// { origin, permissions })` and `requestApp(embedder, id, { url, origin })` answer, each a promise, whether the web page
// of that id, or the tab it answers to, may have it.
export function createSitePermission({ SESSION, REGISTRY, request, requestApp }) {
    // MARK: - Property
    // partition|origin|permission. Allowances live until exit: the mod hands them back through allow(). A
    // refusal is not kept, so a page refused by mistake can ask again once reloaded.
    const GRANTED = new Set();
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
    const listeners = new Set();

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        SESSION.onCreate((session) => {
            session.setPermissionRequestHandler(onRequest);
            session.setPermissionCheckHandler(onCheck);
        });
    }

    function granted(partition, origin, permission) {
        return !!partition && !!origin && GRANTED.has(keyOf(partition, origin, permission));
    }

    function onChange(listener) {
        listeners.add(listener);
    }

    // The origins a session allows notifications, as the page script reads them.
    function notifications(partition) {
        const table = {};
        for (const key of GRANTED) {
            const [keyPartition, origin, permission] = key.split('|');
            if (keyPartition === partition && permission === 'notifications') table[origin] = 'granted';
        }
        return table;
    }

    function allow(partition, entries) {
        return change(partition, entries, (key) => GRANTED.add(key));
    }

    // A page already holding a stream keeps it, and one told "granted" keeps believing it: the mod reloads
    // its pages of that origin.
    function revoke(partition, entries) {
        return change(partition, entries, (key) => GRANTED.delete(key));
    }

    // MARK: - Private
    function keyOf(partition, origin, permission) {
        return `${partition}|${origin}|${permission}`;
    }

    function change(partition, entries, apply) {
        for (const entry of entries) {
            const origin = SITE.originOf(entry?.origin);
            if (origin && entry.permission) apply(keyOf(partition, origin, String(entry.permission)));
        }
        for (const listener of listeners) listener();
        return GRANTED.size;
    }

    // What a page asks that a browser would ask the person is put to the mod showing it.
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
        const permissions = namesOf(permission, details);
        const rules = permissions.map(SITE_PERMISSION.ruleOf);
        if (permissions.length && rules.every((rule) => rule === 'allow')) return callback(true);
        if (!permissions.length || rules.some((rule) => rule === 'refuse')) return callback(false);
        const origin = SITE.originOf(details?.securityOrigin || details?.requestingUrl || page.getURL());
        request(at.embedder, at.tab.id, { origin, permissions }).then(callback);
    }

    // A check has no way to ask, and a page told no stops before it ever asks, so media says yes and the
    // request that follows asks. What is asked answers whether it was allowed.
    function onCheck(page, permission, requestingOrigin, details) {
        if (permission === 'media') return true;
        const name = NAMES[permission];
        const rule = name ? SITE_PERMISSION.ruleOf(name) : 'refuse';
        if (rule === 'allow') return true;
        if (rule !== 'ask' || !page) return false;
        return granted(SESSION.partitionOf(page), SITE.originOf(details?.securityOrigin || requestingOrigin), name);
    }

    // What a site asks, by the web platform's names: a camera or a microphone for media.
    function namesOf(permission, details) {
        if (permission === 'media')
            return [...new Set((details?.mediaTypes || []).map((type) => MEDIA[type]).filter(Boolean))];
        return Object.hasOwn(NAMES, permission) ? [NAMES[permission]] : [];
    }

    return { start, granted, onChange, notifications, allow, revoke };
}
