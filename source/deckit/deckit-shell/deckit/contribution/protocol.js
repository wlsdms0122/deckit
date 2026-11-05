// Between a mod's page and main, about what mods declare to an interface the page's mod owns.
import * as CHANNEL from '../../deck/channel/index.js';

// What is declared to `interface`, `[{ mod: { id, name }, entry, token }]`, asked by its owner.
export const contributions = CHANNEL.pageToMain('deckit-shell:contributions', { interface: 'string' }, { reply: true });
