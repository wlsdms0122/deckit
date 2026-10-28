// The runs mods dispatch through Forge, each the dispatching mod's, and the `onRun` each connection handed over for
// one: told each change of that run until it ends, then dropped. `forge` is the main process module, which records a
// dispatch by the mod named and sends each change of a run as its event `run`. A change heard before its dispatch has
// answered is kept until it has, for the last hundred runs heard so. Ended runs are answered by id until a hundred more
// have ended, as the main process keeps them.
function runs(forge) {
    const KEPT = 100;
    const owners = new Map(); // workflow id -> the id of the mod that dispatched it
    const ended = []; // the workflow ids of the runs that ended, the oldest first
    const listeners = new Map(); // workflow id -> connection -> its onRun
    const early = new Map(); // workflow id -> its last change, heard before its dispatch answered

    forge.on('run', (run) => {
        if (owners.has(run.id)) return heard(run);
        early.set(run.id, run);
        if (early.size > KEPT) early.delete(early.keys().next().value);
    });

    return { dispatch, runSchedule, run, forget };

    async function dispatch(connection, session, name, inputs, onRun) {
        const accepted = await forge.call(session, 'workflow.dispatch', { name, inputs }, connection.mod.id);
        claim(connection, accepted.workflow_id, onRun);
        return accepted;
    }

    async function runSchedule(connection, session, id, onRun) {
        const accepted = await forge.runSchedule(session, id, connection.mod.id);
        claim(connection, accepted.workflow_id, onRun);
        return accepted;
    }

    // Only a run the connection's mod dispatched, or null. `onRun` is told its changes from here.
    async function run(connection, id, onRun) {
        if (owners.get(id) !== connection.mod.id) return null;
        if (onRun) listen(connection, id, onRun);
        const found = await forge.run(id);
        if (found?.status !== 'running') drop(connection, id);
        return found;
    }

    // The connection has ended: what it handed over goes.
    function forget(connection) {
        for (const id of [...listeners.keys()]) drop(connection, id);
    }

    function claim(connection, id, onRun) {
        owners.set(id, connection.mod.id);
        if (onRun) listen(connection, id, onRun);
        const change = early.get(id);
        early.delete(id);
        if (change) heard(change);
    }

    // A change of a run a mod dispatched: told, and an ended run kept among the last hundred.
    function heard(run) {
        tell(run);
        if (run.status === 'running') return;
        ended.push(run.id);
        while (ended.length > KEPT) owners.delete(ended.shift());
    }

    function listen(connection, id, onRun) {
        if (!listeners.has(id)) listeners.set(id, new Map());
        listeners.get(id).set(connection, onRun);
    }

    function drop(connection, id) {
        const told = listeners.get(id);
        told?.delete(connection);
        if (told?.size === 0) listeners.delete(id);
    }

    // A run that has ended is told for the last time.
    function tell(run) {
        const told = listeners.get(run.id);
        if (!told) return;
        if (run.status !== 'running') listeners.delete(run.id);
        for (const onRun of told.values()) onRun(run).catch(() => {});
    }
}

module.exports = { runs };
