// What the shell names to deckit as it serves the seats, as plain data: the kinds of device it takes, the outputs it
// reads and the outputs it tells.

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

// The kinds of device, each with the `types` of its events and the `fields` beside `event` and `type`. A pointer's
// place is the desktop point `x`, `y`, or `ref`, what a reading named. No row has `source`, `carried` or `page`, which
// no party sends.
const EVENTS = Object.freeze({
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
    // The size of the seat's screen, its kind a string: `check` holds the bare word to the shell's main bundle.
    ['screen']: Object.freeze({
        types: Object.freeze(['resize']),
        fields: Object.freeze({ width: 'integer', height: 'integer' }),
    }),
});

// The outputs read, each with the fields it is asked with beside `of`.
const READS = Object.freeze({
    desktop: READING,
    window: READING,
    node: READING,
    // What changed since a mark.
    changes: Object.freeze({ since: 'integer?' }),
    // A picture of the desktop, or of the window, the node or the rect named.
    picture: Object.freeze({ window: 'string?', ref: 'string?', rect: 'object?', scale: 'number?' }),
});

// The outputs told, each with the `fields` it tells beside `of` and `on`, whether a seat is told it from the moment it
// opens.
const TELLS = Object.freeze({
    // The desktop changed: the mark it is at now.
    changes: Object.freeze({ fields: Object.freeze({ mark: 'integer' }), on: false }),
    // The seat's key window, by its id, was taken by another seat, `holder`.
    held: Object.freeze({ fields: Object.freeze({ window: 'integer', holder: 'string?' }), on: true }),
});

export { EVENTS, READS, TELLS };
