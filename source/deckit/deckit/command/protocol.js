import * as IPC from '../../deck/ipc/index.js';

// What the sending mod answers.
export const source = IPC.rendererToMain('deckit:command-source', { resolves: 'boolean' });
// Each question carries the session it is for, whose entries the page keeps until it ends.
export const collect = IPC.mainToRenderer('deckit:command-collect', { reply: true });
export const collectNow = IPC.mainToRenderer('deckit:command-collect-now', { reply: true });
export const resolve = IPC.mainToRenderer('deckit:command-resolve', { reply: true });
export const search = IPC.mainToRenderer('deckit:command-search', { reply: true });
export const run = IPC.mainToRenderer('deckit:command-run', { reply: true });
export const end = IPC.mainToRenderer('deckit:command-end');
