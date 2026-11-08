// Between a mod's page and main, about the connections between a lifecycle of a mod, the client, and the exports opened
// for it by its service, a mod it reaches by id or the owner of an interface it uses. What crosses a connection is
// described as wire.js writes it: `{ value, references }`. The client's end is told the name, the mod id or the
// interface, and never the mod that owns an interface.
import * as CHANNEL from '../channel/index.js';

// A lifecycle of the page's run begins: answered with the connections it has from now on to the interfaces it uses,
// each `{ id, name, exports }`, or with `refusal`, `{ stage, kind, message }`, in place of `exports` for one the
// service refused.
export const begin = CHANNEL.pageToMain(
    'deckit-shell:connection-begin',
    { run: 'number', lifecycle: 'number' },
    {
        reply: true,
    }
);
// A lifecycle of the page's run has ended, its end method run and what its handles made cut.
export const end = CHANNEL.pageToMain('deckit-shell:connection-end', { run: 'number', lifecycle: 'number' });
// A lifecycle of the page's run asks to reach the mod `target` by its id, until it lets it go or ends: answered once
// the core took the ask, which launches the mod if it does not run, and the connection told with `connected` once it
// stands, or `unreached` where the mod does not launch or runs with no exports for it. Refused with why:
// `NOT_PERMITTED` for an id the mod may not reach, `INVALID_ARGUMENT` for its own, `ENDED` for a lifecycle not begun
// or ended.
export const reach = CHANNEL.pageToMain(
    'deckit-shell:connection-reach',
    { run: 'number', lifecycle: 'number', target: 'string' },
    { reply: true }
);
// The lifecycle lets the mod `target` go: its connection by the id ends, told with `disconnected`.
export const releaseReach = CHANNEL.pageToMain(
    'deckit-shell:connection-release-reach',
    { run: 'number', lifecycle: 'number', target: 'string' },
    { reply: true }
);
// A function the other end handed over is called: answered with `{ returned }`, or `{ thrown: { name, message, kind }
// }` for what it threw, `kind` REFUSED where it threw none or one that is not a kind.
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

// The exports the page's run opened for an interface are asked for a connection: `{ id, name, mod: { name },
// lifecycle, credential: { mod, permissions } }`, `mod` the client's name and `credential` the client's as the core
// holds it, its id and permissions, answered with them, or null once that lifecycle has ended.
export const connect = CHANNEL.mainToPage('deckit-shell:connection-connect', { reply: true });
// A connection of the page's `lifecycle` stands, to an interface it uses or a mod it reached by id: `{ id, name,
// exports, lifecycle }`, as `begin` answers one.
export const connected = CHANNEL.mainToPage('deckit-shell:connection-connected');
// A lifecycle of the page's is refused what it reaches by `name`, a mod id or an interface: a mod the core does not
// launch for it, or one that runs with no exports for it. `{ lifecycle, name, refusal }`, `refusal` `{ stage, kind,
// message }`, what that mod is refused with at launch, or NOT_EXPORTED at call.
export const unreached = CHANNEL.mainToPage('deckit-shell:connection-unreached');
// A connection has ended: `{ id }`.
export const disconnected = CHANNEL.mainToPage('deckit-shell:connection-disconnected');
// A function the page handed over on a connection is called: `{ connection, number, args }`, answered as `call` is.
export const called = CHANNEL.mainToPage('deckit-shell:connection-called', { reply: true });
// A function the page handed over on a connection is held no more: `{ connection, number, count }`, as `release`.
export const released = CHANNEL.mainToPage('deckit-shell:connection-released');
