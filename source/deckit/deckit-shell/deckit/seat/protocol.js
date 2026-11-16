// Between a user at a seat and deckit: what the seat's devices do, one way in, and what the seat can perceive, asked
// once or told. The seat is the sender's, so no message names one. Every channel a sender asks is held to the seat
// permission, which the job of a user alone holds. A kind of device is a row of EVENTS and an output a row of OUTPUTS:
// a channel carries the word that names the row, and what else it carries is held to the row.
import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// The permission of a user's job, which every channel a sender asks is guarded by.
const SEAT = { reply: true, guard: 'deckit.seat' };
// How a reading of the desktop, a window or a node is asked.
const READING = Object.freeze({
    window: 'string?',
    ref: 'string?',
    depth: 'integer?',
    roles: 'array?',
    all: 'boolean?',
    items: 'integer?',
    text: 'integer?',
    lines: 'integer?',
    format: 'string?',
});

// What a seat's devices do, by the kind of device: the `types` of its events and the `fields` beside `event` and
// `type`. A pointer's place is the desktop point `x`, `y`, or `ref`, what a reading named. No row has `source`,
// `carried` or `page`, which no party sends.
export const EVENTS = Object.freeze({
    pointer: Object.freeze({
        types: Object.freeze(['move', 'down', 'up', 'scroll']),
        fields: Object.freeze({
            x: 'number?',
            y: 'number?',
            ref: 'string?',
            button: 'integer?',
            buttons: 'array?',
            modifiers: 'array?',
            count: 'integer?',
            dx: 'number?',
            dy: 'number?',
        }),
    }),
    key: Object.freeze({
        types: Object.freeze(['down', 'up']),
        fields: Object.freeze({ code: 'string', key: 'string', modifiers: 'array?', repeat: 'boolean?' }),
    }),
    text: Object.freeze({
        types: Object.freeze(['insert', 'compose', 'commit', 'cancel']),
        fields: Object.freeze({ text: 'string?' }),
    }),
});

// What a seat can perceive, by its name: `query`, the fields it is asked once with, or null for one with no state to
// read; `told`, the fields it tells, or null for one that is only asked; and `on`, whether it is told from the moment
// the seat opens.
export const OUTPUTS = Object.freeze({
    desktop: Object.freeze({ query: READING, told: null, on: false }),
    window: Object.freeze({ query: READING, told: null, on: false }),
    node: Object.freeze({ query: READING, told: null, on: false }),
    // What changed since a mark; told, the desktop changed: the mark it is at now.
    changes: Object.freeze({
        query: Object.freeze({ since: 'integer?' }),
        told: Object.freeze({ mark: 'integer' }),
        on: false,
    }),
    // A picture of the desktop, or of the window, the node or the rect named.
    picture: Object.freeze({
        query: Object.freeze({ window: 'string?', ref: 'string?', rect: 'object?', scale: 'number?' }),
        told: null,
        on: false,
    }),
    // The seat's key window, by its id, was taken by another seat, `holder`.
    held: Object.freeze({ query: null, told: Object.freeze({ window: 'integer', holder: 'string?' }), on: true }),
});

// Every field any row of `rows` has under `part`, each optional: what a channel that carries any of them may carry.
function anyOf(rows, part) {
    const fields = Object.values(rows).flatMap((row) => Object.keys(row[part] ?? {}));
    return Object.fromEntries(fields.map((field) => [field, 'any?']));
}

// What a seat's devices did: `event` names the row of EVENTS, `type` one of its types.
export const input = CHANNEL.pageToMain(
    'deckit-shell:seat-input',
    { event: 'string', type: 'string', ...anyOf(EVENTS, 'fields') },
    SEAT
);
// An output asked once: `of` names the row of OUTPUTS.
export const read = CHANNEL.pageToMain('deckit-shell:seat-read', { of: 'string', ...anyOf(OUTPUTS, 'query') }, SEAT);
// Whether the seat is told of the output `of`.
export const watch = CHANNEL.pageToMain('deckit-shell:seat-watch', { of: 'string', on: 'boolean' }, SEAT);
// An output told a seat that watches it: `{ of, ... }` with what its row tells.
export const output = CHANNEL.mainToPage('deckit-shell:seat-output');
