// Between main and the desktop's page, deckit://desktop/, where the backdrop and the windows' frames are drawn.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// Answers { state } at once: the page is built in one pass.
export const setup = CHANNEL.pageToMain(
    'deckit-shell:desktop-setup',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// `{ windows: [{ id, frame, key, minimum, title }], panels: [{ id, frame }], strip, dock, down }`: the windows on the
// screen of the seat at the host window, `frame` on the stage, `key` whether it is that seat's key window, `minimum`
// the size it is never below, `title` what the title bar the shell draws over a titled window's content holds, or null
// for a window whose content draws its own; `panels`, the panel windows in the strip, the material drawn under each at
// its frame; `strip` `{ height, controlsWidth }`, the host window's bar over the page's top, which drags the host
// window, and the width its controls take from its start; `dock` `{ items, active, attention }`, the Dock's items
// (dock/main.js items), the id of the mod whose window is that seat's key window, or null, and the ids of the mods
// that ask for that seat's attention; and `down` `{ name, why }` once deckit's core answers nothing more, or null.
export const state = CHANNEL.mainToPage('deckit-shell:desktop-state');
// A press on a window's frame or its buttons.
export const press = CHANNEL.pageToMain('deckit-shell:desktop-press', { id: 'number' }, { guard: CHANNEL.GUARD.ANY });
// One of a window's buttons clicked: `button` 'close', 'minimize' or 'zoom'.
export const button = CHANNEL.pageToMain(
    'deckit-shell:desktop-button',
    { id: 'number', button: 'string' },
    { guard: CHANNEL.GUARD.ANY }
);
// A window's frame as a drag of its edge draws it: `phase` 'changed', then 'ended' as the drag ends.
export const resize = CHANNEL.pageToMain(
    'deckit-shell:desktop-resize',
    {
        id: 'number',
        phase: 'string',
        x: 'number',
        y: 'number',
        width: 'number',
        height: 'number',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// A drag of a titled window's title bar, `dx`, `dy` from the press on the screen: `phase` 'began', 'changed', then
// 'ended' as the drag ends; and the second press of a double click there.
export const move = CHANNEL.pageToMain(
    'deckit-shell:desktop-move',
    {
        id: 'number',
        phase: 'string',
        dx: 'number',
        dy: 'number',
    },
    { guard: CHANNEL.GUARD.ANY }
);
export const doubleClick = CHANNEL.pageToMain(
    'deckit-shell:desktop-double-click',
    { id: 'number' },
    { guard: CHANNEL.GUARD.ANY }
);
// The Dock slid `out` as the pointer came near, or back in to its sliver: where it takes the pointer.
export const dock = CHANNEL.pageToMain('deckit-shell:desktop-dock', { out: 'boolean' }, { guard: CHANNEL.GUARD.ANY });
// The person asks for the app to restart, deckit's core having gone down.
export const restart = CHANNEL.pageToMain('deckit-shell:desktop-restart', {}, { guard: CHANNEL.GUARD.ANY });
