import * as DECK from '../../deck/main.js';

export function createApi({
    CONFIG,
    STORAGE,
    LOG,
    WINDOW,
    IDENTITY,
    PAGES,
    CATALOG,
    RUNNER,
    MANIFEST,
    MOD_PERMISSION,
    WEB,
    KEYMAP,
    COMMAND,
    MAIN_PROCESS,
}) {
    // MARK: - Property
    const NOTIFICATIONS = Object.freeze([...DECK.NOTIFICATIONS]);
    const facts = new WeakMap(); // a run -> what the host app reads of it
    // mod id -> how it is listed, { icon, keywords }, as its latest run that launched said: kept while it launches
    // again, so whatever lists the mods does not lose it then.
    const listings = new Map();

    // MARK: - Initializer
    RUNNER.observe('didLaunch', ({ mod, summary }) =>
        listings.set(mod.id, Object.freeze({ icon: summary.icon, keywords: Object.freeze([...summary.keywords]) }))
    );
    CATALOG.onChange(() => {
        const found = new Set(CATALOG.mods().map(({ id }) => id));
        for (const id of [...listings.keys()]) if (!found.has(id)) listings.delete(id);
    });

    // MARK: - Public
    // What a host app and the shell it puts on deckit reach of deckit, in main: the mods and their runs, pages of
    // the shell's own, keys, commands, permissions for what the shell adds, their own state, and windows. No more
    // of deckit is theirs. Every fact it hands out is a frozen copy. `onStart(listener)` is how deckit is told what
    // starts with it.
    function make({ onStart }) {
        return Object.freeze({
            config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
            onStart,
            mods: Object.freeze({
                notifications: NOTIFICATIONS,
                list: () => Object.freeze(CATALOG.mods().map(manifestOf)),
                onChange: CATALOG.onChange,
                arrange: CATALOG.arrange,
                runs: () =>
                    Object.freeze(RUNNER.runs().map(({ run, view }) => Object.freeze({ run: factsOf(run), view }))),
                runOf: (id) => factsOf(RUNNER.runOf(id)),
                listingOf: (id) => listings.get(id) || null,
                observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                modOf: (webContents) => IDENTITY.modOf(webContents)?.id || null,
                // The mod in the page, which may drive mods; throws for any other page.
                managerFrom: (webContents) => IDENTITY.modFrom(webContents, DECK.MODS).id,
                relaunchAll: RUNNER.relaunchAll,
                // The mods whose main process modules only a restart of the app finishes: [{ id, why }].
                restartPending: () => frozen(MAIN_PROCESS.restartPending()),
            }),
            pages: Object.freeze({
                make: PAGES.make,
                nameOf: IDENTITY.pageNameOf,
                whenEnds: IDENTITY.whenPageEnds,
                isPressing: IDENTITY.isPressing,
                isPointing: IDENTITY.isPointing,
            }),
            keymap: Object.freeze({
                register: KEYMAP.register,
                chordOf: KEYMAP.chordOf,
                listen: KEYMAP.listen,
                delegate: KEYMAP.delegate,
            }),
            commands: Object.freeze({ tones: COMMAND.TONES, session: COMMAND.session }),
            permissions: Object.freeze({ define: MOD_PERMISSION.define }),
            // What the host app and its shell keep of the person's, in a folder of their own beside deck's state.
            state: STORAGE.stateIn('host'),
            web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
            window: Object.freeze({ place: WINDOW.place }),
            log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error, guard: LOG.guard }),
        });
    }

    // MARK: - Private
    function manifestOf(mod) {
        return frozen(MANIFEST.of(mod));
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
        return DECK.deepFreeze(structuredClone(value));
    }

    return { make };
}
