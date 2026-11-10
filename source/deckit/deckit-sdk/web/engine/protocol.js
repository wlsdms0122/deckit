// Between a mod's view and main, about the web pages it shows. `name` is a session's name within the mod; `id` is a
// web page's, as the environment hands it out, which the mod's page keeps and hands back, never reads.
import * as CHANNEL from '../../deckit/channel/index.js';
import * as WEB_PERMISSION from './model/permission.js';
import * as OPEN_PERMISSION from '../../deckit/open/model/permission.js';

// Answers the new window page's id, or 0 when it may not be shown.
export const window = CHANNEL.pageToMain(
    'deckit-shell:web-window',
    { name: 'string', url: 'string', title: 'string' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
// headers: [[name, value]]; body: bytes in base64, left out for none; redirect: follow, error or manual. Answers
// `{ url, status, headers, body, redirected }`.
export const fetch = CHANNEL.pageToMain(
    'deckit-shell:web-fetch',
    { name: 'string', url: 'string', method: 'string', headers: 'array', body: 'string?', redirect: 'string' },
    { reply: true, guard: WEB_PERMISSION.NETWORK }
);
export const clear = CHANNEL.pageToMain(
    'deckit-shell:web-clear',
    { name: 'string' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
// entries: [{ host, fingerprint }]. Answers nothing.
export const trust = CHANNEL.pageToMain(
    'deckit-shell:web-trust',
    { name: 'string', entries: 'array' },
    { reply: true, guard: WEB_PERMISSION.CERTIFICATES }
);
// entries: [{ origin, permission }]. Answers nothing, as revoke does.
export const allow = CHANNEL.pageToMain(
    'deckit-shell:web-allow',
    { name: 'string', entries: 'array' },
    { reply: true, guard: WEB_PERMISSION.SITE_PERMISSIONS }
);
export const revoke = CHANNEL.pageToMain(
    'deckit-shell:web-revoke',
    { name: 'string', entries: 'array' },
    { reply: true, guard: WEB_PERMISSION.SITE_PERMISSIONS }
);

export const load = CHANNEL.pageToMain(
    'deckit-shell:web-load',
    { id: 'number', url: 'string' },
    { guard: CHANNEL.GUARD.ANY }
);
// to: back, forward, reload, stop
export const navigate = CHANNEL.pageToMain(
    'deckit-shell:web-navigate',
    { id: 'number', to: 'string' },
    { guard: CHANNEL.GUARD.ANY }
);
export const state = CHANNEL.pageToMain('deckit-shell:web-state', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
export const mute = CHANNEL.pageToMain(
    'deckit-shell:web-mute',
    { id: 'number', on: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);
export const find = CHANNEL.pageToMain(
    'deckit-shell:web-find',
    {
        id: 'number',
        text: 'string',
        start: 'boolean',
        back: 'boolean',
        matchCase: 'boolean',
    },
    { guard: CHANNEL.GUARD.ANY }
);
export const stopFind = CHANNEL.pageToMain(
    'deckit-shell:web-stop-find',
    { id: 'number', keepSelection: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);
export const close = CHANNEL.pageToMain('deckit-shell:web-close', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
export const clickNotification = CHANNEL.pageToMain(
    'deckit-shell:web-click-notification',
    {
        id: 'number',
        notification: 'number',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// Answers the `asking` of that number.
export const permit = CHANNEL.pageToMain(
    'deckit-shell:web-permit',
    { ask: 'number', allow: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);
// Answers the `saving` of that number.
export const save = CHANNEL.pageToMain(
    'deckit-shell:web-save',
    { ask: 'number', save: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);

// The mod's downloads, by the id the web engine gives each: { id, url, name, path, state, received, expected, error,
// started }.
export const downloads = CHANNEL.pageToMain(
    'deckit-shell:web-downloads',
    {},
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
// Answers nothing, once a download of the mod's under way by that id is stopped.
export const cancelDownload = CHANNEL.pageToMain(
    'deckit-shell:web-download-cancel',
    { id: 'string' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);
export const openDownload = CHANNEL.pageToMain(
    'deckit-shell:web-download-open',
    { id: 'string' },
    { reply: true, guard: OPEN_PERMISSION.FILE_HANDLERS }
);
export const removeDownload = CHANNEL.pageToMain(
    'deckit-shell:web-download-remove',
    { id: 'string' },
    { reply: true, guard: CHANNEL.GUARD.MOD }
);

export const changed = CHANNEL.mainToPage('deckit-shell:web-changed');
// certificate: { url, host, error, fingerprint, subject, issuer }
export const refused = CHANNEL.mainToPage('deckit-shell:web-certificate-refused');
export const found = CHANNEL.mainToPage('deckit-shell:web-found');
// A file page's link to the web, not followed in place.
export const leaving = CHANNEL.mainToPage('deckit-shell:web-leaving');
export const opening = CHANNEL.mainToPage('deckit-shell:web-opening');
// Permissions, or opening an app (`app`, `url`); answered with permit.
export const asking = CHANNEL.mainToPage('deckit-shell:web-asking');
export const notified = CHANNEL.mainToPage('deckit-shell:web-notified');
export const closed = CHANNEL.mainToPage('deckit-shell:web-closed');
// A download a web page started, to be saved or not (`url`, `name`, `mimeType`, `expected`); answered with save.
export const saving = CHANNEL.mainToPage('deckit-shell:web-saving');
// One of the mod's downloads, as it changes.
export const downloaded = CHANNEL.mainToPage('deckit-shell:web-downloaded');
