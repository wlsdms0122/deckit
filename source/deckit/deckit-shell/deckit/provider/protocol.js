// Between a mod's page and main, about who declares keys and commands.
import * as CHANNEL from '../../deck/channel/index.js';

// The provider of an id, `{ id, name, host }`, or null.
export const provider = CHANNEL.pageToMain('deckit-shell:provider', { id: 'string' }, { reply: true });
