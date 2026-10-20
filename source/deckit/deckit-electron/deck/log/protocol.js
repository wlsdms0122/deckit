import * as CHANNEL from '../../../deckit-shell/deck/channel/index.js';

// `level`: info, warn or error. `parts`: what was said, as text.
export const line = CHANNEL.pageToMain('deckit-electron:log', { level: 'string', parts: 'array' });
