// Between a mod's page and main, about the connections between a lifecycle of a mod and the exports of a mod it
// depends on. What crosses a connection is described as wire.js writes it: `{ value, references }`.
import * as CHANNEL from '../channel/index.js';

// A lifecycle of the page's run begins: answered with the connections it has from now on, each `{ id, mod, required,
// exportedIn, exports }`, `exportedIn` the lifecycle of `mod` that opened the exports, or with `problem` in place of
// `exports` for one `mod` refused.
export const begin = CHANNEL.pageToMain(
    'deckit-shell:connection-begin',
    { run: 'number', lifecycle: 'number' },
    {
        reply: true,
    }
);
// A lifecycle of the page's run has ended, its end method run and what its handles made cut.
export const end = CHANNEL.pageToMain('deckit-shell:connection-end', { run: 'number', lifecycle: 'number' });
// A function the other end handed over is called: answered with `{ returned }` or `{ thrown: { name, message } }`.
export const call = CHANNEL.pageToMain(
    'deckit-shell:connection-call',
    { run: 'number', connection: 'number', number: 'number', args: 'object' },
    { reply: true }
);
// A function the other end handed over is held no more: `count` is how many times it was handed over, so one handed
// again meanwhile stays.
export const release = CHANNEL.pageToMain('deckit-shell:connection-release', {
    run: 'number',
    connection: 'number',
    number: 'number',
    count: 'number',
});

// The exports the page's run opened are asked for a connection: `{ id, mod: { id, name }, lifecycle }`, answered with
// them.
export const connect = CHANNEL.mainToPage('deckit-shell:connection-connect', { reply: true });
// A connection stands since the page's `lifecycle` began: `{ id, mod, required, exportedIn, exports, lifecycle }`, as
// `begin` answers one.
export const connected = CHANNEL.mainToPage('deckit-shell:connection-connected');
// A connection has ended: `{ id }`.
export const disconnected = CHANNEL.mainToPage('deckit-shell:connection-disconnected');
// A function the page handed over on a connection is called: `{ connection, number, args }`, answered as `call` is.
export const called = CHANNEL.mainToPage('deckit-shell:connection-called', { reply: true });
// A function the page handed over on a connection is held no more: `{ connection, number, count }`, as `release`.
export const released = CHANNEL.mainToPage('deckit-shell:connection-released');
