// Between main and a mod's page, about what the person drops on the page from outside the app.
import * as CHANNEL from '../../deck/channel/index.js';

// The paths of the files last dropped on the sending page, as dropped.
export const files = CHANNEL.pageToMain('deckit-shell:drop-files', {}, { reply: true });
