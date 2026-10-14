import * as IPC from '../../core/ipc/index.js';

// `level`: info, warn or error. `parts`: what was said, as text.
export const line = IPC.rendererToMain('deck:log', { level: 'string', parts: 'array' });
