DeckitModule.define(
    'deckit/feature/api',
    {
        uses: [
            'deckit/config',
            'deck/module/store',
            'deck/service/home',
            'deck/service/log/main',
            'deckit/service/window',
            'deck/service/deck/identity',
            'deck/service/deck/catalog',
            'deck/service/deck/runner',
            'deck/service/mod/manifest',
            'deck/service/mod/permission',
            'deck/service/mod/lifecycle',
            'deckit/service/web/main',
            'deckit/service/keymap/main',
            'deckit/service/command/main',
            'deck/service/deck/model/origin',
        ],
        provides: ['make'],
        runs: 'main',
    },
    (
        CONFIG,
        STORE,
        HOME,
        LOG,
        WINDOW,
        IDENTITY,
        CATALOG,
        RUNNER,
        MANIFEST,
        PERMISSION,
        LIFECYCLE,
        WEB,
        KEYMAP,
        COMMAND,
        ORIGIN
    ) => {
        // MARK: - Property
        const path = require('path');
        // A page the shell makes is named as a host is, with no dot, so its origin is never a mod's.
        const PAGE_NAME = /^[a-z][a-z0-9-]*$/;
        const STATE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
        const NOTIFICATIONS = Object.freeze([...LIFECYCLE.NOTIFICATIONS]);
        const facts = new WeakMap(); // a run -> what the host app reads of it

        // MARK: - Initializer
        // MARK: - Public
        // What a host app and the shell it puts on deckit reach of deckit, in main: the mods and their runs, pages of
        // the shell's own, keys, commands, permissions for what the shell adds, their own state, and windows. No more of deckit is theirs. Every value it
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
                permissions: Object.freeze({ define: PERMISSION.define }),
                // What the host app and its shell keep of the person's, in a folder of their own beside deck's state.
                state: Object.freeze({
                    read: (key, fallback) => STORE.read(stateFile(key), fallback),
                    write: (key, value) => STORE.write(stateFile(key), value),
                }),
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

        function stateFile(key) {
            if (!STATE_KEY.test(String(key)) || String(key).includes('..')) throw new Error('not a state key: ' + key);
            return path.join(HOME.state, 'host', key + '.json');
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
