import * as CHANNEL from '../channel/index.js';

// Answers whether it was shown. `id` comes back with pressed.
export const show = CHANNEL.pageToMain(
    'deckit-shell:notification-show',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true }
);
export const pressed = CHANNEL.mainToPage('deckit-shell:notification-pressed');
