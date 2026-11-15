// Between main and the page of a mod with deckit.seats, about who sits at the desktop. Every id is one the shell made
// for what it tells, which says nothing of the seat or the user it names.
import * as CHANNEL from '../../deckit/channel/index.js';
import * as SEATS_PERMISSION from './model/permission.js';

// Who sits and who asks to: `{ seats, asks }`, `seats` each `{ id, name, colour, idle, following }` in the order they
// sat, `name` its user's, `colour` the name of the kit's seat colour it is told apart by, `idle` whether its devices
// gave no input for the idle time, `following` whether the host window shows its view in its own seat's place; `asks`
// each `{ id, name }` in the order they asked, `name` the user's.
export const read = CHANNEL.pageToMain('deckit-shell:seats-read', {}, { reply: true, guard: SEATS_PERMISSION.SEATS });
// The page is told each change of what `read` answers from now on.
export const watch = CHANNEL.pageToMain('deckit-shell:seats-watch', {}, { reply: true, guard: SEATS_PERMISSION.SEATS });
// The ask `ask` answered, `allow` whether its user may sit: answers whether it waited.
export const answer = CHANNEL.pageToMain(
    'deckit-shell:seats-answer',
    { ask: 'string', allow: 'boolean' },
    { reply: true, guard: SEATS_PERMISSION.SEATS }
);
// The host window shows the view of the seat `seat`, or its own seat's again with none: answers whether it shows
// that seat's now.
export const follow = CHANNEL.pageToMain(
    'deckit-shell:seats-follow',
    { seat: 'string?' },
    { reply: true, guard: SEATS_PERMISSION.SEATS }
);
// What `read` answers changed.
export const changed = CHANNEL.mainToPage('deckit-shell:seats-changed');
