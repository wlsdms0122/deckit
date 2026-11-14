import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// `level`: info, warn or error. `parts`: what was said, as text.
export const line = CHANNEL.pageToMain(
    'deckit-shell:log',
    { level: 'string', parts: 'array' },
    { guard: CHANNEL.GUARD.ANY }
);
