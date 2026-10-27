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

// What deckit puts on deck for a mod's page: the handle `deckit`, deck's members and deckit's, and the lifecycle
// deckit calls, start() and stop(), with the one the shell on deckit stacks over it, if one is.
export function createMod({ WEB, NOTIFICATION, KEYMAP, COMMAND, CONFIGURATION: CONFIGURED }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // What is on deck (deckit-shell/deck/runner/renderer.js). It reads the class's `keywords`, which whatever lists the
    // mods reads in its run's summary, and its `configuration`. `shellOf(context)` is the shell on deckit, if one is,
    // asked with `{ mod, deliver, fail }`: `read(Entry)`, what it reads of the class; `registrations`, its handle's,
    // by name, `{ handle, check }`; `blocksKeys()`, whether a key pressed now is dropped; `start(instance, { shell,
    // deckit }, scope)` and `end(instance)`, its lifecycle; and `join(parts, scope)`, which answers what main is told
    // of the mod beside deckit's own, `{ summary, contributions }`, and `keyProblem(key)`, why a key would never run,
    // or ''.
    function layerOf(shellOf) {
        return ({ mod, deliver, fail }) => {
            NOTIFICATION.listen(deliver);
            const mainProcess = MAIN_PROCESS.createMainProcess({ deliver });
            const shell = shellOf ? shellOf({ mod, deliver, fail }) : null;
            KEYMAP.hear({ blocksKeys: () => shell?.blocksKeys() ?? false });
            const functionProblem = (value) => (typeof value === 'function' ? '' : 'takes a function');
            const table = (value) => (value && typeof value === 'object' ? '' : 'takes an object');
            const registrations = {
                keys: { handle: 'deckit', check: table },
                commands: { handle: 'deckit', check: table },
                handleURL: { handle: 'deckit', check: functionProblem },
            };
            // What every lifecycle joined so far contributes: deckit's, and the shell's as it last told it.
            const joined = { keys: [], commands: [], handleURL: null, answering: false, shell: {} };
            const handleOf = (deck, scope) => Object.freeze({ ...deck, ...membersOf(mod, scope, { mainProcess }) });
            const join = (parts, scope, shown = null) => {
                if (typeof parts.handleURL === 'function') {
                    if (joined.handleURL) fail('deckit.handleURL() is registered under it, so this one is left out');
                    else {
                        if (!joined.answering) OPEN.answer((url, options) => joined.handleURL?.(url, options) ?? false);
                        joined.answering = true;
                        joined.handleURL = parts.handleURL;
                        scope.add(() => (joined.handleURL = null));
                    }
                }
                const commands = COMMAND.declare(parts.commands, { invalid: fail });
                const problemOf = shown ? shown.keyProblem : () => '';
                const keys = KEYMAP.declare(parts.keys, { invalid: fail, problemOf });
                joined.commands = [...joined.commands, ...commands.declared];
                joined.keys = [...joined.keys, ...keys.declared];
                scope.add(() => {
                    commands.off();
                    keys.off();
                    joined.commands = joined.commands.filter((command) => !commands.declared.includes(command));
                    joined.keys = joined.keys.filter((key) => !keys.declared.includes(key));
                });
                // A key declared under it is judged once the shell has shown what the mod has on screen.
                if (shown) {
                    const never = joined.keys.filter((key) => !keys.declared.includes(key) && shown.keyProblem(key));
                    for (const key of never) fail(`key "${key.name}" never runs: ${shown.keyProblem(key)}`);
                    KEYMAP.withdraw(never.map(({ name }) => name));
                    joined.keys = joined.keys.filter((key) => !never.includes(key));
                    joined.shell = { summary: shown.summary, contributions: shown.contributions };
                    scope.add(() => (joined.shell = {}));
                }
                return {
                    // What it registered, by name, beside the shell's, for deckit's core to judge it by.
                    contributions: {
                        ...joined.shell.contributions,
                        keys: joined.keys,
                        commands: joined.commands,
                        handleURL: !!joined.handleURL,
                    },
                    summary: {
                        ...joined.shell.summary,
                        commands: joined.commands.length > 0,
                        urlSchemes: joined.handleURL ? mod.urlSchemes : [],
                    },
                };
            };
            const lifecycles = [
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
                    join: (parts, scope) => join(parts, scope),
                },
            ];
            if (shell)
                lifecycles.push({
                    method: 'attach',
                    registrations: { ...registrations, ...shell.registrations },
                    start: (instance, handles, scope) =>
                        shell.start(
                            instance,
                            { shell: handles.shell ?? {}, deckit: handleOf(handles.deckit, scope) },
                            scope
                        ),
                    end: (instance) => shell.end(instance),
                    join: (parts, scope) => join(parts, scope, shell.join(parts, scope)),
                });
            return {
                handle: 'deckit',
                read(Entry) {
                    CONFIGURED.declare(Entry.configuration);
                    return { ...shell?.read(Entry), keywords: strings(Entry.keywords) };
                },
                mods: {
                    pick: MOD_FOLDER.pick,
                    reveal: MOD_FOLDER.reveal,
                    restartPending: MAIN_PROCESS.restartPending,
                    restart: RUNTIME.restart,
                },
                lifecycles,
            };
        };
    }

    // MARK: - Private
    // Deckit's members on a handle, what they make that calls back into the mod's code cut with `scope`.
    function membersOf(mod, scope, { mainProcess }) {
        const has = (permission) => mod.permissions.some(({ id }) => id === permission);
        const scoped =
            (subscribe) =>
            (...args) => {
                const off = subscribe(...args);
                scope.add(off);
                return off;
            };
        return {
            web: WEB.forMod({ permissions: mod.permissions.map(({ id }) => id) }),
            util: Object.freeze({
                match: MATCH.match,
                matchFields: MATCH.matchFields,
                TIER: MATCH.TIER,
                ranker: RANKER.ranker,
                movePath,
                tildify: tildifyOf(),
            }),
            configuration: CONFIGURED.forScope(scope),
            open: (url, options) => OPEN.open(url, options),
            ...(has(OPEN_PERMISSION.FILE_HANDLERS) ? { reveal: OPEN.reveal } : {}),
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            chordOf: (name, { provider = '' } = {}) => KEYMAP.chord(name, { provider }),
            ...(has(COMMAND_PERMISSION.COMMAND_REGISTRY) || has(KEYMAP_PERMISSION.KEYMAP)
                ? { provider: PROVIDER.provider }
                : {}),
            clipboard: Object.freeze({
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_READ) ? { readText: CLIPBOARD.readText } : {}),
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_WRITE) ? { writeText: CLIPBOARD.writeText } : {}),
            }),
            ...(has(NOTIFICATION_PERMISSION.NOTIFICATIONS) ? { notify: NOTIFICATION.notifyOf(scope) } : {}),
            ...(has(MAIN_PROCESS_PERMISSION.MAIN_PROCESS) ? { mainProcess: mainProcess.forScope(scope) } : {}),
            ...(has(KEYMAP_PERMISSION.KEYMAP)
                ? {
                      keymap: Object.freeze({
                          list: KEYMAP.bindings,
                          set: KEYMAP.bind,
                          reset: KEYMAP.reset,
                          record: KEYMAP.record,
                          onChange: scoped(KEYMAP.onChange),
                      }),
                  }
                : {}),
            ...(has(COMMAND_PERMISSION.COMMAND_REGISTRY)
                ? {
                      commandRegistry: Object.freeze({
                          ...COMMAND.registry,
                          onChange: scoped(COMMAND.registry.onChange),
                      }),
                  }
                : {}),
            ...(has(OPEN_PERMISSION.URL_SCHEMES)
                ? {
                      urlSchemes: Object.freeze({
                          list: OPEN.handlerLists,
                          set: OPEN.setHandlers,
                          everyScheme: OPEN.EVERY,
                      }),
                  }
                : {}),
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

    return { layerOf };
}

// MARK: - Private
function strings(list) {
    return Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
}
