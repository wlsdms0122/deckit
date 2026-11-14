// Between a user at a seat and deckit: what the user's pointer and keyboard do and what the user reads of the desktop.
// The seat is the sender's, so no message names one. Every channel a sender asks is held to the seat permission, which
// the job of a user alone holds.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// The permission of a user's job, which every channel a sender asks is guarded by.
const SEAT = { reply: true, guard: 'deckit.seat' };

// The pointer: `type` is `move`, `down`, `up` or `scroll`, at the desktop point `x`, `y`.
export const pointer = CHANNEL.pageToMain(
    'deckit-shell:seat-pointer',
    {
        type: 'string',
        x: 'number',
        y: 'number',
        button: 'number?',
        buttons: 'array?',
        modifiers: 'array?',
        count: 'number?',
        dx: 'number?',
        dy: 'number?',
    },
    SEAT
);
// A key: `type` is `down` or `up`.
export const key = CHANNEL.pageToMain(
    'deckit-shell:seat-key',
    {
        type: 'string',
        code: 'string',
        key: 'string',
        modifiers: 'array?',
        repeat: 'boolean?',
    },
    SEAT
);
// Text: `type` is `insert`, `compose`, `commit` or `cancel`.
export const text = CHANNEL.pageToMain('deckit-shell:seat-text', { type: 'string', text: 'string?' }, SEAT);
// The pointer acting on what a reading named by `ref`.
export const act = CHANNEL.pageToMain(
    'deckit-shell:seat-act',
    { ref: 'string', action: 'string', dx: 'number?', dy: 'number?' },
    SEAT
);
// A reading of the desktop, a window or a node.
export const read = CHANNEL.pageToMain(
    'deckit-shell:seat-read',
    {
        level: 'string?',
        window: 'string?',
        ref: 'string?',
        depth: 'number?',
        roles: 'array?',
        all: 'boolean?',
        items: 'number?',
        text: 'any?',
        lines: 'any?',
        format: 'string?',
    },
    SEAT
);
// What changed since a mark.
export const changes = CHANNEL.pageToMain('deckit-shell:seat-changes', { since: 'number?' }, SEAT);
// A picture of the desktop, or of the window, the node or the rect named.
export const capture = CHANNEL.pageToMain(
    'deckit-shell:seat-capture',
    {
        window: 'string?',
        ref: 'string?',
        rect: 'object?',
        scale: 'number?',
    },
    SEAT
);
// Whether the seat is told as the desktop changes.
export const watch = CHANNEL.pageToMain('deckit-shell:seat-watch', { on: 'boolean' }, SEAT);
// The desktop changed, told a seat that watches: `{ mark }`.
export const changed = CHANNEL.mainToPage('deckit-shell:seat-changed');
// The seat's key window was taken by another seat: `{ window, holder }`.
export const held = CHANNEL.mainToPage('deckit-shell:seat-held');
