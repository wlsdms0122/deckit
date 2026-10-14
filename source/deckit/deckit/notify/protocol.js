import * as IPC from '../../core/ipc/index.js';

// Answers whether it was shown. `id` comes back with clicked.
export const notify = IPC.rendererToMain(
    'deckit:notify',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true }
);
export const clicked = IPC.mainToRenderer('deckit:notify-clicked');
