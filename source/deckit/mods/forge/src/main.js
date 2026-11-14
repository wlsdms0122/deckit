const { matchFields } = require('deckit-sdk/match');
const { runs } = require('./runs/runs.js');

// The settings that say where forge is, handed to the main process together.
const PLACES = ['forge', 'forgeConfig'];

// The forge daemons, for the mods that use `forge/sessions`: it starts, stops and restarts them, holds the token each
// hands the process that starts it, and runs forge's operations on them. Starting, stopping and restarting a daemon
// are commands too, run from the exports for its id. It has no view.
class Forge {
    async start(deckit, { mainProcess }) {
        const forge = await mainProcess.start('main-process/forge.js');

        // Where forge is, as `deckit/configuration` says: read once it is connected, and again as one changes.
        deckit.dependencies.onConnect('deckit/configuration', async (configuration) => {
            let places = null;
            await configuration.onChange((key, value) => {
                if (!places || !PLACES.includes(key)) return;
                places = { ...places, [key]: value };
                return forge.use(places);
            });
            places = await configuration.values();
            await forge.use(places);
        });

        // A session not given is `default`. A run is the dispatching mod's (runs.js).
        const dispatched = runs(forge);
        deckit.exports.register('forge/sessions', {
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

        // The commands its manifest declares to `deckit/commands`, each answering nothing. The one arg each takes is a
        // session, completed from the sessions there are.
        const commands = {
            start: async ({ session }) => {
                await forge.start(session);
            },
            stop: async ({ session }) => {
                await forge.stop(session);
            },
            restart: async ({ session }) => {
                await forge.restart(session);
            },
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Forge has no command ${id}`);
                    return commands[id](args ?? {});
                },
                completeCommand: (_id, _param, partial) => sessionsFor(partial),
            }),
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
                    found: matchFields([{ text: candidate.title, name: true }], partial),
                }))
                .filter(({ found }) => found)
                .sort((left, right) => right.found.tier - left.found.tier || right.found.score - left.found.score)
                .map(({ candidate }) => candidate);
        }
    }
}

module.exports = Forge;
