DeckitModule.define(
    'deckit/feature/host/main',
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
    },
    (CONFIG, STORAGE, LOG, WINDOW, IDENTITY, CATALOG, RUNNER, MANIFEST, LIFECYCLE, WEB, KEYMAP, COMMAND, ORIGIN) => {
        // MARK: - Property
        // A page the UI makes is named as a host is, with no dot, so its origin is never a mod's.
        const PAGE_NAME = /^[a-z][a-z0-9-]*$/;
        const facts = new WeakMap(); // a run -> what the host app reads of it

        // MARK: - Initializer
        // MARK: - Public
        // What a host app and the UI it draws reach of deck, in main: what deck knows of the mods and their runs,
        // pages of the UI's own, keys, commands, the UI's state, and its windows. No more of deck is theirs.
        // `makeView({ webview })` makes a view for a deckit page; `onStart(listener)` is how deck is told the UI
        // starts with it.
        function make({ makeView, onStart }) {
            return Object.freeze({
                config: Object.freeze({ id: CONFIG.id, name: CONFIG.name }),
                onStart,
                mods: Object.freeze({
                    notifications: LIFECYCLE.NOTIFICATIONS,
                    list: () => CATALOG.mods().map(MANIFEST.of),
                    onChange: CATALOG.onChange,
                    arrange: CATALOG.arrange,
                    runs: () => RUNNER.runs().map(({ run, view }) => ({ run: factsOf(run), view })),
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
                    route: KEYMAP.route,
                }),
                commands: Object.freeze({
                    sourceOf: COMMAND.sourceOf,
                    list: COMMAND.list,
                    now: COMMAND.now,
                    resolve: COMMAND.resolve,
                    search: COMMAND.search,
                    run: COMMAND.run,
                }),
                state: Object.freeze({ read: STORAGE.state.read, write: STORAGE.state.write }),
                web: Object.freeze({ pageFor: WEB.pageFor, holdsKeyboard: WEB.holdsKeyboard }),
                window: Object.freeze({ place: WINDOW.place }),
                log: Object.freeze({ info: LOG.info, warn: LOG.warn, error: LOG.error, guard: LOG.guard }),
            });
        }

        // MARK: - Private
        // A page of the UI's, at its own origin, which loads as every deckit page does and then asks the UI to draw
        // it.
        function makePage(makeView, name) {
            if (!PAGE_NAME.test(String(name)))
                throw new Error(`"${name}" is not a page name: a lower case letter, then letters, digits and -`);
            const view = makeView({ webview: false });
            IDENTITY.add(view.webContents, { page: name });
            view.webContents.loadURL(ORIGIN.addressOf(ORIGIN.pageOriginOf(name)));
            return view;
        }

        // What a run is, read only: its transitions are the runner's.
        function factsOf(run) {
            if (!run) return null;
            if (!facts.has(run)) {
                facts.set(
                    run,
                    Object.freeze({
                        mod: Object.freeze(MANIFEST.of(run.mod)),
                        number: run.number,
                        get state() {
                            return run.state;
                        },
                        get summary() {
                            return run.summary;
                        },
                        get contributions() {
                            return run.contributions;
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

        return { make };
    }
);
