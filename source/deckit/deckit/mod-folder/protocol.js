// Between a mod's page and main, about mod folders on this Mac: deckit.mods.
import * as IPC from '../../core/ipc/index.js';

export const pick = IPC.rendererToMain('deckit:mod-folder-pick', {}, { reply: true });
export const reveal = IPC.rendererToMain('deckit:mod-folder-reveal', { id: 'string' }, { reply: true });
