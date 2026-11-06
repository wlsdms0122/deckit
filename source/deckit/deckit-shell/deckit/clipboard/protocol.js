import * as CHANNEL from '../channel/index.js';

export const readText = CHANNEL.pageToMain('deckit-shell:clipboard-read', {}, { reply: true });
export const writeText = CHANNEL.pageToMain('deckit-shell:clipboard-write', { text: 'string' }, { reply: true });
