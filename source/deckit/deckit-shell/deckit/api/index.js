import * as OPEN_PERMISSION from '../open/model/permission.js';
import * as LIFECYCLE from '../runner/model/lifecycle.js';
import * as IPC from '../ipc/main.js';

// What connect answers.
export function createApi({
    CONFIG,
    CORE,
    STORAGE,
    LOG,
    IDENTITY,
    CATALOG,
    RUNNER,
    MODS,
    OPEN,
    REQUEST,
    PERMISSION,
    MANIFEST_FIELD,
    SETUP,
}) {
    // MARK: - Property
    const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
    const facts = new WeakMap(); // a run -> what the host app reads of it
    const copies = new WeakMap(); // what a run reported, as the runner keeps it -> its frozen copy

    // MARK: - Initializer

    // MARK: - Public
    // What a host app and the UI shell on deckit reach of deckit, in main: the mods and their runs, the pages,
    // permissions for what the UI adds and the manifest fields it reads, their own state, opening outside the app for a
    // mod, the log, and the layers stacked over deckit on a mod's page. No more of deckit is theirs. Every fact it
    // hands out is a frozen copy. `onStart(listener)` is how deckit is told what starts with it, `whenStarted()` when
    // it has started, and `restart()` the host app's.
    function make({ onStart, whenStarted, restart }) {
        return Object.freeze({
            config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
            onStart,
            // Resolves once deckit has started, the background mods launched or failed to. Rejects with what refused
            // the start, its `kind` on it: what the core refused initialize with (FIELD, PERMISSION), or ENDED.
            whenStarted,
            // stack(name, { setup }): a layer, by its name, stacks over deckit on each mod's page that starts from
            // now on, once for a name; `setup(id)`, where given, answers what the layer is handed on the mod's page.
            stack: SETUP.stack,
            // The core that answers nothing more, told once with why, so a person can be asked to restart the app.
            core: Object.freeze({ onDown: CORE.onDown }),
            restart,
            mods: Object.freeze({
                notifications: NOTIFICATIONS,
                // Every mod found, in the mods' order: one that loads as its manifest was read, and one that does not
                // as `{ id, refusal: { stage, kind, message } }`, refused at `read`, `kind` null for a problem that is
                // no refusal.
                list: () => Object.freeze(CATALOG.found().map(listingOf)),
                // The ids of the mods that load that the host app ships.
                shipped: () =>
                    Object.freeze(
                        CATALOG.mods()
                            .filter((mod) => mod.shipped)
                            .map((mod) => mod.id)
                    ),
                // A mod found or gone.
                onChange: (listener) => CATALOG.onChange(listener),
                // The id of the mod that owns an interface, as its queue says, or null; with `dependent`, the id of a
                // mod, null too where that mod does not reach it: it uses no such interface, owns it itself, or the
                // owner does not provide the major it uses.
                ownerOf: (named, dependent) => {
                    const owner = CATALOG.interfaces().find((queue) => queue.interface === named)?.owner ?? null;
                    if (!owner || dependent === undefined) return owner;
                    const use = CATALOG.found()
                        .find(({ id }) => id === dependent)
                        ?.uses.find((one) => one.interface === named);
                    return use?.owner === owner && !use.problem ? owner : null;
                },
                runs: () =>
                    Object.freeze(RUNNER.runs().map(({ run, page }) => Object.freeze({ run: factsOf(run), page }))),
                runOf: (id) => factsOf(RUNNER.runOf(id)),
                // The manifest fields the UI named (`fields.define`) that the mod's manifest writes, by key, each as
                // written, or null for no mod that loads.
                fieldsOf: (id) => {
                    const mod = CATALOG.mods().find((each) => each.id === id);
                    return mod ? frozen(mod.manifest.fields) : null;
                },
                // The ids of the permissions the mod is granted, or null for no mod that loads.
                grantedOf: (id) => {
                    const mod = CATALOG.mods().find((each) => each.id === id);
                    return mod ? frozen(mod.granted) : null;
                },
                // The text of a file inside the mod's folder, by its path there, or null for none.
                readFile: CATALOG.readFile,
                observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                // `listener(id)` is told of a mod installed, once the one it replaced, if that ran, has launched again,
                // and of a mod removed, before what runs in its place launches, while its run, if any, has not ended.
                // Each answers its off.
                onInstalled: (listener) => MODS.onInstalled(listener),
                onRemoved: (listener) => MODS.onRemoved(listener),
                // How long a run is given, in milliseconds, `{ launch, end }`: its code `launch` to start once it
                // launched, and each of its lifecycles `end` to end once its end is asked.
                timeout: () => frozen(CORE.timeout()),
                // onRequest(listener({ from, to })) -> off: each request one mod makes of another, a call on a
                // connection, a reach or a launch, the ids of the mod that asks and of the one asked, as it goes on.
                onRequest: REQUEST.onRequest,
                modOf: (page) => IDENTITY.modOf(page)?.id || null,
                // The id of the mod in the page that sent a request, held to being granted `permission` when one is
                // named: refused at call, REFUSED for a page that runs no mod and NOT_PERMITTED for a mod without it.
                modFrom: (page, permission) => IDENTITY.modFrom(page, permission).id,
                // The mod launches, the shell asking, or quits: resolve once it has launched, or has ended, and
                // reject with why where it did not launch.
                launch: (id) => RUNNER.launch(id),
                quit: (id) => RUNNER.quit(id),
                relaunch: (id) => RUNNER.relaunch([id]),
                relaunchAll: RUNNER.relaunchAll,
                // onErase(eraser(id) -> Promise) -> off: what an owner keeps of a mod removed with its data, erased as
                // the eraser asks; a rejection leaves the erasure to be tried again at the next start.
                onErase: (eraser) => MODS.onErase(eraser),
                // openExternal(id, url, { activates }): `url` opened outside the app for the mod `id`, as the mod's
                // own openExternal opens it: the web, and a file only where the mod's run holds
                // system.file-handlers, refused NOT_PERMITTED otherwise, and what is no such address refused
                // UNSUPPORTED_URL. Answers nothing once it is handed on.
                openExternal: (id, url, { activates } = {}) =>
                    OPEN.open(url, {
                        activates,
                        opensFiles: !!RUNNER.runOf(id)?.mod.granted.includes(OPEN_PERMISSION.FILE_HANDLERS),
                    }),
            }),
            pages: Object.freeze({
                // add(page, name): a page the host app or its shell made that runs no mod, known as theirs by `name`
                // from now on, before it loads.
                add: (page, name) => IDENTITY.add(page, { page: name }),
                nameOf: IDENTITY.pageNameOf,
                whenEnds: IDENTITY.whenPageEnds,
                // onSandbox(listener(page, id)) -> off: each mod's sandbox page as it is made, known as the page of
                // the mod `id` and before it loads, so what its owner sets up is in place before the mod's code runs.
                onSandbox: (listener) => RUNNER.onSandbox((page, mod) => listener(page, mod.id)),
            }),
            permissions: Object.freeze({ define: PERMISSION.define }),
            // define(key): a top-level manifest key the UI reads, named before deckit starts.
            fields: Object.freeze({ define: MANIFEST_FIELD.define }),
            // stateIn(name): what an owner keeps of the person's, `{ read, write }` in a folder of its own, by `name`,
            // beside deckit's state. `state` is the host app's and its shell's, `stateIn('host')`.
            stateIn: (name) => STORAGE.stateIn(name),
            state: STORAGE.stateIn('host'),
            log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error }),
            // How the UI binds its own channels: as deckit/channel declares them, never one of deckit's own.
            channels: IPC.layerChannels,
        });
    }

    // MARK: - Private
    function manifestOf(mod) {
        return frozen(mod.manifest);
    }

    // Every problem the core lists against a mod it found is a refusal of its folder as it was read.
    function listingOf(mod) {
        return mod.problem ? frozen({ id: mod.id, refusal: { stage: 'read', ...mod.problem } }) : manifestOf(mod);
    }

    // What a run is, read only: its transitions are the runner's. What it reported is copied each time it changes.
    function factsOf(run) {
        if (!run) return null;
        if (!facts.has(run)) {
            facts.set(
                run,
                Object.freeze({
                    mod: manifestOf(run.mod),
                    folder: run.mod.folder,
                    data: run.mod.data,
                    granted: frozen(run.mod.granted),
                    number: run.number,
                    get state() {
                        return run.state;
                    },
                    get summary() {
                        return copyOf(run.summary);
                    },
                    get contributions() {
                        return copyOf(run.contributions);
                    },
                    get problem() {
                        return run.problem;
                    },
                    get failed() {
                        return run.failed;
                    },
                    get refusal() {
                        return run.refusal;
                    },
                    get relaunches() {
                        return run.relaunches;
                    },
                })
            );
        }
        return facts.get(run);
    }

    function copyOf(reported) {
        if (!reported) return null;
        if (!copies.has(reported)) copies.set(reported, frozen(reported));
        return copies.get(reported);
    }

    function frozen(value) {
        return deepFreeze(structuredClone(value));
    }

    return { make };
}

function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        for (const inner of Object.values(value)) deepFreeze(inner);
    }
    return value;
}
