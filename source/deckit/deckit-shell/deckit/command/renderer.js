import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as CANDIDATE from './model/candidate.js';
import * as RESULT from './model/result.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createCommand() {
    // MARK: - Property
    const own = new Map(); // name -> { run, complete }, of the commands the mod declared
    const completing = new Map(); // call -> the AbortController of a completion asked of this page
    const listeners = new Set();
    let calls = 0;

    // MARK: - Initializer
    // MARK: - Public
    // A mod's commands, { name: { description, params, run(args), complete(param, partial, { args, signal }) } }, as
    // its run contributes them: the core judges each declaration. One with no function to run is told to `invalid` and
    // left out. What `run` answers is its result, and a throw is why it did not run, both the caller's to read.
    function declare(commands, { invalid }) {
        const declared = [];
        for (const [name, entry] of Object.entries(commands || {})) {
            if (typeof entry?.run !== 'function') {
                invalid(`command "${name}" cannot be used: it needs a function in "run"`);
                continue;
            }
            own.set(name, { run: entry.run, complete: typeof entry.complete === 'function' ? entry.complete : null });
            declared.push({
                name,
                ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
                ...(entry.params !== undefined ? { params: entry.params } : {}),
            });
        }
        answer();
        return declared;
    }

    // What every mod and host declared, for a mod with deckit.command-registry: `list()`, `run(command, args)` with
    // `command` `{ provider, command }`, which answers the command's result or null,
    // `complete(command, param, partial, { args, signal })` and `onChange(listener)`.
    const registry = Object.freeze({
        list: () => PROTOCOL.list.invoke({}),
        run: ({ provider, command }, args) =>
            PROTOCOL.runOf.invoke({ provider: String(provider), command: String(command), ...argsOf(args) }),
        complete({ provider, command }, param, partial, { args, signal } = {}) {
            const call = ++calls;
            const asked = PROTOCOL.completeOf.invoke({
                call,
                provider: String(provider),
                command: String(command),
                param: String(param),
                partial: String(partial ?? ''),
                ...argsOf(args),
            });
            const cancel = () => PROTOCOL.cancel.send({ call });
            signal?.addEventListener('abort', cancel, { once: true });
            return asked.finally(() => signal?.removeEventListener('abort', cancel));
        },
        onChange(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
    });

    // MARK: - Private
    function answer() {
        PROTOCOL.run.handle(async ({ command, args }) => {
            const run = own.get(command)?.run;
            if (!run) throw new Error(`no command ${command} runs here`);
            return RESULT.resultOf(await run(args ?? {}));
        });
        // A completion aborted answers null, so its answer never stands for a newer one.
        PROTOCOL.complete.handle(async ({ call, command, param, partial, args }) => {
            const complete = own.get(command)?.complete;
            if (!complete) return [];
            const asked = new AbortController();
            completing.set(call, asked);
            try {
                const found = await complete(param, partial, { args: args ?? {}, signal: asked.signal });
                return asked.signal.aborted ? null : CANDIDATE.candidatesOf(found);
            } finally {
                completing.delete(call);
            }
        });
        PROTOCOL.abort.on(({ call }) => completing.get(call)?.abort());
        PROTOCOL.changed.on(() => {
            for (const listener of listeners) listener();
        });
    }

    function argsOf(args) {
        return args && typeof args === 'object' ? { args } : {};
    }

    return { declare, registry };
}
