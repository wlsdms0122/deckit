import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as CANDIDATE from './model/candidate.js';
import * as RESULT from './model/result.js';
import * as COMMAND_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Commands, as the core keeps them: each running mod's and each host's, found by its provider and its name, never by
// a joined id. The core checks a command and its args before it runs; a mod's runs in its page, a host's here.
export function createCommand({ LOG, IDENTITY, RUNNER, CORE }) {
    // MARK: - Property
    // A mod that has not answered by then completes nothing, so one stuck page does not hold the caller.
    const ANSWER_MS = 2000;
    const hosts = new Map(); // a host's name, as its provider -> Map of name -> { run, complete }
    const listeners = new Set();
    const asking = new Map(); // a mod's call -> the AbortController of the completion it asked for
    let calls = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.list.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, COMMAND_PERMISSION.COMMAND_REGISTRY);
            return list();
        });
        PROTOCOL.runOf.handle(({ provider, command, args }, sender) => {
            IDENTITY.modFrom(sender, COMMAND_PERMISSION.COMMAND_REGISTRY);
            return run({ provider, command }, args);
        });
        PROTOCOL.completeOf.handle(async ({ call, provider, command, param, partial, args }, sender) => {
            const caller = IDENTITY.modFrom(sender, COMMAND_PERMISSION.COMMAND_REGISTRY);
            const asked = new AbortController();
            asking.set(`${caller.id}:${call}`, asked);
            try {
                return await complete({ provider, command }, param, partial, { args, signal: asked.signal });
            } finally {
                asking.delete(`${caller.id}:${call}`);
            }
        });
        PROTOCOL.cancel.on(({ call }, sender) => {
            const caller = IDENTITY.modOf(sender);
            if (caller) asking.get(`${caller.id}:${call}`)?.abort();
        });
        PROTOCOL.mint.handle(({ command, args }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            return CORE.request('command/mint', { mod: id, command, ...(args ? { args } : {}) });
        });
        PROTOCOL.runToken.handle(({ token }, sender) => {
            IDENTITY.modFrom(sender);
            return runToken(token);
        });
        PROTOCOL.cancelToken.handle(({ token }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            return CORE.request('command/cancel', { mod: id, token });
        });
        PROTOCOL.releaseToken.handle(({ token }, sender) => {
            IDENTITY.modFrom(sender);
            return CORE.request('command/release', { token });
        });
        for (const name of ['didLaunch', 'didJoin', 'didTerminate']) RUNNER.observe(name, changed);
    }

    // A host's commands, under `host`, `{ id, name }`: `id` a name of its own that starts with "@", and `name` as a
    // person reads it. Commands are { name: { description, params, run(args), complete(param, partial, { args,
    // signal }) } }. Resolves once the core has them, and rejects with why it refused one.
    async function register(host, commands) {
        const provider = host.id;
        const declared = [];
        const kept = new Map();
        for (const [name, entry] of Object.entries(commands || {})) {
            if (typeof entry?.run !== 'function') throw new Error(`[deckit] command ${provider}.${name} needs a run`);
            kept.set(name, { run: entry.run, complete: typeof entry.complete === 'function' ? entry.complete : null });
            const { run: _run, complete: _complete, ...data } = entry;
            declared.push({ ...data, name });
        }
        // Kept before the core has them, so a command the core lists already runs here.
        const before = hosts.get(provider);
        hosts.set(provider, new Map([...(before || []), ...kept]));
        try {
            await CORE.request('command/define', { provider, name: host.name, commands: declared });
        } catch (error) {
            if (before) hosts.set(provider, before);
            else hosts.delete(provider);
            throw error;
        }
        changed();
    }

    // Every command, `{ provider, command, description, params }`: the hosts' first, then each running mod's in the
    // mods' order.
    function list() {
        return CORE.request('command/list');
    }

    // `{ provider, command }` run with `args`, which answers its result, a JSON value or null, and rejects with why it
    // did not run.
    async function run({ provider, command }, args = null) {
        await CORE.request('command/check', { provider, command, ...(args ? { args } : {}) });
        return dispatch({ provider, command }, args);
    }

    // The command a token holds run with the args it was minted with, as `run` answers; one that has ended rejects.
    async function runToken(token) {
        const { sender, command, args } = await CORE.request('command/check-token', { token });
        return dispatch({ provider: sender, command }, args ?? null);
    }

    // The candidates for `param` of `{ provider, command }` as `partial` is typed, `[{ value, title, hint, keywords }]`
    // ranked by the provider. The caller aborts `signal` when it no longer wants the answer: the provider's signal is
    // aborted with it, and the completion answers null.
    async function complete({ provider, command }, param, partial = '', { args = null, signal = null } = {}) {
        await CORE.request('command/find', { provider, command });
        const asked = signal || new AbortController().signal;
        if (hosts.has(provider)) {
            const answer = hosts.get(provider).get(command).complete;
            if (!answer) return [];
            const candidates = await answer(param, partial, { args: args ?? {}, signal: asked });
            return asked.aborted ? null : CANDIDATE.candidatesOf(candidates);
        }
        const page = IDENTITY.pageOf(provider);
        if (!page) return [];
        const call = ++calls;
        const stop = () => PROTOCOL.abort.send(page, { call });
        asked.addEventListener('abort', stop, { once: true });
        try {
            const candidates = await PROTOCOL.complete.invoke(
                page,
                { call, command, param, partial, args },
                { timeout: ANSWER_MS }
            );
            return asked.aborted ? null : candidates;
        } catch (error) {
            LOG.warn(`${provider}: completing ${command} failed`, error);
            return [];
        } finally {
            asked.removeEventListener('abort', stop);
        }
    }

    // Told each time the commands may have changed. Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // MARK: - Private
    // A command the core checked runs where its provider is: a host's here, a mod's in its page, once the mod runs and
    // its start has attached its handlers: one not running is launched first, and one that does not launch is refused
    // with why, `kind` NOT_RUNNING.
    async function dispatch({ provider, command }, args) {
        if (hosts.has(provider))
            return RESULT.resultOf(
                await hosts
                    .get(provider)
                    .get(command)
                    .run(args ?? {})
            );
        if (RUNNER.runOf(provider)?.state !== 'running') await RUNNER.launch(provider);
        const run = RUNNER.runOf(provider);
        if (run?.state !== 'running')
            throw Object.assign(new Error(`${provider} is not running: ${run?.problem || 'it did not launch'}`), {
                kind: 'NOT_RUNNING',
            });
        return PROTOCOL.run.invoke(IDENTITY.pageOf(provider), { command, args });
    }

    // The host's listeners, and each running mod's page that may list commands.
    function changed() {
        for (const listener of listeners) listener();
        for (const { run, page } of RUNNER.runs()) {
            const may = run?.mod.permissions.some(({ id }) => id === COMMAND_PERMISSION.COMMAND_REGISTRY);
            if (page && may) PROTOCOL.changed.send(page, {});
        }
    }

    return { start, register, list, run, runToken, complete, onChange };
}
