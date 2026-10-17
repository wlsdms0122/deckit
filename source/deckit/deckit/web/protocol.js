// Between a mod's view and main, about the web pages it shows. `name` is a session's name within the mod;
// `id` is a page's webContents id, which main hands out and holds.
import * as IPC from '../../deck/ipc/index.js';

// Answers the new window page's id, or 0 when it may not be shown.
export const window = IPC.rendererToMain(
    'deckit:web-window',
    { name: 'string', url: 'string', title: 'string' },
    { reply: true }
);
export const fetchText = IPC.rendererToMain(
    'deckit:web-fetch-text',
    { name: 'string', url: 'string' },
    { reply: true }
);
export const clear = IPC.rendererToMain('deckit:web-clear', { name: 'string' }, { reply: true });
// entries: [{ host, fingerprint }]
export const trust = IPC.rendererToMain('deckit:web-trust', { name: 'string', entries: 'array' }, { reply: true });
// entries: [{ origin, permission }]
export const allow = IPC.rendererToMain('deckit:web-allow', { name: 'string', entries: 'array' }, { reply: true });
export const revoke = IPC.rendererToMain('deckit:web-revoke', { name: 'string', entries: 'array' }, { reply: true });

export const load = IPC.rendererToMain('deckit:web-load', { id: 'number', url: 'string' });
// to: back, forward, reload, stop
export const navigate = IPC.rendererToMain('deckit:web-navigate', { id: 'number', to: 'string' });
export const state = IPC.rendererToMain('deckit:web-state', { id: 'number' });
export const mute = IPC.rendererToMain('deckit:web-mute', { id: 'number', on: 'boolean' });
export const find = IPC.rendererToMain('deckit:web-find', {
    id: 'number',
    text: 'string',
    start: 'boolean',
    back: 'boolean',
    matchCase: 'boolean',
});
export const stopFind = IPC.rendererToMain('deckit:web-stop-find', { id: 'number', keepSelection: 'boolean' });
export const close = IPC.rendererToMain('deckit:web-close', { id: 'number' });
export const clickNotification = IPC.rendererToMain('deckit:web-click-notification', {
    id: 'number',
    notification: 'number',
});
// Answers the `asking` of that number.
export const permit = IPC.rendererToMain('deckit:web-permit', { ask: 'number', allow: 'boolean' });

export const changed = IPC.mainToRenderer('deckit:web-changed');
// certificate: { url, host, error, fingerprint, subject, issuer }
export const refused = IPC.mainToRenderer('deckit:web-certificate-refused');
export const found = IPC.mainToRenderer('deckit:web-found');
// A file page's link to the web, not followed in place.
export const leaving = IPC.mainToRenderer('deckit:web-leaving');
export const opening = IPC.mainToRenderer('deckit:web-opening');
// Permissions, or opening an app (`app`, `url`); answered with permit.
export const asking = IPC.mainToRenderer('deckit:web-asking');
export const notified = IPC.mainToRenderer('deckit:web-notified');
export const closed = IPC.mainToRenderer('deckit:web-closed');
