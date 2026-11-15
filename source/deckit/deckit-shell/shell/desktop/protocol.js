// Between main and the desktop's page, deckit://desktop/, where the backdrop and the windows' frames are drawn.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// Answers { state } at once: the page is built in one pass.
export const setup = CHANNEL.pageToMain(
    'deckit-shell:desktop-setup',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// `{ windows: [{ id, frame, key, holder, bar, title }], panels: [{ id, edge, frame }], seats, asks, drop, strip, dock,
// down }`: the windows on the screen of the seat at the host window, `frame` on the stage, `key` whether it is that
// seat's key window, `holder` the name of the colour of the seat that holds its keyboard (a seat colour of the kit's
// token), or null, `bar` its title bar (model/layout.js barOf), `title` what the title bar
// the shell draws over a titled window's content holds, or null for a window whose content draws its own; `panels`,
// the panel windows at their edge, 'top' in the strip or 'right', the material drawn under each at its frame; `seats`,
// `[{ id, name, colour, at, buttons, idle, shown }]`, every seat at the desktop: its user's name, its colour's name,
// where its pointer is on the stage, or null before it was anywhere, the buttons it holds, whether its devices gave
// nothing for the idle time, and whether it is the one whose view the host window shows, each as of this telling;
// `asks`, `[{ id, user, name }]`, the users that ask to sit, in the order they asked, each ask under a number of its
// own with its user's id and name; `drop`
// `{ tile, frame }`, the tile (model/layout.js TILES) a window dragged by its title bar takes let go now, at its frame,
// or null; `strip`
// `{ height, controlsWidth }`, the host window's bar over the page's top, which drags the host window, and the width
// its controls take from its start; `dock` `{ items, active, attention }`, the Dock's items
// (dock/main.js items), the id of the mod whose window is that seat's key window, or null, and the ids of the mods
// that ask for that seat's attention; and `down` `{ name, why }` once deckit's core answers nothing more, or null.
export const state = CHANNEL.mainToPage('deckit-shell:desktop-state');
// What the pointer of a seat that is not the one shown just did, each event as it comes, between two states:
// `{ id, type, x, y, buttons }`, `type` 'move', 'down', 'up' or 'scroll', the point on the stage, the buttons held
// after it, and for a scroll `dx`, `dy`.
export const seat = CHANNEL.mainToPage('deckit-shell:desktop-seat');
// What the pointer of the seat at the host window does on a part of a window the page draws, as it does it, main
// recognizing what it means: `id` the window, `part` 'bar', its title bar, an edge as model/layout.js resized names
// it, a button by its name or 'buttons' between them; `type` 'down' on the part, then 'move' and 'up' wherever the
// pointer goes with the button held, `part` then what of the window is under it; `x`, `y` on the screen, which holds
// still as the frame moves; `button` the one pressed or let go; and for a 'down', `count`, its click count, and
// `grabX`, `grabY`, where it is from the frame's top left.
export const pointer = CHANNEL.pageToMain(
    'deckit-shell:desktop-pointer',
    {
        id: 'number',
        part: 'string',
        type: 'string',
        x: 'number',
        y: 'number',
        button: 'number',
        count: 'number?',
        grabX: 'number?',
        grabY: 'number?',
    },
    { guard: CHANNEL.GUARD.ANY }
);
// The Dock slid `out` as the pointer came near, or back in to its sliver: where it takes the pointer.
export const dock = CHANNEL.pageToMain('deckit-shell:desktop-dock', { out: 'boolean' }, { guard: CHANNEL.GUARD.ANY });
// Where the page draws glass, a material laid just under it at each: `materials`, `[{ material, x, y, width, height,
// cornerRadius }]` on the stage, the Dock's card while it is out and still and each panel window's material standing
// still at its frame, none where the system asks for less transparency.
export const glass = CHANNEL.pageToMain(
    'deckit-shell:desktop-glass',
    { materials: 'array' },
    { guard: CHANNEL.GUARD.ANY }
);
// Whether the system asks for reduced motion, told as the page starts and each time that changes.
export const motion = CHANNEL.pageToMain(
    'deckit-shell:desktop-motion',
    { reduced: 'boolean' },
    { guard: CHANNEL.GUARD.ANY }
);
// The person asks for the app to restart, deckit's core having gone down.
export const restart = CHANNEL.pageToMain('deckit-shell:desktop-restart', {}, { guard: CHANNEL.GUARD.ANY });
