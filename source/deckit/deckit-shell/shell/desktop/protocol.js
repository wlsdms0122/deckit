// Between main and the desktop's page, deckit://desktop/, where the backdrop, the windows' frames and the seats'
// cursors are drawn.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// Answers { state } at once: the page is built in one pass.
export const setup = CHANNEL.pageToMain(
    'deckit-shell:desktop-setup',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
// `{ windows: [{ id, frame, key, holder, bar, title, dialogs }], panels: [{ id, edge, frame, radius }], seats,
// following, drop, strip, dock, down }`: the windows on the screen of the seat whose view the host window shows, the local
// seat's or that of the seat it follows, `frame` on the stage, `key` whether it is that seat's key window, `holder`
// the name of the colour of the seat that holds its keyboard (a seat colour of the kit's token), or null, `bar` its
// title bar
// (model/layout.js barOf), `title` what the title bar the shell draws over a titled window's content holds, or null for
// a window whose content draws its own, `dialogs` those its pages ask, `{ ask, kind, message, from, value, rect,
// parts }` from the window's top left (model/dialog.js partsOf); `panels`, the panel windows that stand, at their
// edge, 'top' in the strip, or with `edge` null as a view, as they lie from the bottom, the material
// drawn under each at its frame, rounded by `radius`;
// `seats`, `[{ id, name, colour, at, buttons, shown, under, named, typing }]`, every
// seat at the desktop: its user's name, its colour's name, where its pointer is on the stage, or the mark at the
// stage's edge toward it where it is outside the camera shown (model/marks.js cursorOn), or null before it was
// anywhere, the buttons it holds, whether it is the one whose view
// the host window shows, what its cursor is drawn under, `[{ x, y, width, height, radius }]` on the stage, the rects
// that cover it there, each with the radius of its corners, or null for a cursor that is not seen at all
// (model/marks.js underOf), whether its name shows beside
// its cursor (model/marks.js nameLeft), and where it types in a window that does not have the machine's keyboard,
// `{ ring, bars, caret, over }`, the ring round what has the focus there, `{ x, y, width, height, radius, line }` on
// the stage (model/marks.js ringOf), the rects of what is selected in it or, `caret` true, the one its caret is at,
// and whether it is drawn over everything, or null, each as of this telling;
// `following`, `{ id, name, colour }`, the seat the local seat follows, whose view this is, or null for the local
// seat's own; `drop` `{ tile, frame }`, the tile
// (model/layout.js TILES) a window dragged by its title bar takes let go now, at its frame, or null; `strip` `{ height,
// controlsWidth }`, the host window's bar over the page's top, which drags the host window, and the width its controls
// take from its start; `dock` `{ items, active, attention, held, menu }`, the Dock's items (dock/main.js items), the id
// of the mod whose window is that seat's key window, or null, the ids of the mods that ask for that seat's attention,
// the id of the item a seat drags now, or null, and the menu of an item open for the local seat, as the Dock's model
// lays it (dock/model/dock.js menuOf), or null; and `down` `{ name, why }` once deckit's core answers nothing more, or
// null.
export const state = CHANNEL.mainToPage('deckit-shell:desktop-state');
// What the pointer of a seat that is not the one shown just did, each event as it comes, between two states:
// `{ id, type, x, y, buttons, under, named, glide }`, `type` 'move', 'down', 'up' or 'scroll', or 'rest' once it did
// nothing for as long as the seat's name shows, the point on the stage or the mark at its edge, the buttons held after it, what the cursor is
// drawn under there, as the state says it, whether the seat's name shows beside it, whether the cursor glides there
// or is there at once
// (model/marks.js glides), and for a scroll `dx`, `dy`.
export const seat = CHANNEL.mainToPage('deckit-shell:desktop-seat');
// What the pointer of the seat at the host window does on a part the page draws, as it does it, main recognizing
// what it means. On a window: `id` the window, `part` 'bar', its title bar, an edge as model/layout.js resized names
// it, a button by its name or 'buttons' between them; `type` 'down' on the part, then 'move' and 'up' wherever the
// pointer goes with the button held, `part` then what of the window is under it; `x`, `y` on the screen, which holds
// still as the frame moves; `button` the one pressed or let go; and for a 'down', `count`, its click count, and
// `grabX`, `grabY`, where it is from the frame's top left. On the Dock or an item's menu: `part` 'dock' and `x`, `y`
// in the page, a point on the Dock's card where it is with the Dock out, however far it has slid, main finding what
// stands there; a context press is a 'down' and an 'up' of `button` 2; and what the keyboard presses, which is at
// no point, is named by `item`, an item's mod or with `part` 'dock-menu' an entry of the menu, '' for the press that
// puts the menu away.
export const pointer = CHANNEL.pageToMain(
    'deckit-shell:desktop-pointer',
    {
        id: 'number?',
        item: 'string?',
        part: 'string',
        type: 'string',
        x: 'number',
        y: 'number',
        button: 'number',
        count: 'number?',
        grabX: 'number?',
        grabY: 'number?',
        ask: 'number?',
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
// What the local seat does in the field of a prompt drawn in a window's dialog surface: `ask` the dialog, `text` the
// field's text as it is typed, and `key` 'Enter' or 'Escape' pressed in it.
export const dialog = CHANNEL.pageToMain(
    'deckit-shell:desktop-dialog',
    { ask: 'number', text: 'string?', key: 'string?' },
    { guard: CHANNEL.GUARD.ANY }
);
