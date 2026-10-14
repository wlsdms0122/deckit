import * as STORE from '../core/store/index.js';
import * as PROXY from '../core/proxy/index.js';
import * as DECK from '../deck/main.js';

export function createApi({
    CONFIG,
    HOME,
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
}) {
    // MARK: - Property
    const path = require('path');
    // A key names a file, and a Mac's disk is blind to case: lower case only.
    const STATE_KEY = /^[a-z0-9][a-z0-9._-]{0,63}$/;
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
        return PROXY.deepFreeze(structuredClone(value));
    }

    return { make };
}
