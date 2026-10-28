import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Connections between mods, as the core judges them: the core says which stand and whether a message on one goes, and
// what crosses goes from page to page through here, never read. A connection is handed to its dependent only while it
// stands: one that ended while its exports were asked for is left out.
export function createConnection({ CORE, LOG, IDENTITY, CATALOG, RUNNER }) {
    // MARK: - Property
    const standing = new Set(); // the ids of the connections that stand, as the core told them

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.begin.handle(async ({ run, lifecycle }, sender) => {
            const mod = IDENTITY.modFrom(sender).id;
            const connections = await CORE.request('connection/begin', { mod, run, lifecycle });
            for (const connection of connections) standing.add(connection.id);
            const opened = await Promise.all(connections.map(open));
            return opened.filter(({ id }) => standing.has(id));
        });
        PROTOCOL.end.on(({ run, lifecycle }, sender) => {
            const mod = IDENTITY.modFrom(sender).id;
            RUNNER.ask('connection/end', { mod, run, lifecycle }).catch((error) =>
                LOG.error('the core did not take connection/end', error)
            );
        });
        PROTOCOL.call.handle(async ({ run, connection, number, args }, sender) => {
            const other = await route(sender, run, connection);
            return PROTOCOL.called.invoke(IDENTITY.pageOf(other.mod), { connection, number, args });
        });
        PROTOCOL.release.on(async ({ run, connection, number, count }, sender) => {
            const other = await route(sender, run, connection).catch(() => null);
            const page = other && IDENTITY.pageOf(other.mod);
            if (page) PROTOCOL.released.send(page, { connection, number, count });
        });
        RUNNER.handleEffect('connect', async ({ connection }) => {
            standing.add(connection.id);
            const opened = await open(connection);
            const page = IDENTITY.pageOf(connection.dependent.mod);
            if (standing.has(connection.id) && page)
                PROTOCOL.connected.send(page, { ...opened, lifecycle: connection.dependent.lifecycle });
        });
        RUNNER.handleEffect('disconnect', ({ connection }) => {
            standing.delete(connection.id);
            for (const end of [connection.dependent, connection.dependency]) {
                const page = IDENTITY.pageOf(end.mod);
                if (page) PROTOCOL.disconnected.send(page, { id: connection.id });
            }
        });
    }

    // MARK: - Private
    // The exports the connection reaches, as its dependency's page answers them for it, or why it did not: the core
    // keeps it down from then on.
    async function open(connection) {
        const { id, dependent, dependency, required } = connection;
        const named = { id, mod: dependency.mod, required, exportedIn: dependency.lifecycle };
        const mod = CATALOG.mods().find((one) => one.id === dependent.mod);
        try {
            const page = IDENTITY.pageOf(dependency.mod);
            if (!page) throw new Error(`${dependency.mod} is not running`);
            const exports = await PROTOCOL.connect.invoke(page, {
                id,
                mod: { id: dependent.mod, name: mod?.name ?? dependent.mod },
                lifecycle: dependency.lifecycle,
            });
            return { ...named, exports };
        } catch (error) {
            standing.delete(id);
            CORE.request('connection/refuse', { connection: id }).catch(() => {});
            return { ...named, problem: `${dependency.mod} did not connect: ${error.message || error}` };
        }
    }

    // The end of the connection other than the page's run, which the core says the message goes to.
    function route(sender, run, connection) {
        return CORE.request('connection/route', { mod: IDENTITY.modFrom(sender).id, run, connection });
    }

    return { start };
}
