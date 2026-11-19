// Between a user at a seat and deckit: what the seat's devices do, one way in, and what the seat can perceive, asked
// once or told. The seat is the sender's, so no message names one. Every channel a sender asks is held to the seat
// permission, which the job of a user alone holds. A channel carries the word that names a kind of device or an
// output, and what else it carries is held to what the layer that serves it names.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// The permission of a user's job, which every channel a sender asks is guarded by.
const SEAT = { reply: true, guard: 'deckit.seat' };
// What a seat's devices did: `event` names a kind of device, `type` one of its events.
export const input = CHANNEL.pageToMain(
    'deckit-shell:seat-input',
    { event: 'string', type: 'string', [CHANNEL.REST]: 'any?' },
    SEAT
);
// An output asked once, which `of` names.
export const read = CHANNEL.pageToMain('deckit-shell:seat-read', { of: 'string', [CHANNEL.REST]: 'any?' }, SEAT);
// Whether the seat is told of the output `of`.
export const watch = CHANNEL.pageToMain('deckit-shell:seat-watch', { of: 'string', on: 'boolean' }, SEAT);
// An output told a seat that watches it: `{ of, ... }` with what its row tells.
export const output = CHANNEL.mainToPage('deckit-shell:seat-output');
