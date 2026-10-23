// Between a mod's view and main, about the web pages it shows. `name` is a session's name within the mod; `id` is a
// web page's, as the environment hands it out, which the mod's page keeps and hands back, never reads.
import * as CHANNEL from '../../deck/channel/index.js';

// Answers the new window page's id, or 0 when it may not be shown.
export const window = CHANNEL.pageToMain(
    'deckit-shell:web-window',
    { name: 'string', url: 'string', title: 'string' },
    { reply: true }
);
export const fetchText = CHANNEL.pageToMain(
    'deckit-shell:web-fetch-text',
    { name: 'string', url: 'string' },
    { reply: true }
);
export const clear = CHANNEL.pageToMain('deckit-shell:web-clear', { name: 'string' }, { reply: true });
// entries: [{ host, fingerprint }]
export const trust = CHANNEL.pageToMain(
    'deckit-shell:web-trust',
    { name: 'string', entries: 'array' },
    { reply: true }
);
// entries: [{ origin, permission }]
export const allow = CHANNEL.pageToMain(
    'deckit-shell:web-allow',
    { name: 'string', entries: 'array' },
    { reply: true }
);
export const revoke = CHANNEL.pageToMain(
    'deckit-shell:web-revoke',
    { name: 'string', entries: 'array' },
    { reply: true }
);

export const load = CHANNEL.pageToMain('deckit-shell:web-load', { id: 'number', url: 'string' });
// to: back, forward, reload, stop
export const navigate = CHANNEL.pageToMain('deckit-shell:web-navigate', { id: 'number', to: 'string' });
export const state = CHANNEL.pageToMain('deckit-shell:web-state', { id: 'number' });
export const mute = CHANNEL.pageToMain('deckit-shell:web-mute', { id: 'number', on: 'boolean' });
export const find = CHANNEL.pageToMain('deckit-shell:web-find', {
    id: 'number',
    text: 'string',
    start: 'boolean',
    back: 'boolean',
    matchCase: 'boolean',
});
export const stopFind = CHANNEL.pageToMain('deckit-shell:web-stop-find', { id: 'number', keepSelection: 'boolean' });
export const close = CHANNEL.pageToMain('deckit-shell:web-close', { id: 'number' });
export const clickNotification = CHANNEL.pageToMain('deckit-shell:web-click-notification', {
    id: 'number',
    notification: 'number',
});
// Answers the `asking` of that number.
export const permit = CHANNEL.pageToMain('deckit-shell:web-permit', { ask: 'number', allow: 'boolean' });

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
