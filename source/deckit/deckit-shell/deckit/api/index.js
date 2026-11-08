import * as MOD_PERMISSION from '../permission/index.js';
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
    PERMISSION,
    MANIFEST_FIELD,
    WEB,
    KEYMAP,
    MAIN_PROCESS,
    SETUP,
}) {
    // MARK: - Property
    const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
    const facts = new WeakMap(); // a run -> what the host app reads of it
    const copies = new WeakMap(); // what a run reported, as the runner keeps it -> its frozen copy

    // MARK: - Initializer

    // MARK: - Public
    // What a host app and the UI shell on deckit reach of deckit, in main: the mods and their runs, the pages, the
    // pages where the chords mods take work and the keys pressed there, permissions for what the UI adds and the
    // manifest fields it reads, their own state, the log, and the layers stacked over deckit on a mod's page. No more
    // of deckit is theirs. Every fact it hands out is a frozen copy. `onStart(listener)` is how deckit is told what
    // starts with it, `whenStarted()` when it has started, and `restart()` the host app's.
    function make({ onStart, whenStarted, restart }) {
        return Object.freeze({
            config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
            onStart,
            // Resolves once deckit has started, the background mods launched or failed to. Rejects with what refused
            // the start, its `kind` on it: what the core refused initialize with (FIELD, PERMISSION), or ENDED.
            whenStarted,
            // stack(name): a layer, by its name, stacks over deckit on each mod's page that starts from now on.
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
                // A mod found or gone, or what restartPending answers.
                onChange: (listener) => {
                    const offs = [CATALOG.onChange(listener), MAIN_PROCESS.onChange(listener)];
                    return () => offs.forEach((off) => off?.());
                },
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
                // The text of a file inside the mod's folder, by its path there, or null for none.
                readFile: CATALOG.readFile,
                observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                modOf: (page) => IDENTITY.modOf(page)?.id || null,
                // The mod in the page, which may drive mods; throws for any other page.
                managerFrom: (page) => IDENTITY.modFrom(page, MOD_PERMISSION.MODS).id,
                // The mod launches, the shell asking, or quits: resolve once it has launched, or has ended, and
                // reject with why where it did not launch.
                launch: (id) => RUNNER.launch(id),
                quit: (id) => RUNNER.quit(id),
                relaunch: (id) => RUNNER.relaunch([id]),
                relaunchAll: RUNNER.relaunchAll,
                // The mods whose main process modules only a restart of the app finishes: [{ id, why }].
                restartPending: () => frozen(MAIN_PROCESS.restartPending()),
            }),
            pages: Object.freeze({
                // add(page, name): a page the host app or its shell made that runs no mod, known as theirs by `name`
                // from now on, before it loads.
                add: (page, name) => IDENTITY.add(page, { page: name }),
                nameOf: IDENTITY.pageNameOf,
                whenEnds: IDENTITY.whenPageEnds,
                isPressing: IDENTITY.isPressing,
                isPointing: IDENTITY.isPointing,
            }),
            // listen(page): a page of the host app's or its shell's where the chords mods take work too.
            // monitor(handler(page, keystroke) -> taken) -> off: a look at each key pressed in a page listened to,
            // before the chords mods take, taking it by answering true (deckit/keymap/main.js).
            keymap: Object.freeze({
                listen: (page) => KEYMAP.listen(page),
                monitor: (handler) => KEYMAP.monitor(handler),
            }),
            permissions: Object.freeze({ define: PERMISSION.define }),
            // define(key): a top-level manifest key the UI reads, named before deckit starts.
            fields: Object.freeze({ define: MANIFEST_FIELD.define }),
            // What the host app and its shell keep of the person's, in a folder of their own beside deckit's state.
            state: STORAGE.stateIn('host'),
            web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
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
