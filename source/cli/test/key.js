// The shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, each
// holding its chord in the key map by the key's name and held again as it changes, a chord a mod took refused, the
// permissions of the keys, the privileged one main holds a page to before it lists or changes them, and a page's
// recording of its keys, for any page, as `shell.keys.record` asks it. Then `shell.keys` in a mod's page
// (shell/key/renderer): a chord taken for a mod with deckit.app-keys, a press of it running what took it and the chord
// let go once the lifecycle that took it ends; `take` refuses a mod without the permission of its scope at call with
// NOT_PERMITTED, before its arguments, and an argument of another type with INVALID_ARGUMENT. Exits 1 with a line for
// each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const KEY_PERMISSION = await import(url('deckit-shell', 'shell', 'key', 'model', 'permission.js'));
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
    const { createKeys } = await import(url('deckit-shell', 'shell', 'key', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const REQUEST = await import(url('deckit-shell', 'deckit', 'request', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The shell's keys, over a stand-in for what connect answers and for the environment's keys: `settings` holds
    // deckit.shell-keys, `other` does not, and `keeper` deckit.app-keys.
    const handlers = {};
    const state = { 'panel-keys': { closeWindow: { code: 'KeyB', meta: true }, gone: null, cycleWindows: 'none' } };
    const written = [];
    const holding = (id, granted) => ({ mod: { id }, granted });
    const runs = {
        settings: holding('settings', ['deckit.shell-keys']),
        other: holding('other', ['deckit.mods']),
        keeper: holding('keeper', ['deckit.app-keys']),
    };
    const recordedTold = []; // [page, payload], what main told a page that records
    const capturing = new Map(); // page -> what is told each key pressed in it
    const passing = new Map(); // page -> what is told each key it did not handle
    const keys = {
        capture: (page, handler) => capturing.set(page, handler),
        unhandled: (page, handler) => passing.set(page, handler),
        hotkey: () => null,
    };
    const full = (keystroke) => ({ code: '', meta: false, control: false, alt: false, shift: false, ...keystroke });
    const press = (page, keystroke) => capturing.get(page)({ type: 'keydown', ...full(keystroke) });
    const deckit = {
        channels: {
            bind: (declared) => ({
                handle: (handler) => (handlers[declared.channel] = handler),
                on: (handler) => (handlers[declared.channel] = handler),
                send: (page, payload) =>
                    declared.channel === 'deckit-shell:key-recorded' && recordedTold.push([page, payload]),
            }),
        },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                written.push(value);
                state[key] = value;
            },
        },
        log: { warn() {}, error() {} },
        pages: { onSandbox: () => () => {}, whenEnds: () => () => {} },
        mods: {
            modOf: (page) => page.mod,
            modFrom: (page, permission) => {
                if (runs[page.mod]?.granted.includes(permission)) return page.mod;
                throw Object.assign(new Error(`${page.mod} does not have ${permission}`), { kind: 'NOT_PERMITTED' });
            },
            runOf: (id) => runs[id] ?? null,
        },
    };
    check(
        'the permissions of the keys are deckit.app-keys and system.global-keys, then deckit.shell-keys, privileged',
        KEY_PERMISSION.PERMISSIONS.map(({ id, privileged }) => `${id}${privileged ? ' privileged' : ''}`).join() ===
            'deckit.app-keys,system.global-keys,deckit.shell-keys privileged' &&
            KEY_PERMISSION.SCOPES.app === 'deckit.app-keys' &&
            KEY_PERMISSION.SCOPES.global === 'system.global-keys',
        KEY_PERMISSION.PERMISSIONS
    );
    const KEY = createKey({ deckit, keys });
    const keyPresses = [];
    KEY.start((id, page) => keyPresses.push([id, page]) > 0);
    const pageA = { mod: 'a' };
    const recorder = { mod: 'other' };
    const keeper = { mod: 'keeper' };
    for (const page of [pageA, recorder]) KEY.listen(page);
    // The id of the shell's key a key the page did not handle runs, or null for none.
    const holder = (keystroke) => {
        const before = keyPresses.length;
        passing.get(pageA)(full(keystroke));
        return keyPresses.length > before ? keyPresses.at(-1)[0] : null;
    };
    const channel = (name) => (payload, mod) => handlers[`deckit-shell:key-${name}`](payload, { mod });
    check(
        "each of the shell's keys holds its chord, by the key's name, a press of it that key's",
        holder({ code: 'KeyM', meta: true }) === 'minimizeWindow' &&
            holder({ code: 'KeyB', meta: true }) === 'closeWindow' &&
            holder({ code: 'KeyW', meta: true }) === null &&
            keyPresses[0][1] === pageA,
        keyPresses
    );
    const listed = channel('list')({}, 'settings');
    check(
        "the shell's keys are listed in order, each with its default and the chord set for it, as kept",
        listed.map(({ id }) => id).join() === 'closeWindow,minimizeWindow,cycleWindows' &&
            JSON.stringify(listed[0].keystroke) ===
                JSON.stringify({ code: 'KeyB', meta: true, control: false, alt: false, shift: false }) &&
            listed[0].defaultKeystroke.code === 'KeyW' &&
            listed[2].keystroke.code === 'Backquote',
        listed
    );
    check(
        'a chord reads as a person reads it',
        KEY.chordOf('minimizeWindow') === '⌘M' && KEY.chordOf('cycleWindows') === '⌘`' && KEY.chordOf('gone') === '',
        [KEY.chordOf('minimizeWindow'), KEY.chordOf('cycleWindows')]
    );
    const refusedTo = (run) => {
        try {
            run();
        } catch (error) {
            return error.kind || error.message;
        }
        return '';
    };
    check(
        'a page without deckit.shell-keys neither lists nor changes them',
        refusedTo(() => channel('list')({}, 'other')) === 'NOT_PERMITTED' &&
            refusedTo(() => channel('set')({ id: 'closeWindow', keystroke: null }, 'other')) === 'NOT_PERMITTED' &&
            refusedTo(() => channel('reset')({ id: 'closeWindow' }, 'other')) === 'NOT_PERMITTED',
        ''
    );
    const chosen = { code: 'KeyS', meta: true, alt: true };
    const set = await channel('set')({ id: 'minimizeWindow', keystroke: chosen }, 'settings');
    check(
        'a key set takes its chord, kept in the shell state, held again and the chord it had let go',
        set.keystroke.code === 'KeyS' &&
            state['panel-keys'].minimizeWindow.alt === true &&
            holder({ code: 'KeyS', meta: true, alt: true }) === 'minimizeWindow' &&
            holder({ code: 'KeyM', meta: true }) === null,
        { set, state, keyPresses }
    );
    const keeperTakes = handlers['deckit-shell:key-take'](
        { id: 1, keystroke: full({ code: 'KeyM', meta: true, alt: true }), scope: 'app' },
        keeper
    );
    const modHolds = await channel('set')(
        { id: 'minimizeWindow', keystroke: { code: 'KeyM', meta: true, alt: true } },
        'settings'
    ).then(
        () => '',
        (error) => error.kind
    );
    check(
        'a chord another holds is refused, and the key keeps the chord it had',
        keeperTakes === true &&
            modHolds === 'REFUSED' &&
            state['panel-keys'].minimizeWindow.code === 'KeyS' &&
            holder({ code: 'KeyS', meta: true, alt: true }) === 'minimizeWindow' &&
            press(pageA, { code: 'KeyM', meta: true, alt: true }) === true,
        { keeperTakes, modHolds, state }
    );
    const taken = await channel('set')(
        { id: 'cycleWindows', keystroke: { code: 'KeyB', meta: true } },
        'settings'
    ).then(
        () => '',
        (error) => error.kind
    );
    check('a chord another of the shell keys has is refused', taken === 'REFUSED', taken);
    await channel('set')({ id: 'closeWindow', keystroke: null }, 'settings');
    check(
        'a key set to none has no chord, and holds none',
        KEY.chordOf('closeWindow') === '' &&
            state['panel-keys'].closeWindow === null &&
            holder({ code: 'KeyB', meta: true }) === null,
        state
    );
    const reset = await channel('reset')({ id: 'closeWindow' }, 'settings');
    check(
        'a key reset has its default again, held, and the state keeps no chord for it',
        reset.keystroke.code === 'KeyW' &&
            !Object.hasOwn(state['panel-keys'], 'closeWindow') &&
            holder({ code: 'KeyW', meta: true }) === 'closeWindow',
        { reset, state }
    );

    // Any mod's page records the keys pressed in it, until it stops.
    handlers['deckit-shell:key-record']({ id: 1 }, recorder);
    const recordedPress = press(recorder, { code: 'KeyS', meta: true, alt: true });
    press(pageA, { code: 'KeyQ' });
    check(
        'a page that records is told each key pressed in it, taken from it, and no key pressed elsewhere',
        recordedPress === true &&
            recordedTold.length === 1 &&
            recordedTold[0][0] === recorder &&
            recordedTold[0][1].id === 1 &&
            recordedTold[0][1].keystroke.code === 'KeyS',
        recordedTold
    );
    handlers['deckit-shell:key-stop-recording']({ id: 2 }, recorder);
    press(recorder, { code: 'KeyR' });
    check('a stop of another recording stops nothing', recordedTold.length === 2, recordedTold);
    handlers['deckit-shell:key-stop-recording']({ id: 1 }, recorder);
    press(recorder, { code: 'KeyR' });
    check('a recording stopped is told nothing more', recordedTold.length === 2, recordedTold);
    check(
        'what is no key of the shell, or no keystroke, is refused',
        refusedTo(() => channel('set')({ id: 'gone', keystroke: null }, 'settings')) !== '' &&
            refusedTo(() => channel('set')({ id: 'closeWindow', keystroke: { meta: true } }, 'settings')) !== '',
        ''
    );

    // shell.keys in a mod's page: take and record for every mod, the shell's keys changed with deckit.shell-keys alone,
    // each request refused as the shell's handle refuses one for a mod granted `granted`.
    const pageSent = []; // [channel, payload]
    const pageHeard = {};
    const KEYS = createKeys({
        channels: {
            bind: (declared) => ({
                send: (payload) => pageSent.push([declared.channel, payload]),
                on: (handler) => (pageHeard[declared.channel] = handler),
                invoke: async (payload) => pageSent.push([declared.channel, payload]) > 0,
            }),
        },
    });
    const requestFor =
        (granted) =>
        (name, { guards = [], signature }, send) => {
            const denied = guards.length && !guards.some((one) => granted.includes(one)) ? `a lacks ${guards}` : '';
            return REQUEST.requestOf(name, { denied, signature }, send);
        };
    const keysScope = makeScope();
    const plainKeys = KEYS.forScope(keysScope, { changes: false, request: requestFor([]) });
    const keeperKeys = KEYS.forScope(keysScope, { changes: true, request: requestFor([]) });
    check(
        'shell.keys takes and records for every mod, and lists, sets and resets the shell keys with deckit.shell-keys',
        Object.keys(plainKeys).join() === 'take,record' &&
            Object.keys(keeperKeys).join() === 'take,record,list,set,reset',
        [Object.keys(plainKeys), Object.keys(keeperKeys)]
    );
    const pageRecorded = [];
    const stopRecording = plainKeys.record((keystroke) => pageRecorded.push(keystroke));
    pageHeard['deckit-shell:key-recorded']({ id: 1, keystroke: { code: 'KeyZ', meta: true } });
    pageHeard['deckit-shell:key-recorded']({ id: 7, keystroke: { code: 'KeyY' } });
    stopRecording();
    pageHeard['deckit-shell:key-recorded']({ id: 1, keystroke: { code: 'KeyX' } });
    check(
        'a recording asks main, hears the keys told for it alone, and stops',
        JSON.stringify(pageSent) ===
            '[["deckit-shell:key-record",{"id":1}],["deckit-shell:key-stop-recording",{"id":1}]]' &&
            pageRecorded.length === 1 &&
            pageRecorded[0].code === 'KeyZ',
        { pageSent, pageRecorded }
    );
    plainKeys.record(() => {});
    keysScope.cut();
    check(
        "a recording stops as its lifecycle's scope is cut",
        JSON.stringify(pageSent.at(-1)) === '["deckit-shell:key-stop-recording",{"id":2}]',
        pageSent
    );

    // A chord taken for a mod with deckit.app-keys: a press runs what took it, and it is let go with its lifecycle.
    const tick = () => new Promise((resolve) => setImmediate(resolve));
    const takeScope = makeScope();
    const appKeys = KEYS.forScope(takeScope, { changes: false, request: requestFor(['deckit.app-keys']) });
    let ran = 0;
    pageSent.length = 0;
    const chord = await appKeys.take({ code: 'KeyK', alt: true }, () => ran++);
    const asked = pageSent.find(([name]) => name === 'deckit-shell:key-take')?.[1];
    check('a chord taken answers whether it is held', chord.held === true, chord);
    check(
        'a chord is asked of main with its keystroke and scope, in the app when none is named',
        asked?.keystroke.code === 'KeyK' && asked.keystroke.alt && !asked.keystroke.meta && asked.scope === 'app',
        asked
    );
    pageHeard['deckit-shell:key-pressed']({ id: asked.id });
    await tick();
    check('a press told to the page runs what took the chord', ran === 1, ran);
    pageHeard['deckit-shell:key-pressed']({ id: asked.id + 1 });
    await tick();
    check('a press of a chord not taken here runs nothing', ran === 1, ran);
    takeScope.cut();
    const released = pageSent.find(([name]) => name === 'deckit-shell:key-release')?.[1];
    check('a chord is let go once its lifecycle ends', released?.id === asked.id, pageSent);
    pageHeard['deckit-shell:key-pressed']({ id: asked.id });
    await tick();
    check('a chord let go runs nothing', ran === 1, ran);

    // What take refuses: a mod without the permission of its scope, then an argument of another type.
    const refusalOf = (promise) =>
        promise.then(
            () => 'fulfilled',
            (error) => `${error.stage} ${error.kind}`
        );
    pageSent.length = 0;
    const plainTakes = KEYS.forScope(makeScope(), { changes: false, request: requestFor([]) });
    check(
        'take refuses a mod granted nothing at call with NOT_PERMITTED, in the app and in every app',
        (await refusalOf(plainTakes.take({ code: 'KeyK' }, () => {}))) === 'call NOT_PERMITTED' &&
            (await refusalOf(plainTakes.take({ code: 'KeyK' }, () => {}, { scope: 'global' }))) ===
                'call NOT_PERMITTED',
        ''
    );
    check(
        'a mod with deckit.app-keys alone is refused a chord in global, before its arguments',
        (await refusalOf(appKeys.take(5, 5, { scope: 'global' }))) === 'call NOT_PERMITTED',
        ''
    );
    const mistyped = {
        'a keystroke of no code': () => appKeys.take({ meta: true }, () => {}),
        'a key of another type': () => appKeys.take({ code: 'KeyK', alt: 1 }, () => {}),
        'no function to run': () => appKeys.take({ code: 'KeyK' }, 'run'),
        'a scope of another type': () => appKeys.take({ code: 'KeyK' }, () => {}, { scope: 1 }),
    };
    for (const [what, call] of Object.entries(mistyped))
        check(
            `take with ${what} is refused at call with INVALID_ARGUMENT`,
            (await refusalOf(call())) === 'call INVALID_ARGUMENT',
            what
        );
    check('a take refused asks nothing of main', !pageSent.length, pageSent);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} key checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
