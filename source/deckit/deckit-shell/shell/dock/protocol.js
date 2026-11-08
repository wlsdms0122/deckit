// Between main and a mod's page, about the Dock: the app mods, those the person keeps there, and a mod as the person
// opens it.
import * as CHANNEL from '../../deckit/channel/index.js';

// The icon a mod is listed with, as its manifest fields give it, or ''.
export const icon = CHANNEL.pageToMain('deckit-shell:dock-icon', { mod: 'string' }, { reply: true, sync: true });
// Every app mod, asked by a mod with deckit.mods, `[{ id, name, icon, keywords, pinned, running }]` in the Dock's
// order: `pinned` whether the person keeps it in the Dock, `running` whether it runs now.
export const list = CHANNEL.pageToMain('deckit-shell:dock-list', {}, { reply: true, sync: true });
// The mods the person keeps in the Dock, asked by a mod with deckit.mods; and keeping one there or taking it out.
export const pinned = CHANNEL.pageToMain('deckit-shell:dock-pinned', {}, { reply: true, sync: true });
export const setPinned = CHANNEL.pageToMain(
    'deckit-shell:dock-set-pinned',
    { id: 'string', pinned: 'boolean' },
    { reply: true }
);
// A mod as the person opens it from the Dock, asked by a mod with deckit.mods: it launches when it does not run, and
// its windows come in front when it does. Refused for a mod that is no app.
export const open = CHANNEL.pageToMain('deckit-shell:dock-open', { id: 'string' }, { reply: true });
