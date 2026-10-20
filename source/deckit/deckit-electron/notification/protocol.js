import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';

// Answers whether it was shown. `id` comes back with clicked.
export const show = CHANNEL.pageToMain(
    'deckit-electron:notification-show',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true }
);
export const clicked = CHANNEL.mainToPage('deckit-electron:notification-clicked');
