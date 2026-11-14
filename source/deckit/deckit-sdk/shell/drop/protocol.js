// Between main and a mod's page, about what the person drops on the page from outside the app.
import * as CHANNEL from '../../deckit/channel/index.js';

// The paths of the files last dropped on the sending page, or on the surface of it named `surface`, as dropped.
export const files = CHANNEL.pageToMain(
    'deckit-shell:drop-files',
    { surface: 'string?' },
    { reply: true, guard: CHANNEL.GUARD.ANY }
);
