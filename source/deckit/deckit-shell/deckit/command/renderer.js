import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as CANDIDATE from './model/candidate.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createCommand() {
    // MARK: - Property
    const own = new Map(); // name -> { run, complete }, of the commands the mod declared
    const completing = new Map(); // call -> the AbortController of a completion asked of this page
    const listeners = new Set();
    let calls = 0;

    // MARK: - Initializer
    // MARK: - Public
    // A mod's commands, { name: { label, description, keywords, params, run(args, { activates }),
    // complete(param, partial, { args, signal }) } }, as its run contributes them: the core judges each declaration.
    // One with no function to run is told to `invalid` and left out. A throw is why it did not run, the caller's to
    // read; a key has no one to tell, so a key's is only logged.
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
                label: entry.label,
                ...(typeof entry.description === 'string' ? { description: entry.description } : {}),
                ...(Array.isArray(entry.keywords) ? { keywords: strings(entry.keywords) } : {}),
                ...(entry.params !== undefined ? { params: entry.params } : {}),
            });
        }
        answer();
        return declared;
    }

    // One of the mod's commands run as a key runs it: in front, and what it throws logged.
    async function runByKey(name, args) {
        try {
            await own.get(name)?.run(args ?? {}, { activates: true });
        } catch (error) {
            console.warn(`[deckit] a key ran ${name}, which did not run`, error);
        }
    }

    // What every mod and host declared, for a mod with deckit.command-registry: `list()`, `provider(id)`,
    // `run(command, args, { activates })` with `command` `{ provider, command }`, which answers the text the command
    // leaves for a person or null, `complete(command, param, partial, { args, signal })` and `onChange(listener)`.
    const registry = Object.freeze({
        list: () => PROTOCOL.list.invoke({}),
        provider: (id) => PROTOCOL.providerOf.invoke({ id: String(id) }),
        run: ({ provider, command }, args, { activates = false } = {}) =>
            PROTOCOL.runOf.invoke({ provider: String(provider), command: String(command), ...argsOf(args), activates }),
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
        PROTOCOL.run.handle(async ({ command, args, activates }) => {
            const run = own.get(command)?.run;
            if (!run) throw new Error(`no command ${command} runs here`);
            const left = await run(args ?? {}, { activates });
            return typeof left === 'string' && left ? left : null;
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

    function strings(list) {
        return Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
    }

    return { declare, runByKey, registry };
}
