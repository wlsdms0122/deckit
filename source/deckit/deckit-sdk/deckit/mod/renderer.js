import * as CLIPBOARD from '../clipboard/renderer.js';
import * as RUNTIME from '../runtime/renderer.js';
import * as OPEN from '../open/renderer.js';
import * as CONTRIBUTION from '../contribution/renderer.js';
import * as REQUEST from '../request/index.js';

// What deckit puts on the runner for a mod's page: the handle `deckit`, the runner's members and the layer's, the
// lifecycle deckit calls, start() and stop(), and what a layer over deckit stacks a lifecycle of its own with.
export function createMod({ NOTIFICATION }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // Deckit as a layer on the runner (deckit-shell/deckit/runner/renderer.js). Its lifecycle calls
    // `start(deckit, frameworks)`. `over` is what a layer over it is handed: `lifecycle({ method, registrations, start,
    // end, join })`, a lifecycle of that layer's, whose `start` is handed the handle `deckit` with deckit's members and
    // the frameworks as the runner made them.
    function layer({ mod, granted, deliver }) {
        NOTIFICATION.listen(deliver);
        const handleOf = (runner, scope) => Object.freeze({ ...runner, ...membersOf(mod, granted, runner, scope) });
        return {
            handle: 'deckit',
            mods: RUNTIME.mods,
            lifecycles: [
                {
                    method: 'start',
                    registrations: {},
                    async start(instance, handles, scope, frameworks) {
                        if (typeof instance.start !== 'function') return;
                        try {
                            await instance.start(handleOf(handles.deckit, scope), frameworks);
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
                    start: (instance, handles, scope, frameworks) =>
                        over.start(
                            instance,
                            { ...handles, deckit: handleOf(handles.deckit, scope) },
                            scope,
                            frameworks
                        ),
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
    // (deckit-shell/deckit/runner). A member a permission guards is on it all the same, and refuses a mod without it.
    function membersOf(mod, granted, runner, scope) {
        // The request `name`, refused NOT_PERMITTED as its channel's guard holds the mod, then for its arguments.
        const request = (name, asked, send) => REQUEST.requestOf(name, { ...asked, mod: mod.id, granted }, send);
        return {
            exports: Object.freeze({ ...runner.exports, contributions: CONTRIBUTION.contributions }),
            openExternal: OPEN.openExternalOf(mod, granted),
            fileURL: OPEN.fileURL,
            filePath: OPEN.filePath,
            about: RUNTIME.about,
            clipboard: CLIPBOARD.clipboardOf(request),
            notifications: NOTIFICATION.notificationsOf(scope, request),
        };
    }

    return { layer };
}
