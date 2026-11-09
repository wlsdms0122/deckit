import * as CHANNEL from '../channel/index.js';
import * as CLIPBOARD_PERMISSION from './model/permission.js';

export const readText = CHANNEL.pageToMain(
    'deckit-shell:clipboard-read',
    {},
    { reply: true, guard: CLIPBOARD_PERMISSION.CLIPBOARD_READ }
);
export const writeText = CHANNEL.pageToMain(
    'deckit-shell:clipboard-write',
    { text: 'string' },
    { reply: true, guard: CLIPBOARD_PERMISSION.CLIPBOARD_WRITE }
);
