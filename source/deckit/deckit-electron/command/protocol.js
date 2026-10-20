import * as IPC from '../deck/ipc/index.js';

// Each question carries the session it is for, whose entries the page keeps until it ends.
export const collect = IPC.mainToRenderer('deckit-electron:command-collect', { reply: true });
export const collectNow = IPC.mainToRenderer('deckit-electron:command-collect-now', { reply: true });
export const resolve = IPC.mainToRenderer('deckit-electron:command-resolve', { reply: true });
export const search = IPC.mainToRenderer('deckit-electron:command-search', { reply: true });
export const run = IPC.mainToRenderer('deckit-electron:command-run', { reply: true });
export const end = IPC.mainToRenderer('deckit-electron:command-end');
