// Between a mod's view and main, about the web pages it shows. `name` is a session's name within the mod;
// `id` is a page's webContents id, which main hands out and holds.
import * as CHANNEL from '../../deckit-driver/channel/index.js';

// Answers the new window page's id, or 0 when it may not be shown.
export const window = CHANNEL.pageToMain(
    'deckit-electron:web-window',
    { name: 'string', url: 'string', title: 'string' },
    { reply: true }
);
export const fetchText = CHANNEL.pageToMain(
    'deckit-electron:web-fetch-text',
    { name: 'string', url: 'string' },
    { reply: true }
);
export const clear = CHANNEL.pageToMain('deckit-electron:web-clear', { name: 'string' }, { reply: true });
// entries: [{ host, fingerprint }]
export const trust = CHANNEL.pageToMain(
    'deckit-electron:web-trust',
    { name: 'string', entries: 'array' },
    { reply: true }
);
// entries: [{ origin, permission }]
export const allow = CHANNEL.pageToMain(
    'deckit-electron:web-allow',
    { name: 'string', entries: 'array' },
    { reply: true }
);
export const revoke = CHANNEL.pageToMain(
    'deckit-electron:web-revoke',
    { name: 'string', entries: 'array' },
    { reply: true }
);

export const load = CHANNEL.pageToMain('deckit-electron:web-load', { id: 'number', url: 'string' });
// to: back, forward, reload, stop
export const navigate = CHANNEL.pageToMain('deckit-electron:web-navigate', { id: 'number', to: 'string' });
export const state = CHANNEL.pageToMain('deckit-electron:web-state', { id: 'number' });
export const mute = CHANNEL.pageToMain('deckit-electron:web-mute', { id: 'number', on: 'boolean' });
export const find = CHANNEL.pageToMain('deckit-electron:web-find', {
    id: 'number',
    text: 'string',
    start: 'boolean',
    back: 'boolean',
    matchCase: 'boolean',
});
export const stopFind = CHANNEL.pageToMain('deckit-electron:web-stop-find', { id: 'number', keepSelection: 'boolean' });
export const close = CHANNEL.pageToMain('deckit-electron:web-close', { id: 'number' });
export const clickNotification = CHANNEL.pageToMain('deckit-electron:web-click-notification', {
    id: 'number',
    notification: 'number',
});
// Answers the `asking` of that number.
export const permit = CHANNEL.pageToMain('deckit-electron:web-permit', { ask: 'number', allow: 'boolean' });

export const changed = CHANNEL.mainToPage('deckit-electron:web-changed');
// certificate: { url, host, error, fingerprint, subject, issuer }
export const refused = CHANNEL.mainToPage('deckit-electron:web-certificate-refused');
export const found = CHANNEL.mainToPage('deckit-electron:web-found');
// A file page's link to the web, not followed in place.
export const leaving = CHANNEL.mainToPage('deckit-electron:web-leaving');
export const opening = CHANNEL.mainToPage('deckit-electron:web-opening');
// Permissions, or opening an app (`app`, `url`); answered with permit.
export const asking = CHANNEL.mainToPage('deckit-electron:web-asking');
export const notified = CHANNEL.mainToPage('deckit-electron:web-notified');
export const closed = CHANNEL.mainToPage('deckit-electron:web-closed');
