import * as CHANNEL from '../channel/index.js';

// Answers nothing once the address is handed on.
export const open = CHANNEL.pageToMain('deckit-shell:open', { url: 'string', activates: 'boolean' }, { reply: true });
export const reveal = CHANNEL.pageToMain('deckit-shell:open-reveal', { file: 'string' }, { reply: true });
