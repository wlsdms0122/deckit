const { runs } = require('./runs/runs.js');

// The forge daemons, for the mods that depend on this one: it starts, stops and restarts them, holds the token each
// hands the process that starts it, and runs forge's operations on them. Starting, stopping and restarting a daemon
// are commands too. It has no view.
class Forge {
    async start(deckit) {
        const { util } = deckit;
        const PLACES = ['forge', 'forgeConfig'];
        const forge = await deckit.mainProcess('main-process/forge.js');
        const places = () => Object.fromEntries(PLACES.map((key) => [key, deckit.configuration.get(key)]));
        await forge.use(places());
        deckit.configuration.on((key) => {
            if (PLACES.includes(key)) forge.use(places());
        });

        // A session not given is `default`. A run is the dispatching mod's (runs.js).
        const dispatched = runs(forge);
        deckit.exports.register({
            connect: (connection) => ({
                sessions: () => forge.sessions(),
                session: (session) => forge.session(session),
                start: (session) => forge.start(session),
                stop: (session) => forge.stop(session),
                restart: (session) => forge.restart(session),
                log: (lines, { session } = {}) => forge.log(session, lines),
                call: (operation, args, { session } = {}) => {
                    if (operation === 'workflow.dispatch')
                        throw new Error('call() does not dispatch: use dispatch(name, inputs)');
                    return forge.call(session, operation, args);
                },
                dispatch: (name, inputs, { session, onRun } = {}) =>
                    dispatched.dispatch(connection, session, name, inputs, onRun),
                runSchedule: (id, { session, onRun } = {}) => dispatched.runSchedule(connection, session, id, onRun),
                run: (id, { onRun } = {}) => dispatched.run(connection, id, onRun),
            }),
            disconnect: (connection) => dispatched.forget(connection),
        });

        deckit.commands.register({
            start: {
                run: async ({ session }) => {
                    await forge.start(session);
                },
                complete: (_param, partial) => sessionsFor(partial),
            },
            stop: {
                run: async ({ session }) => {
                    await forge.stop(session);
                },
                complete: (_param, partial) => sessionsFor(partial),
            },
            restart: {
                run: async ({ session }) => {
                    await forge.restart(session);
                },
                complete: (_param, partial) => sessionsFor(partial),
            },
        });

        // The sessions there are, each with its state, ranked for `partial` by name.
        async function sessionsFor(partial) {
            const { sessions } = await forge.sessions();
            const candidates = sessions.map((entry) => ({
                value: entry.name,
                title: entry.name,
                hint: !entry.up ? 'Stopped' : entry.authority ? 'Running' : 'Started elsewhere',
            }));
            if (!partial.trim()) return candidates;
            return candidates
                .map((candidate) => ({
                    candidate,
                    found: util.matchFields([{ text: candidate.title, name: true }], partial),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }
    }
}

module.exports = Forge;
