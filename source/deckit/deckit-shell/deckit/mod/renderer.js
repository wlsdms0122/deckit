import * as MATCH from '../match/match.js';
import * as RANKER from '../match/ranker.js';
import * as CLIPBOARD from '../clipboard/renderer.js';
import * as RUNTIME from '../runtime/renderer.js';
import * as OPEN from '../open/renderer.js';
import * as MAIN_PROCESS from '../main-process/renderer.js';
import * as MOD_FOLDER from '../mod-folder/renderer.js';
import * as CONTRIBUTION from '../contribution/renderer.js';
import * as MAIN_PROCESS_PERMISSION from '../main-process/model/permission.js';
import * as CLIPBOARD_PERMISSION from '../clipboard/model/permission.js';
import * as NOTIFICATION_PERMISSION from '../notification/model/permission.js';
import * as KEYS_PERMISSION from '../keymap/model/permission.js';
import * as OPEN_PERMISSION from '../open/model/permission.js';

// What deckit puts on the runner for a mod's page: the handle `deckit`, the runner's members and the layer's, the
// lifecycle deckit calls, start() and stop(), and what a layer over deckit stacks a lifecycle of its own with.
export function createMod({ WEB, NOTIFICATION, KEYMAP }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit as a layer on the runner (deckit-shell/deckit/runner/renderer.js). `over` is what a layer over it is
    // handed: `lifecycle({ method, registrations, start, end, join })`, a lifecycle of that layer's, whose `start` is
    // handed the handle `deckit` with deckit's members.
    function layer({ mod, deliver }) {
        NOTIFICATION.listen(deliver);
        const mainProcess = MAIN_PROCESS.createMainProcess({ deliver });
        KEYMAP.hear();
        const handleOf = (runner, scope) =>
            Object.freeze({ ...runner, ...membersOf(mod, runner, scope, { mainProcess }) });
        return {
            handle: 'deckit',
            mods: {
                pick: MOD_FOLDER.pick,
                reveal: MOD_FOLDER.reveal,
                restartPending: MAIN_PROCESS.restartPending,
                restart: RUNTIME.restart,
            },
            lifecycles: [
                {
                    method: 'start',
                    registrations: {},
                    async start(instance, handles, scope) {
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
                    join: () => {},
                },
            ],
            over: Object.freeze({
                lifecycle: (over) => ({
                    method: over.method,
                    registrations: { ...over.registrations },
                    start: (instance, handles, scope) =>
                        over.start(instance, { ...handles, deckit: handleOf(handles.deckit, scope) }, scope),
                    end: (instance) => over.end(instance),
                    join: (parts, scope) => {
                        over.join(parts, scope);
                    },
                }),
            }),
        };
    }

    // MARK: - Private
    // Deckit's members on a handle, what they make that calls back into the mod's code cut with `scope`: each
    // namespace holds what `runner`, the runner's members, registers in it beside what reaches others'
    // (deckit-shell/deckit/runner).
    function membersOf(mod, runner, scope, { mainProcess }) {
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
            exports: Object.freeze({ ...runner.exports, contributions: CONTRIBUTION.contributions }),
            // A chord taken is let go once `scope` is cut.
            ...(has(KEYS_PERMISSION.APP_KEYS) || has(KEYS_PERMISSION.GLOBAL_KEYS)
                ? {
                      keys: Object.freeze({
                          take: async (keystroke, run, options) => {
                              const { held, release } = await KEYMAP.take(keystroke, run, options);
                              return Object.freeze({ held, release: scope.add(release) });
                          },
                      }),
                  }
                : {}),
            urls: Object.freeze({ open: (url, options) => OPEN.open(url, options) }),
            ...(has(OPEN_PERMISSION.FILE_HANDLERS) ? { reveal: OPEN.reveal } : {}),
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            active: RUNTIME.active,
            clipboard: Object.freeze({
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_READ) ? { readText: CLIPBOARD.readText } : {}),
                ...(has(CLIPBOARD_PERMISSION.CLIPBOARD_WRITE) ? { writeText: CLIPBOARD.writeText } : {}),
            }),
            ...(has(NOTIFICATION_PERMISSION.NOTIFICATIONS)
                ? { notifications: NOTIFICATION.notificationsOf(scope) }
                : {}),
            ...(has(MAIN_PROCESS_PERMISSION.MAIN_PROCESS) ? { mainProcess: mainProcess.forScope(scope) } : {}),
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
