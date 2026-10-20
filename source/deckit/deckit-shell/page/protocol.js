// Between main and every page deckit makes, about what the page is.
import * as CHANNEL from '../deck/channel/index.js';

// Answers at once, so a page is built in one pass: { page }, the name of a page the shell made, or for a mod's
// { sessions, attached }: what its web sessions are named by, as the environment told main (environment:
// MAIN.web.sessionsOf), and whether the shell's UI is on deckit, so the page wears it.
export const setup = CHANNEL.pageToMain('deckit-shell:page-setup', {}, { reply: true, sync: true });
