import * as CHANNEL from '../../deckit/channel/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import * as DECLARED from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The seats in a mod's page, its channels bound with `channels`: `mod` is the mod's id, `granted` the permissions it
// holds, and `deliver(name, run)` runs what the mod gave, as the handle tells a mod.
function createSeats({ mod, granted, channels, deliver }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const listeners = new Set(); // what hears a change
    let watched = false; // whether main was asked to tell each change

    // MARK: - Initializer
    PROTOCOL.changed.handle(() => {
        for (const listener of [...listeners]) deliver('seats.onChange()', listener);
    });

    // MARK: - Public
    // `shell.seats` for the lifecycle whose scope is `scope`, `request` making each of its requests as the handle guards
    // them, every member guarded by deckit.seats: `list()` resolves to who sits, `[{ id, name, colour, idle, following
    // }]` in the order they sat (protocol.js: read); `follow(seat)` has the host window show the view of the seat of
    // that id, or its own seat's again with null, and resolves to whether it shows that seat's now;
    // `onChange(listener)` hears each change of who sits, with nothing said of it, and answers its off, cut with
    // `scope`. It throws its refusal: NOT_PERMITTED, then INVALID_ARGUMENT for a listener
    // that is no function, then ENDED once `scope` is cut. No member says which seat a press came from.
    function forScope(scope, { request }) {
        const guard = PROTOCOL.read.guard;
        return Object.freeze({
            list: request('seats.list', { guard }, () => PROTOCOL.read.invoke().then(({ seats }) => seats)),
            follow: request('seats.follow', { guard, signature: [['seat', 'string?']] }, (seat) =>
                PROTOCOL.follow.invoke({ seat: seat ?? null })
            ),
            onChange: (listener) => heard(listener, scope),
        });
    }

    // MARK: - Private
    function heard(listener, scope) {
        const denied = REQUEST.deniedOf({ mod, granted, guard: PROTOCOL.watch.guard }, {});
        if (denied) throw REQUEST.refusal('call', 'NOT_PERMITTED', denied);
        if (typeof listener !== 'function')
            throw REQUEST.refusal('call', 'INVALID_ARGUMENT', 'seats.onChange: listener is no function');
        if (scope.isCut)
            throw REQUEST.refusal('call', 'ENDED', 'seats.onChange: the lifecycle it was made for has ended');
        listeners.add(listener);
        if (!watched) {
            watched = true;
            PROTOCOL.watch.invoke().catch((error) => console.warn('[deckit] the seats are not told', error));
        }
        return scope.add(() => listeners.delete(listener));
    }

    return { forScope };
}

export { createSeats };
