import * as MOD_PERMISSION from '../deck/mod/permission.js';
import * as LIFECYCLE from '../deck/mod/lifecycle.js';
import * as PROXY from '../deck/export/proxy.js';
import * as IPC from '../deck/ipc/main.js';
import * as ENVIRONMENT from '../environment/index.js';

// What connect answers. `stage` is the environment's (environment: MAIN.stage).
export function createApi({
    CONFIG,
    CORE,
    STORAGE,
    LOG,
    IDENTITY,
    CATALOG,
    RUNNER,
    PERMISSION,
    WEB,
    KEYMAP,
    COMMAND,
    MAIN_PROCESS,
    PAGE,
    SETUP,
    stage,
}) {
    // MARK: - Property
    const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
    const facts = new WeakMap(); // a run -> what the host app reads of it
    const listings = new WeakMap(); // a run that launched -> how it listed its mod, { icon, keywords }

    // MARK: - Initializer

    // MARK: - Public
    // What a host app and the shell's UI on deckit reach of deckit, in main: the mods and their runs, pages that run
    // no mod, keys, commands, permissions for what the UI adds, their own state, and the log. No more of deckit is
    // theirs. Every fact it hands out is a frozen copy. `onStart(listener)` is how deckit is told what starts with it,
    // and `restart()` the host app's.
    function make({ onStart, restart }) {
        return Object.freeze({
            config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
            onStart,
            attach: SETUP.attach,
            // The core that answers nothing more, told once with why, so a person can be asked to restart the app.
            core: Object.freeze({ onDown: CORE.onDown }),
            restart,
            mods: Object.freeze({
                notifications: NOTIFICATIONS,
                list: () => Object.freeze(CATALOG.mods().map(manifestOf)),
                // A mod found or gone, or what restartPending answers.
                onChange: (listener) => {
                    const offs = [CATALOG.onChange(listener), MAIN_PROCESS.onChange(listener)];
                    return () => offs.forEach((off) => off?.());
                },
                arrange: CATALOG.arrange,
                runs: () =>
                    Object.freeze(RUNNER.runs().map(({ run, page }) => Object.freeze({ run: factsOf(run), page }))),
                runOf: (id) => factsOf(RUNNER.runOf(id)),
                listingOf,
                observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                modOf: (page) => IDENTITY.modOf(page)?.id || null,
                // The mod in the page, which may drive mods; throws for any other page.
                managerFrom: (page) => IDENTITY.modFrom(page, MOD_PERMISSION.MODS).id,
                relaunch: (id) => RUNNER.relaunch([id]),
                relaunchAll: RUNNER.relaunchAll,
                // The mods whose main process modules only a restart of the app finishes: [{ id, why }].
                restartPending: () => frozen(MAIN_PROCESS.restartPending()),
            }),
            pages: Object.freeze({
                open: PAGE.open,
                // A stage, held to what a stage is as the environment makes it.
                stage: () => ENVIRONMENT.checked(stage(), ENVIRONMENT.STAGE, 'a stage'),
                close: PAGE.close,
                focus: PAGE.focus,
                isAlive: PAGE.isAlive,
                whenFocused: PAGE.whenFocused,
                nameOf: IDENTITY.pageNameOf,
                whenEnds: IDENTITY.whenPageEnds,
                isPressing: IDENTITY.isPressing,
                isPointing: IDENTITY.isPointing,
            }),
            keymap: Object.freeze({
                register: KEYMAP.register,
                chordOf: KEYMAP.chordOf,
                listen: (page, { keys } = {}) => KEYMAP.listen(page, { keys, page: WEB.pageFor(page) }),
                delegate: KEYMAP.delegate,
            }),
            commands: Object.freeze({ tones: COMMAND.TONES, session: COMMAND.session }),
            permissions: Object.freeze({ define: PERMISSION.define }),
            // What the host app and its shell keep of the person's, in a folder of their own beside deck's state.
            state: STORAGE.stateIn('host'),
            web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
            log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error }),
            // How the UI binds its own channels: as deck/channel declares them, never one of deck's own.
            channels: IPC.layerChannels,
        });
    }

    // MARK: - Private
    // How a mod is listed, as its latest run that launched said: kept while it launches again, so whatever lists
    // the mods does not lose it then.
    function listingOf(id) {
        const run = RUNNER.launchedOf(id);
        if (!run) return null;
        if (!listings.has(run))
            listings.set(
                run,
                Object.freeze({ icon: run.summary.icon, keywords: Object.freeze([...run.summary.keywords]) })
            );
        return listings.get(run);
    }

    function manifestOf(mod) {
        return frozen(mod.manifest);
    }

    // What a run is, read only: its transitions are the runner's. What it reported is copied once it is known.
    function factsOf(run) {
        if (!run) return null;
        if (!facts.has(run)) {
            let summary = null;
            let contributions = null;
            facts.set(
                run,
                Object.freeze({
                    mod: manifestOf(run.mod),
                    number: run.number,
                    get state() {
                        return run.state;
                    },
                    get summary() {
                        if (run.summary && !summary) summary = frozen(run.summary);
                        return summary;
                    },
                    get contributions() {
                        if (run.contributions && !contributions) contributions = frozen(run.contributions);
                        return contributions;
                    },
                    get problem() {
                        return run.problem;
                    },
                    get relaunches() {
                        return run.relaunches;
                    },
                })
            );
        }
        return facts.get(run);
    }

    function frozen(value) {
        return PROXY.deepFreeze(structuredClone(value));
    }

    return { make };
}
