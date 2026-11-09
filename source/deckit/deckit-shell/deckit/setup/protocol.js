// Between main and every page deckit makes, about what the page is.
import * as CHANNEL from '../channel/index.js';

// Answers at once, so a page is built in one pass: { page }, the name a page that runs no mod was made by, or for a
// mod's { layers }: the layers stacked over deckit on it, each { name, setup }, `setup` what the layer's setup answered
// for the mod or null, so the page puts them together.
export const setup = CHANNEL.pageToMain('deckit-shell:page-setup', {}, { reply: true, sync: true });
