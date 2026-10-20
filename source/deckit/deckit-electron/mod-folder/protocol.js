// Between a mod's page and main, about mod folders on this Mac: deckit.mods.
import * as CHANNEL from '../../deckit-shell/channel/index.js';

export const pick = CHANNEL.pageToMain('deckit-electron:mod-folder-pick', {}, { reply: true });
export const reveal = CHANNEL.pageToMain('deckit-electron:mod-folder-reveal', { id: 'string' }, { reply: true });
