import * as MOD_PERMISSION from '../deck/mod/permission.js';
import * as LIFECYCLE from '../deck/mod/lifecycle.js';
import * as PROXY from '../deck/export/proxy.js';
import * as IPC from '../../deckit-shell/deck/ipc/main.js';
import * as LAYER from '../../deckit-shell/layer/index.js';

export function createApi({
    CONFIG,
    STORAGE,
    LOG,
    WINDOW,
    IDENTITY,
    CATALOG,
    RUNNER,
    PERMISSION,
    WEB,
    KEYMAP,
    COMMAND,
    MAIN_PROCESS,
    PAGE,
    STAGE,
}) {
    // MARK: - Property
    const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
    const facts = new WeakMap(); // a run -> what the host app reads of it
    const listings = new WeakMap(); // a run that launched -> how it listed its mod, { icon, keywords }

    // MARK: - Initializer

    // MARK: - Public
    // What a host app and the shell it puts on deckit reach of deckit, in main: the mods and their runs, pages of
    // the shell's own, keys, commands, permissions for what the shell adds, their own state, and windows. No more
    // of deckit is theirs. Every fact it hands out is a frozen copy. `onStart(listener)` is how deckit is told what
    // starts with it.
    function make({ onStart }) {
        const answer = Object.freeze({
            config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
            onStart,
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
                    Object.freeze(
                        RUNNER.runs().map(({ run, view, page }) => Object.freeze({ run: factsOf(run), page, view }))
                    ),
                runOf: (id) => factsOf(RUNNER.runOf(id)),
                listingOf,
                observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                modOf: (webContents) => IDENTITY.modOf(webContents)?.id || null,
                // The mod in the page, which may drive mods; throws for any other page.
                managerFrom: (webContents) => IDENTITY.modFrom(webContents, MOD_PERMISSION.MODS).id,
                relaunchAll: RUNNER.relaunchAll,
                // The mods whose main process modules only a restart of the app finishes: [{ id, why }].
                restartPending: () => frozen(MAIN_PROCESS.restartPending()),
            }),
            pages: Object.freeze({
                open: PAGE.open,
                stage: STAGE.stage,
                close: PAGE.close,
                focus: PAGE.focus,
                isAlive: PAGE.isAlive,
                whenFocused: PAGE.whenFocused,
                viewOf: PAGE.viewOf,
                make: (name) => PAGE.viewOf(PAGE.open(name)),
                nameOf: IDENTITY.pageNameOf,
                whenEnds: IDENTITY.whenPageEnds,
                isPressing: IDENTITY.isPressing,
                isPointing: IDENTITY.isPointing,
            }),
            keymap: Object.freeze({
                register: KEYMAP.register,
                chordOf: KEYMAP.chordOf,
                listen: (webContents, { keys } = {}) =>
                    KEYMAP.listen(webContents, { keys, page: WEB.pageFor(webContents) }),
                delegate: KEYMAP.delegate,
            }),
            commands: Object.freeze({ tones: COMMAND.TONES, session: COMMAND.session }),
            permissions: Object.freeze({ define: PERMISSION.define }),
            // What the host app and its shell keep of the person's, in a folder of their own beside deck's state.
            state: STORAGE.stateIn('host'),
            web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
            window: Object.freeze({ place: WINDOW.place }),
            log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error, guard: LOG.guard }),
            // How the shell binds its own channels: as deckit-shell/deck/channel declares them, never one of deckit's.
            channels: IPC.layerChannels,
        });
        // A layer is given at least what a driver and a layer agree on: one this answer lacks fails at once.
        LAYER.checked(answer, LAYER.CONNECTED, "connect's answer");
        return answer;
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
