import * as CHANNEL from '../channel/index.js';
import * as OPEN_PERMISSION from './model/permission.js';

// Answers nothing once the address is handed on.
export const open = CHANNEL.pageToMain(
    'deckit-shell:open',
    { url: 'string', activates: 'boolean' },
    { reply: true, guard: OPEN_PERMISSION.permissionOf }
);
