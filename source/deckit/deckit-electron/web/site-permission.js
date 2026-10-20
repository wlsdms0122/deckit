import * as CHANNEL from '../../deckit-driver/channel/index.js';
import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';
import * as WEB_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC, DECLARED);

export function createSitePermission({ IDENTITY, SESSION, REGISTRY }) {
    // MARK: - Property
    // partition|origin|permission. Allowances live until exit: the mod hands them back through allow(). A
    // refusal is not kept, so a page refused by mistake can ask again once reloaded.
    const GRANTED = new Set();
    const MEDIA = { audio: 'microphone', video: 'camera' };
    // What a site may have only once it is asked, as a browser asks the person: put to the mod showing it.
    const ASKED = {
        notifications: 'notifications',
        'clipboard-read': 'clipboard-read',
        geolocation: 'geolocation',
    };
    // What a browser lets a site have without asking. Anything neither here nor asked is refused.
    const UNASKED = new Set([
        'fullscreen',
        'clipboard-sanitized-write',
        'pointerLock',
        'keyboardLock',
        'mediaKeySystem',
    ]);
    // Asked per scheme, so a site allowed one app is not allowed every app.
    const NEVER_OUT = new Set([
        'javascript',
        'data',
        'blob',
        'file',
        'filesystem',
        'about',
        'chrome',
        'chrome-extension',
        'devtools',
        'view-source',
        'http',
        'https',
        'ws',
        'wss',
    ]);
    // Nothing follows a local network check to ask, and Electron does not block the connection either.
    const LOCAL_NETWORK = new Set(['local-network-access', 'local-network', 'loopback-network']);
    const questions = new Map(); // ask id -> { embedder, key, tab, gone, waiting: [resolve] }
    const questionFor = new Map(); // tab|origin|permissions -> ask id
    const listeners = new Set();
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        SESSION.onCreate((session) => {
            session.setPermissionRequestHandler(onRequest);
            session.setPermissionCheckHandler(onCheck);
        });
        PROTOCOL.permit.on(({ ask: id, allow }, sender) => {
            if (questions.get(id)?.embedder === sender) settle(id, allow);
        });
    }

    function granted(partition, origin, permission) {
        return !!partition && !!origin && GRANTED.has(keyOf(partition, origin, permission));
    }

    // One question per page, site and set of permissions: a page asking again before it is answered joins the
    // question already up. Only a mod holding system.site-permissions is asked; for any other the site is refused.
    function ask(embedder, tab, origin, permissions, about = {}) {
        return new Promise((resolve) => {
            if (!origin || !permissions.length || !decides(embedder)) return resolve(false);
            const partition = SESSION.partitionOf(tab);
            if (permissions.every((permission) => granted(partition, origin, permission))) return resolve(true);
            const key = [tab.id, origin, ...[...permissions].sort()].join('|');
            const up = questions.get(questionFor.get(key));
            if (up) {
                up.waiting.push(resolve);
                return;
            }
            const id = ++sequence;
            const gone = () => settle(id, false);
            questions.set(id, { embedder, key, tab, gone, waiting: [resolve] });
            questionFor.set(key, id);
            tab.once('destroyed', gone);
            PROTOCOL.asking.send(embedder, { id: tab.id, ask: id, origin, permissions, ...about });
        });
    }

    // Asked of the top document's site whichever frame wants the app: that is the site the person sees.
    function mayOpenApp(embedder, tab, url, asking = tab) {
        const { app } = require('electron');
        const scheme = schemeOf(url);
        if (!scheme || NEVER_OUT.has(scheme)) return Promise.resolve(false);
        const name = app.getApplicationNameForProtocol(String(url));
        if (!name) return Promise.resolve(false);
        return ask(embedder, tab, originOf(asking.getURL()), ['open:' + scheme], {
            app: name.replace(/\.app$/i, ''),
            url: String(url),
        });
    }

    function originOf(url) {
        try {
            const parsed = new URL(url);
            return /^https?:$/.test(parsed.protocol) ? parsed.origin : '';
        } catch {
            return '';
        }
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
    function decides(embedder) {
        const mod = IDENTITY.modOf(embedder);
        return !!mod && mod.permissions.some(({ id }) => id === WEB_PERMISSION.SITE_PERMISSIONS);
    }

    function keyOf(partition, origin, permission) {
        return `${partition}|${origin}|${permission}`;
    }

    function schemeOf(url) {
        try {
            return new URL(String(url)).protocol.replace(/:$/, '').toLowerCase();
        } catch {
            return '';
        }
    }

    function settle(id, allowed) {
        const question = questions.get(id);
        if (!question) return;
        questions.delete(id);
        questionFor.delete(question.key);
        question.tab.removeListener('destroyed', question.gone);
        for (const resolve of question.waiting) resolve(!!allowed);
    }

    function change(partition, entries, apply) {
        for (const entry of entries) {
            const origin = originOf(entry?.origin);
            if (origin && entry.permission) apply(keyOf(partition, origin, String(entry.permission)));
        }
        for (const listener of listeners) listener();
        return GRANTED.size;
    }

    // What a page asks that a browser would ask the person is put to the mod showing it.
    function onRequest(page, permission, callback, details) {
        const at = REGISTRY.tabOf(page);
        if (!at) return callback(false);
        if (UNASKED.has(permission)) return callback(true);
        const origin = originOf(details?.securityOrigin || details?.requestingUrl || page.getURL());
        if (permission === 'openExternal') {
            mayOpenApp(at.embedder, at.tab, details?.externalURL, page).then(callback);
            return;
        }
        const permissions =
            permission === 'media'
                ? [...new Set((details?.mediaTypes || []).map((type) => MEDIA[type]).filter(Boolean))]
                : Object.hasOwn(ASKED, permission)
                  ? [ASKED[permission]]
                  : [];
        if (!permissions.length) return callback(false);
        ask(at.embedder, at.tab, origin, permissions).then(callback);
    }

    // A check has no way to ask, and a page told no stops before it ever asks, so media says yes and the
    // request that follows asks. What is asked answers whether it was allowed.
    function onCheck(page, permission, requestingOrigin, details) {
        if (LOCAL_NETWORK.has(permission) || UNASKED.has(permission) || permission === 'media') return true;
        if (!Object.hasOwn(ASKED, permission) || !page) return false;
        return granted(
            SESSION.partitionOf(page),
            originOf(details?.securityOrigin || requestingOrigin),
            ASKED[permission]
        );
    }

    return { start, granted, ask, mayOpenApp, originOf, onChange, notifications, allow, revoke };
}
