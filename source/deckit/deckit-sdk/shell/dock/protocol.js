// Between main and a page, about the Dock: with a mod's page, the app mods, those the person keeps there, and a mod as
// the person opens it; with the desktop's page, where the Dock is drawn, what the person does to it.
import * as CHANNEL from '../../deckit/channel/index.js';
import * as MOD_PERMISSION from '../../deckit/permission/index.js';

// The icon a mod is listed with, as its manifest fields give it, or ''.
export const icon = CHANNEL.pageToMain(
    'deckit-shell:dock-icon',
    { mod: 'string' },
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// Every app mod, asked by a mod with deckit.mods, `[{ id, name, icon, keywords, pinned, running }]` in the Dock's
// order: `pinned` whether the person keeps it in the Dock, `running` whether it runs now.
export const list = CHANNEL.pageToMain(
    'deckit-shell:dock-list',
    {},
    { reply: true, sync: true, guard: MOD_PERMISSION.MODS }
);
// The mods the person keeps in the Dock, asked by a mod with deckit.mods; and keeping one there or taking it out.
export const pinned = CHANNEL.pageToMain(
    'deckit-shell:dock-pinned',
    {},
    { reply: true, sync: true, guard: MOD_PERMISSION.MODS }
);
export const setPinned = CHANNEL.pageToMain(
    'deckit-shell:dock-set-pinned',
    { id: 'string', pinned: 'boolean' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// A mod as the person opens it from the Dock, asked by a mod with deckit.mods: it launches when it does not run, and
// its windows come in front when it does. Refused for a mod that is no app.
export const open = CHANNEL.pageToMain(
    'deckit-shell:dock-open',
    { id: 'string' },
    { reply: true, guard: MOD_PERMISSION.MODS }
);
// What the person does to the Dock in the desktop's page: an item clicked, a mod quit from its item's menu, kept in the
// Dock or taken out, and the items kept there dragged into the order `ids` names.
export const click = CHANNEL.pageToMain('deckit-shell:dock-click', { id: 'string' }, { guard: CHANNEL.GUARD.ANY });
export const quit = CHANNEL.pageToMain('deckit-shell:dock-quit', { id: 'string' }, { guard: CHANNEL.GUARD.ANY });
export const keep = CHANNEL.pageToMain(
    'deckit-shell:dock-keep',
    { id: 'string', pinned: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);
export const reorder = CHANNEL.pageToMain('deckit-shell:dock-reorder', { ids: 'array' }, { guard: CHANNEL.GUARD.ANY });
