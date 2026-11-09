import * as CHANNEL from '../channel/index.js';
import * as NOTIFICATION_PERMISSION from './model/permission.js';

// Answers whether it was shown. `id` comes back with pressed.
export const show = CHANNEL.pageToMain(
    'deckit-shell:notification-show',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true, guard: NOTIFICATION_PERMISSION.NOTIFICATIONS }
);
export const pressed = CHANNEL.mainToPage('deckit-shell:notification-pressed');
