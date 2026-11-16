import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Its channels as a run a transport connection hosts speaks them (outside/): `asked`, method -> the channel and whether
// its payload carries the run's number, and `told`, channel -> method.
export const OUTSIDE = Object.freeze({
    asked: {
        'event/listen': { channel: DECLARED.listen, run: true },
        'event/emit': { channel: DECLARED.emit, run: true },
    },
    told: {
        [DECLARED.event.channel]: 'event/deliver',
    },
});

// Events, as the core routes them: the core names an event after the mod that sent it and says which mods hear it, and
// what it carries goes from page to page through here. The core's own events come as an effect it answers, `deliver`,
// and carry nothing.
export function createEvent({ CORE, LOG, IDENTITY, RUNNER }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Mods say what happened to them through deckit, never to each other, so none speaks for another. An event goes to
    // the runs that listen to it, and only from a run that is launching or running; one the core refuses is refused
    // to the page that sent it.
    function start() {
        PROTOCOL.listen.on(({ run, names }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            CORE.request('event/listen', { mod: id, run, names }).catch((error) =>
                LOG.error(`${id}: the events it listens to were not taken`, error)
            );
        });
        PROTOCOL.emit.handle(async ({ run, name, args }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            deliver(await CORE.request('event/emit', { mod: id, run, name }), args);
            return true;
        });
        RUNNER.handleEffect('deliver', (delivery) => deliver(delivery, []));
    }

    // MARK: - Private
    // The event `name` goes with `args` to the page of each run in `listeners` that has one.
    function deliver({ name, listeners }, args) {
        for (const listener of listeners) {
            const page = IDENTITY.pageOf(listener);
            if (page) PROTOCOL.event.send(page, { name, args });
        }
    }

    return { start };
}
