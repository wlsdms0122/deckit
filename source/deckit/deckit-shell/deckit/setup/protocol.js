// Between main and every page deckit makes, about what the page is.
import * as CHANNEL from '../../deck/channel/index.js';

// Answers at once, so a page is built in one pass: { page }, the name a page that runs no mod was made by, or for a
// mod's { sessions, layers }: what its web sessions are named by, as the environment told main (environment:
// MAIN.web.sessionsOf), and the names of the layers stacked over deckit on it, so the page puts them together.
export const setup = CHANNEL.pageToMain('deckit-shell:page-setup', {}, { reply: true, sync: true });
