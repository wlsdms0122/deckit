import * as CHANNEL from '../../deckit-driver/channel/index.js';

export const readText = CHANNEL.pageToMain('deckit-electron:clipboard-read', {}, { reply: true });
export const writeText = CHANNEL.pageToMain('deckit-electron:clipboard-write', { text: 'string' }, { reply: true });
