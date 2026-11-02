import * as MATCH from '../match/match.js';
import * as RANKER from '../match/ranker.js';
import * as CLIPBOARD from '../clipboard/renderer.js';
import * as RUNTIME from '../runtime/renderer.js';
import * as OPEN from '../open/renderer.js';
import * as MAIN_PROCESS from '../main-process/renderer.js';
import * as MOD_FOLDER from '../mod-folder/renderer.js';
import * as PROVIDER from '../provider/renderer.js';
import * as CONFIGURATION from '../configuration/renderer.js';
import * as MAIN_PROCESS_PERMISSION from '../main-process/model/permission.js';
import * as CLIPBOARD_PERMISSION from '../clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../notification/model/permission.js';
import * as KEYMAP_PERMISSION from '../keymap/model/permission.js';
import * as OPEN_PERMISSION from '../open/model/permission.js';
import * as COMMAND_PERMISSION from '../command/model/permission.js';
import * as CONFIGURATION_PERMISSION from '../configuration/model/permission.js';

// What deckit puts on deck for a mod's page: the handle `deckit`, deck's members and deckit's, the lifecycle deckit
// calls, start() and stop(), and what a layer over deckit stacks a lifecycle of its own with.
export function createMod({ WEB, NOTIFICATION, KEYMAP, COMMAND, CONFIGURATION: CONFIGURED }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit as a layer on deck (deckit-shell/deck/runner/renderer.js). It reads the class's `keywords`, which whatever
    // lists the mods reads in its run's summary, and its `configuration`. `over` is what a layer over it is handed:
    // `lifecycle({ method, registrations, start, end, join })`, a lifecycle of that layer's with deckit's handle in it,
    // deckit's registrations beside its own and the handle `deckit` handed its `start` with deckit's members, and
    // `join(parts, scope)` answering `{ keyProblem }`, `keyProblem(key)` why a key would never run once it has joined,
    // or '': one registered there that would is left out, and one registered under it is withdrawn while it lasts; and
    // `blockKeysWhen(blocks)`, a key pressed in the page dropped while `blocks()`, or any other given, answers true.
    function layer({ mod, deliver, fail }) {
        NOTIFICATION.listen(deliver);
        const mainProcess = MAIN_PROCESS.createMainProcess({ deliver });
        const blocking = new Set();
        KEYMAP.hear({ blocksKeys: () => [...blocking].some((blocks) => blocks()) });
        const functionProblem = (value) => (typeof value === 'function' ? '' : 'takes a function');
        const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
        const registrations = {
            keys: { handle: 'deckit', check: table },
            commands: { handle: 'deckit', check: table },
            urls: { handle: 'deckit', check: functionProblem },
        };
        // What every lifecycle joined so far registered.
        const joined = { keys: [], commands: [], urls: null, answering: false };
        const handleOf = (deck, scope) => Object.freeze({ ...deck, ...membersOf(mod, deck, scope, { mainProcess }) });
        const join = (parts, scope, keyProblem = () => '') => {
            if (typeof parts.urls === 'function') {
                if (joined.urls) fail('deckit.urls.register() is called under it, so this one is left out');
                else {
                    if (!joined.answering) OPEN.answer((url, options) => joined.urls?.(url, options) ?? false);
                    joined.answering = true;
                    joined.urls = parts.urls;
                    scope.add(() => (joined.urls = null));
                }
            }
            const commands = COMMAND.declare(parts.commands, { invalid: fail });
            const keys = KEYMAP.declare(parts.keys, { invalid: fail, problemOf: keyProblem });
            joined.commands = [...joined.commands, ...commands.declared];
            joined.keys = [...joined.keys, ...keys.declared];
            scope.add(() => {
                commands.off();
                keys.off();
                joined.commands = joined.commands.filter((command) => !commands.declared.includes(command));
                joined.keys = joined.keys.filter((key) => !keys.declared.includes(key));
            });
            return keys.declared;
        };
        // A key registered under a lifecycle that would never run once it has joined is withdrawn while it lasts.
        const judge = (declared, scope, keyProblem) => {
            const never = joined.keys.filter((key) => !declared.includes(key) && keyProblem(key));
            if (!never.length) return;
            for (const key of never) fail(`key "${key.name}" never runs: ${keyProblem(key)}`);
            const restore = KEYMAP.withdraw(never.map(({ name }) => name));
            joined.keys = joined.keys.filter((key) => !never.includes(key));
            scope.add(() => {
                restore();
                joined.keys = [...joined.keys, ...never];
            });
        };
        return {
            handle: 'deckit',
            read(Entry) {
                CONFIGURED.declare(Entry.configuration);
                return { keywords: strings(Entry.keywords) };
            },
            report: () => ({
                // What it registered, by name, for deckit's core to judge it by.
                contributions: { keys: joined.keys, commands: joined.commands, urls: !!joined.urls },
                summary: { commands: joined.commands.length > 0, urls: joined.urls ? mod.urls : [] },
            }),
            mods: {
                pick: MOD_FOLDER.pick,
                reveal: MOD_FOLDER.reveal,
                restartPending: MAIN_PROCESS.restartPending,
                restart: RUNTIME.restart,
            },
            lifecycles: [
                {
                    method: 'start',
                    registrations,
                    async start(instance, handles, scope) {
                        await CONFIGURED.ready;
                        if (typeof instance.start !== 'function') return;
                        try {
                            await instance.start(handleOf(handles.deckit, scope));
                        } catch (error) {
                            throw new Error(`start() threw: ${error.message || error}`);
                        }
                    },
                    async end(instance) {
                        if (typeof instance.stop !== 'function') return;
                        try {
                            await instance.stop();
                        } catch (error) {
                            throw new Error(`stop() threw: ${error.message || error}`);
                        }
                    },
                    join: (parts, scope) => {
                        join(parts, scope);
                    },
                },
            ],
            over: Object.freeze({
                lifecycle: (over) => ({
                    method: over.method,
                    registrations: { ...registrations, ...over.registrations },
                    start: (instance, handles, scope) =>
                        over.start(instance, { ...handles, deckit: handleOf(handles.deckit, scope) }, scope),
                    end: (instance) => over.end(instance),
                    join(parts, scope) {
                        const { keyProblem = () => '' } = over.join(parts, scope) ?? {};
                        judge(join(parts, scope, keyProblem), scope, keyProblem);
                    },
                }),
                blockKeysWhen(blocks) {
                    blocking.add(blocks);
                },
            }),
        };
    }

    // MARK: - Private
    // Deckit's members on a handle, what they make that calls back into the mod's code cut with `scope`: each
    // namespace holds what `deck` registers in it beside what reaches others' (deckit-shell/deck/runner).
    function membersOf(mod, deck, scope, { mainProcess }) {
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        const scoped =
            (subscribe) =>
            (...args) =>
                scope.add(subscribe(...args));
        return {
            web: WEB.forMod({ permissions: mod.permissions.map(({ id }) => id), scoped }),
            util: Object.freeze({
                match: MATCH.match,
                matchFields: MATCH.matchFields,
                TIER: MATCH.TIER,
                ranker: (options) => {
                    const made = RANKER.ranker(options);
                    return Object.freeze({ rank: made.rank, close: scope.add(made.close) });
                },
                movePath,
                tildify: tildifyOf(),
            }),
            configuration: CONFIGURED.forScope(scope),
            commands: Object.freeze({
                ...deck.commands,
                ...(has(COMMAND_PERMISSION.COMMAND_REGISTRY)
                    ? { ...COMMAND.registry, onChange: scoped(COMMAND.registry.onChange) }
                    : {}),
            }),
            keys: Object.freeze({
                ...deck.keys,
                chordOf: (name, { provider = '' } = {}) => KEYMAP.chord(name, { provider }),
                ...(has(KEYMAP_PERMISSION.KEYMAP)
                    ? {
                          list: KEYMAP.bindings,
                          bind: KEYMAP.bind,
                          reset: KEYMAP.reset,
                          record: KEYMAP.record,
                          onChange: scoped(KEYMAP.onChange),
                      }
                    : {}),
            }),
            urls: Object.freeze({
                ...deck.urls,
                open: (url, options) => OPEN.open(url, options),
                ...(has(OPEN_PERMISSION.URL_SCHEMES)
                    ? { list: OPEN.handlerLists, set: OPEN.setHandlers, everyScheme: OPEN.EVERY }
                    : {}),
            }),
            ...(has(OPEN_PERMISSION.FILE_HANDLERS) ? { reveal: OPEN.reveal } : {}),
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            ...(has(COMMAND_PERMISSION.COMMAND_REGISTRY) || has(KEYMAP_PERMISSION.KEYMAP)
                ? { provider: PROVIDER.provider }
                : {}),
            clipboard: Object.freeze({
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_READ) ? { readText: CLIPBOARD.readText } : {}),
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_WRITE) ? { writeText: CLIPBOARD.writeText } : {}),
            }),
            ...(has(NOTIFICATION_PERMISSION.NOTIFICATIONS) ? { notify: NOTIFICATION.notifyOf(scope) } : {}),
            ...(has(MAIN_PROCESS_PERMISSION.MAIN_PROCESS) ? { mainProcess: mainProcess.forScope(scope) } : {}),
            ...(has(CONFIGURATION_PERMISSION.MOD_CONFIGURATION) ? { modConfiguration: CONFIGURATION.tool() } : {}),
        };
    }

    // A path as it is shown: under the home folder, from `~`.
    function tildifyOf() {
        const { home } = RUNTIME.about();
        return (path) => (path === home || path.startsWith(home + '/') ? '~' + path.slice(home.length) : path);
    }

    // `to` null means gone: a path at or inside `from` becomes null. Paths are "/" separated.
    function movePath(path, from, to) {
        if (typeof path !== 'string' || (path !== from && !path.startsWith(from + '/'))) return path;
        return to == null ? null : to + path.slice(from.length);
    }

    return { layer };
}

// MARK: - Private
function strings(list) {
    return Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
}
