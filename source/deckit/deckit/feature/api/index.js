DeckitModule.define(
    'deckit/feature/api',
    {
        uses: [
            'deckit/config',
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/service/window',
            'deckit/service/deck/identity',
            'deckit/service/deck/catalog',
            'deckit/service/deck/runner',
            'deckit/service/mod/manifest',
            'deckit/service/mod/lifecycle',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/command/main',
            'deckit/service/deck/model/origin',
        ],
        provides: ['make'],
        runs: 'main',
    },
    (CONFIG, STORAGE, LOG, WINDOW, IDENTITY, CATALOG, RUNNER, MANIFEST, LIFECYCLE, WEB, KEYMAP, COMMAND, ORIGIN) => {
        // MARK: - Property
        // A page the shell makes is named as a host is, with no dot, so its origin is never a mod's.
        const PAGE_NAME = /^[a-z][a-z0-9-]*$/;
        const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
        const facts = new WeakMap(); // a run -> what the host app reads of it

        // MARK: - Initializer
        // MARK: - Public
        // What a host app and the shell it puts on deckit reach of deckit, in main: the mods and their runs, pages of
        // the shell's own, keys, commands, their own state, and windows. No more of deckit is theirs. Every value it
        // hands out is a frozen copy. `makeView({ webview })` makes a view for a deckit page; `onStart(listener)` is how
        // deckit is told what starts with it.
        function make({ makeView, onStart }) {
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
                    observe: (name, observer) => RUNNER.observe(name, (run) => observer(factsOf(run))),
                    modOf: (webContents) => IDENTITY.modOf(webContents)?.id || null,
                    relaunchAll: RUNNER.restart,
                }),
                pages: Object.freeze({
                    make: (name) => makePage(makeView, name),
                    nameOf: IDENTITY.pageNameOf,
                    whenEnds: IDENTITY.whenPageEnds,
                }),
                keymap: Object.freeze({
                    register: KEYMAP.register,
                    chordOf: KEYMAP.chordOf,
                    listen: KEYMAP.listen,
                    delegate: KEYMAP.delegate,
                }),
                commands: Object.freeze({ tones: COMMAND.TONES, session: COMMAND.session }),
                state: Object.freeze({ read: STORAGE.hostState.read, write: STORAGE.hostState.write }),
                web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
                window: Object.freeze({ place: WINDOW.place }),
                log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error, guard: LOG.guard }),
            });
        }

        // MARK: - Private
        // A page of the shell's, at its own origin, which loads as every deckit page does and then asks the shell to
        // draw it.
        function makePage(makeView, name) {
            if (!PAGE_NAME.test(String(name)))
                throw new Error(`"${name}" is not a page name: a lower case letter, then letters, digits and -`);
            const view = makeView({ webview: false });
            IDENTITY.add(view.webContents, { page: name });
            view.webContents.loadURL(ORIGIN.addressOf(ORIGIN.pageOriginOf(name)));
            return view;
        }

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
            const copy = structuredClone(value);
            const freeze = (inner) => {
                if (!inner || typeof inner !== 'object' || Object.isFrozen(inner)) return inner;
                Object.freeze(inner);
                for (const each of Object.values(inner)) freeze(each);
                return inner;
            };
            return freeze(copy);
        }

        return { make };
    }
);
