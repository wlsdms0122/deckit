import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as ORIGIN from '../runner/model/origin.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Connections between mods, as the core judges them: the core says which stand and whether a message on one goes, and
// what crosses goes from page to page through here, never read. A connection is handed to its dependent while it
// stands, and so is one its dependency refused, with why: one that ended while its exports were asked for is left out.
// The dependency is handed the dependent's id and name; the dependent, the name alone. A run that listens for a name
// whose mod, by id, or owner, by interface, is not running launches it for the connection, as the run's mod.
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
            return opened.filter((one) => one && (one.problem || standing.has(one.id)));
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
            if (page && opened && (opened.problem || standing.has(connection.id)))
                PROTOCOL.connected.send(page, { ...opened, lifecycle: connection.dependent.lifecycle });
        });
        for (const name of ['didLaunch', 'didJoin']) RUNNER.observe(name, activate);
        RUNNER.handleEffect('disconnect', ({ connection }) => {
            standing.delete(connection.id);
            for (const end of [connection.dependent, connection.dependency]) {
                const page = IDENTITY.pageOf(end.mod);
                if (page) PROTOCOL.disconnected.send(page, { id: connection.id });
            }
        });
    }

    // MARK: - Private
    // The exports the connection reaches, as its dependency's page answers them for it, or why it refused them: the
    // core keeps it down from then on. One whose dependency's lifecycle ended while they were asked for was not
    // refused, and is null. What the dependent is handed names the mod id or the interface, never the mod that owns an
    // interface.
    async function open(connection) {
        const { id, dependent, dependency, required } = connection;
        const named = { id, name: connection.name, required, exportedIn: dependency.lifecycle };
        const mod = CATALOG.mods().find((one) => one.id === dependent.mod);
        try {
            const page = IDENTITY.pageOf(dependency.mod);
            if (!page) return null;
            const exports = await PROTOCOL.connect.invoke(page, {
                id,
                name: connection.name,
                mod: { id: dependent.mod, name: mod?.name ?? dependent.mod },
                lifecycle: dependency.lifecycle,
            });
            return exports && { ...named, exports };
        } catch (error) {
            if (!standing.delete(id)) return null;
            CORE.request('connection/refuse', { connection: id }).catch(() => {});
            return { ...named, problem: `${connection.name} did not connect: ${error.message || error}` };
        }
    }

    // Each mod the run reaches by a name it listens for that is not running launches for the connection. The core
    // connects them once both run; one that does not launch is logged with why.
    function activate(run) {
        for (const name of Object.keys(run.contributions?.awaits ?? {})) {
            const id = providerOf(name, run.mod);
            if (!id || RUNNER.runOf(id)?.state === 'running') continue;
            RUNNER.activate(id, ORIGIN.work({ connection: name }, run.mod.id)).catch((error) =>
                LOG.warn(`${run.mod.id}: ${name} did not connect`, error)
            );
        }
    }

    // The id of the mod `mod` reaches by `name`: the mod a mod id names, or the owner of an interface but for `mod`
    // itself, as the catalog was last read.
    function providerOf(name, mod) {
        if (Object.hasOwn(mod.manifest.dependencies, name)) return name;
        const owner = Object.hasOwn(mod.manifest.uses, name) ? CATALOG.owners().get(name) : null;
        return owner && owner !== mod.id ? owner : null;
    }

    // The end of the connection other than the page's run, which the core says the message goes to.
    function route(sender, run, connection) {
        return CORE.request('connection/route', { mod: IDENTITY.modFrom(sender).id, run, connection });
    }

    return { start };
}
