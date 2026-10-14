// Between main and every page the shell draws in, about the theme it draws in.
import * as IPC from '../../deck/ipc.js';

// Answers { theme } at once: the host app's, or null until it gives one.
export const setup = IPC.rendererToMain('deckit-shell:theme-setup', {}, { reply: true, sync: true });

// { theme }: the host app's new one.
export const change = IPC.mainToRenderer('deckit-shell:theme-change');
