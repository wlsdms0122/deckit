import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Events, as the core routes them: the core names an event after the mod that sent it and says which mods hear it, and
// what it carries goes from page to page through here.
export function createEvent({ CORE, LOG, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Mods say what happened to them through deck, never to each other, so none speaks for another. An event goes to
    // the runs that listen to it, and only from a run that is running.
    function start() {
        PROTOCOL.listen.on(({ run, names }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            CORE.request('event/listen', { mod: id, run, names }).catch((error) =>
                LOG.error(`${id}: the events it listens to were not taken`, error)
            );
        });
        PROTOCOL.emit.on(async ({ run, name, args }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            let delivery;
            try {
                delivery = await CORE.request('event/emit', { mod: id, run, name });
            } catch (error) {
                LOG.error(`${id}: its event ${name} was not sent`, error);
                return;
            }
            for (const listener of delivery.listeners) {
                const page = IDENTITY.pageOf(listener);
                if (page) PROTOCOL.event.send(page, { name: delivery.name, args });
            }
        });
    }

    // MARK: - Private

    return { start };
}
