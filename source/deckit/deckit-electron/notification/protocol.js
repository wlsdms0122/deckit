import * as IPC from '../../deck/ipc/index.js';

// Answers whether it was shown. `id` comes back with clicked.
export const show = IPC.rendererToMain(
    'deckit-electron:notification-show',
    { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
    { reply: true }
);
export const clicked = IPC.mainToRenderer('deckit-electron:notification-clicked');
