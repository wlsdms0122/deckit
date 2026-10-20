// Between main and every page deckit makes, about what the page is.
import * as CHANNEL from '../../deckit-shell/channel/index.js';

// Answers at once, so a page is built in one pass: { page }, the name of a page the shell made, or for a mod's
// { id }, what deckit's names for a mod's sessions start from.
export const setup = CHANNEL.pageToMain('deckit-electron:page-setup', {}, { reply: true, sync: true });
