import * as CHANNEL from '../../deck/channel/index.js';

// Answers whether it was shown. `id` comes back with clicked.
export const show = CHANNEL.pageToMain(
    'deckit-shell:notification-show',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true }
);
export const clicked = CHANNEL.mainToPage('deckit-shell:notification-clicked');
