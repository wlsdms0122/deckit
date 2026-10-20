// Between main and every page deckit makes, about what the page is.
import * as IPC from '../deck/ipc/index.js';

// Answers at once, so a page is built in one pass: { page }, the name of a page the shell made, or for a mod's
// { id }, what deckit's names for a mod's sessions start from.
export const setup = IPC.rendererToMain('deckit-electron:page-setup', {}, { reply: true, sync: true });
