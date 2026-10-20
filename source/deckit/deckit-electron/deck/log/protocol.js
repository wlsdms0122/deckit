import * as IPC from '../ipc/index.js';

// `level`: info, warn or error. `parts`: what was said, as text.
export const line = IPC.rendererToMain('deckit-electron:log', { level: 'string', parts: 'array' });
