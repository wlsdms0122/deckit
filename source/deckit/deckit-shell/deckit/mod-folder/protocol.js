// Between a mod's page and main, about mod folders: deckit.mods.
import * as CHANNEL from '../channel/index.js';

export const pick = CHANNEL.pageToMain('deckit-shell:mod-folder-pick', { multiple: 'boolean' }, { reply: true });
export const reveal = CHANNEL.pageToMain('deckit-shell:mod-folder-reveal', { id: 'string' }, { reply: true });
