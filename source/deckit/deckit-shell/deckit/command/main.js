import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
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
        for (const name of ['didLaunch', 'didJoin', 'didTerminate']) RUNNER.observe(name, changed);
    }

    // A host's commands, under `provider`, a name of its own that starts with "@": { name: { description, params,
    // run(args), complete(param, partial, { args, signal }) } }. Resolves once the core has them, and rejects with why
    // it refused one.
    async function define(provider, commands) {
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
            await CORE.request('command/define', { provider, commands: declared });
        } catch (error) {
            if (before) hosts.set(provider, before);
            else hosts.delete(provider);
            throw error;
        }
        changed();
    }

    // Every command, `{ provider, command, description, params }`: the hosts' first, then each running mod's in the
    // load order.
    function list() {
        return CORE.request('command/list');
    }

    // `{ provider, command }` run with `args`, which answers its result, a JSON value or null, and rejects with why it
    // did not run.
    async function run({ provider, command }, args = null) {
        await CORE.request('command/check', { provider, command, ...(args ? { args } : {}) });
        if (hosts.has(provider))
            return RESULT.resultOf(
                await hosts
                    .get(provider)
                    .get(command)
                    .run(args ?? {})
            );
        const page = IDENTITY.pageOf(provider);
        if (!page) throw Object.assign(new Error(`${provider} is not running`), { kind: 'NOT_RUNNING' });
        return PROTOCOL.run.invoke(page, { command, args });
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
    // The host's listeners, and each running mod's page that may list commands.
    function changed() {
        for (const listener of listeners) listener();
        for (const { run, page } of RUNNER.runs()) {
            const may = run?.mod.permissions.some(({ id }) => id === COMMAND_PERMISSION.COMMAND_REGISTRY);
            if (page && may) PROTOCOL.changed.send(page, {});
        }
    }

    return { start, define, list, run, complete, onChange };
}
