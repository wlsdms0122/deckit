// Between a mod's page and main, about what mods declare to an interface the page's mod owns.
import * as CHANNEL from '../channel/index.js';

// What is declared to `interface`, `[{ mod: { name }, credential: { mod, permissions }, entry }]`, asked by its owner,
// `mod` and `credential` the declaring mod's as a connection's are the client's.
export const contributions = CHANNEL.pageToMain('deckit-shell:contributions', { interface: 'string' }, { reply: true });
