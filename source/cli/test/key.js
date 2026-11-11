// The shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, each
// holding its chord in the key map by the key's name and held again as it changes, a chord a mod took refused, the
// permissions of the keys, the guard each channel of the keys declares, and a page's recording of its keys, for any
// page, as `shell.keys.record` asks it. Then `shell.keys` in a mod's page
// (shell/key/renderer): every member for every mod, `list`, `set` and `reset` refused NOT_PERMITTED without
// deckit.shell-keys and INVALID_ARGUMENT for an argument of another type, `record` throwing INVALID_ARGUMENT for no
// function; a chord taken for a mod with deckit.app-keys, a press of it running what took it and the chord
// let go once the lifecycle that took it ends; `take` refuses a mod without the permission of its scope at call with
// NOT_PERMITTED, before its arguments, and an argument of another type with INVALID_ARGUMENT. Then the person's files
// shown to them (shell/files): `shell.dialogs.chooseFolders` and `shell.reveal` for a mod granted nothing, an argument
// of another type refused INVALID_ARGUMENT, and main handing the environment what a mod's page asks, a path that is
// not absolute shown not at all, the channels guarded for a mod's page. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const KEY_PERMISSION = await import(url('deckit-sdk', 'shell', 'key', 'model', 'permission.js'));
    const CHANNEL = await import(url('deckit-sdk', 'deckit', 'channel', 'index.js'));
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
    const { createKeys } = await import(url('deckit-sdk', 'shell', 'key', 'renderer.js'));
    const { createFiles } = await import(url('deckit-shell', 'shell', 'files', 'main.js'));
    const { filesOf } = await import(url('deckit-sdk', 'shell', 'files', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const REQUEST = await import(url('deckit-sdk', 'deckit', 'request', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The shell's keys, over a stand-in for what connect answers and for the environment's keys: `settings` holds
    // deckit.shell-keys, `other` does not, and `keeper` deckit.app-keys.
    const handlers = {};
    const guards = {}; // a channel's name -> the guard its declaration names
    const state = { keys: { closeWindow: { code: 'KeyB', meta: true }, gone: null, cycleWindows: 'none' } };
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
            bind: (declared) => {
                guards[declared.channel] = declared.guard;
                return {
                    handle: (handler) => (handlers[declared.channel] = handler),
                    on: (handler) => (handlers[declared.channel] = handler),
                    send: (page, payload) =>
                        declared.channel === 'deckit-shell:key-recorded' && recordedTold.push([page, payload]),
                };
            },
        },
        log: { warn() {}, error() {} },
        pages: { onSandbox: () => () => {}, whenEnds: () => () => {} },
        mods: {
            modOf: (page) => page.mod,
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
    const KEPT = {
        read: (key, fallback) => state[key] ?? fallback,
        write: async (key, value) => {
            written.push(value);
            state[key] = value;
        },
    };
    const KEY = createKey({ deckit, state: KEPT, keys });
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
    const guarded = (name) => guards[`deckit-shell:key-${name}`];
    check(
        "the shell's keys are listed and changed by a mod with deckit.shell-keys",
        ['list', 'set', 'reset'].every((name) => guarded(name) === KEY_PERMISSION.SHELL_KEYS),
        guards
    );
    check(
        "a chord is taken by the permission its scope picks, released, recorded by any page, and a mod's page asks " +
            'whether the app is in front',
        guarded('take') === KEY_PERMISSION.permissionOf &&
            ['release', 'record', 'stop-recording'].every((name) => guarded(name) === CHANNEL.GUARD.ANY) &&
            guarded('active') === CHANNEL.GUARD.MOD,
        guards
    );
    const picked = [{ scope: 'app' }, { scope: 'global' }, { scope: 'other' }, { scope: 5 }, {}, null, 'global'].map(
        KEY_PERMISSION.permissionOf
    );
    check(
        "a chord's scope picks its permission, and what names none the scope app's",
        picked.join() ===
            'deckit.app-keys,system.global-keys,deckit.app-keys,deckit.app-keys,deckit.app-keys,' +
                'deckit.app-keys,deckit.app-keys',
        picked
    );
    const chosen = { code: 'KeyS', meta: true, alt: true };
    const set = await channel('set')({ id: 'minimizeWindow', keystroke: chosen }, 'settings');
    check(
        'a key set takes its chord, kept in the shell state, held again and the chord it had let go',
        set.keystroke.code === 'KeyS' &&
            state.keys.minimizeWindow.alt === true &&
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
            state.keys.minimizeWindow.code === 'KeyS' &&
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
    const elsewhere = refusedTo(() =>
        handlers['deckit-shell:key-take']({ id: 2, keystroke: full({ code: 'KeyJ' }), scope: 'other' }, keeper)
    );
    check(
        'a chord in a scope that names none is refused INVALID_ARGUMENT',
        elsewhere === 'INVALID_ARGUMENT',
        elsewhere
    );
    await channel('set')({ id: 'closeWindow', keystroke: null }, 'settings');
    check(
        'a key set to none has no chord, and holds none',
        KEY.chordOf('closeWindow') === '' &&
            state.keys.closeWindow === null &&
            holder({ code: 'KeyB', meta: true }) === null,
        state
    );
    const reset = await channel('reset')({ id: 'closeWindow' }, 'settings');
    check(
        'a key reset has its default again, held, and the state keeps no chord for it',
        reset.keystroke.code === 'KeyW' &&
            !Object.hasOwn(state.keys, 'closeWindow') &&
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
    // A document of the page's, as its window's content, is listened to as the page's: what the page records hears it.
    const content = { mod: null };
    KEY.listen(content, recorder);
    handlers['deckit-shell:key-record']({ id: 3 }, recorder);
    const contentPress = press(content, { code: 'KeyK', meta: true });
    check(
        "a page that records is told each key pressed in a document listened to as the page's, taken from it",
        contentPress === true &&
            recordedTold.length === 3 &&
            recordedTold[2][0] === recorder &&
            recordedTold[2][1].id === 3 &&
            recordedTold[2][1].keystroke.code === 'KeyK',
        recordedTold
    );
    handlers['deckit-shell:key-stop-recording']({ id: 3 }, recorder);
    check(
        'what is no key of the shell, or no keystroke, is refused',
        refusedTo(() => channel('set')({ id: 'gone', keystroke: null }, 'settings')) !== '' &&
            refusedTo(() => channel('set')({ id: 'closeWindow', keystroke: { meta: true } }, 'settings')) !== '',
        ''
    );

    // shell.keys in a mod's page: every member for every mod, the shell's keys changed with deckit.shell-keys alone,
    // each request refused as the shell's handle refuses one for a mod granted `granted`.
    const pageSent = []; // [channel, payload]
    const pageHeard = {};
    const PAGE_CHANNELS = {
        bind: (declared) => ({
            guard: declared.guard,
            send: (payload) => pageSent.push([declared.channel, payload]),
            on: (handler) => (pageHeard[declared.channel] = handler),
            invoke: async (payload) => pageSent.push([declared.channel, payload]) > 0,
        }),
    };
    const KEYS = createKeys({ channels: PAGE_CHANNELS });
    const requestFor = (granted) => (name, asked, send) =>
        REQUEST.requestOf(name, { ...asked, mod: 'a', granted }, send);
    const keysScope = makeScope();
    const refusalOf = (promise) =>
        promise.then(
            () => 'fulfilled',
            (error) => `${error.stage} ${error.kind}`
        );
    const thrownBy = (call) => {
        try {
            call();
            return 'answered';
        } catch (error) {
            return `${error.stage} ${error.kind}`;
        }
    };
    const plainKeys = KEYS.forScope(keysScope, { request: requestFor([]) });
    const keeperKeys = KEYS.forScope(keysScope, { request: requestFor(['deckit.shell-keys']) });
    check(
        'shell.keys has every member for every mod',
        Object.keys(plainKeys).join() === 'take,record,list,set,reset' &&
            Object.keys(keeperKeys).join() === 'take,record,list,set,reset',
        [Object.keys(plainKeys), Object.keys(keeperKeys)]
    );
    check(
        'list, set and reset refuse a mod without deckit.shell-keys at call with NOT_PERMITTED, before its arguments',
        (await refusalOf(plainKeys.list())) === 'call NOT_PERMITTED' &&
            (await refusalOf(plainKeys.set(5))) === 'call NOT_PERMITTED' &&
            (await refusalOf(plainKeys.reset())) === 'call NOT_PERMITTED' &&
            !pageSent.length,
        pageSent
    );
    check(
        'set and reset refuse an argument of another type at call with INVALID_ARGUMENT',
        (await refusalOf(keeperKeys.set(5))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(keeperKeys.set('closeWindow', { meta: true }))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(keeperKeys.reset())) === 'call INVALID_ARGUMENT' &&
            !pageSent.length,
        pageSent
    );
    await keeperKeys.set('closeWindow', { code: 'KeyW', meta: true });
    await keeperKeys.set('closeWindow');
    check(
        'set asks main for the keystroke, each modifier left out not held, and for none where it is left out',
        JSON.stringify(pageSent) ===
            '[["deckit-shell:key-set",{"id":"closeWindow","keystroke":' +
                '{"code":"KeyW","meta":true,"control":false,"alt":false,"shift":false}}],' +
                '["deckit-shell:key-set",{"id":"closeWindow","keystroke":null}]]',
        pageSent
    );
    pageSent.length = 0;
    check(
        'record throws its refusal at call with INVALID_ARGUMENT for no function, and asks nothing of main',
        thrownBy(() => plainKeys.record('no')) === 'call INVALID_ARGUMENT' && !pageSent.length,
        pageSent
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
    const appKeys = KEYS.forScope(takeScope, { request: requestFor(['deckit.app-keys']) });
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
    pageSent.length = 0;
    const plainTakes = KEYS.forScope(makeScope(), { request: requestFor([]) });
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
    check(
        'a scope that names none refuses a mod without deckit.app-keys NOT_PERMITTED, before its arguments',
        (await refusalOf(plainTakes.take(5, 5, { scope: 'other' }))) === 'call NOT_PERMITTED',
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

    // shell.dialogs and shell.reveal in a mod's page, for a mod granted nothing.
    const files = filesOf({ channels: PAGE_CHANNELS, request: requestFor([]) });
    const filesMistyped = {
        'reveal with a number': () => files.reveal(5),
        'reveal with its path left out': () => files.reveal(),
        'dialogs.chooseFolders with multiple of another type': () => files.dialogs.chooseFolders({ multiple: 'yes' }),
        'dialogs.chooseFolders with options of another type': () => files.dialogs.chooseFolders(5),
    };
    for (const [what, call] of Object.entries(filesMistyped))
        check(
            `${what} is refused at call with INVALID_ARGUMENT`,
            (await refusalOf(call())) === 'call INVALID_ARGUMENT',
            what
        );
    check('a request of the files refused asks nothing of main', !pageSent.length, pageSent);
    await files.reveal('/a');
    await files.dialogs.chooseFolders();
    await files.dialogs.chooseFolders({ multiple: true, title: 'T' });
    check(
        'reveal and dialogs.chooseFolders are asked of main for a mod granted nothing, one folder unless multiple',
        JSON.stringify(pageSent) ===
            '[["deckit-shell:files-reveal",{"path":"/a"}],["deckit-shell:files-choose-folders",{"multiple":false}],' +
                '["deckit-shell:files-choose-folders",{"multiple":true,"title":"T"}]]',
        pageSent
    );

    // Main hands the environment what a mod's page asks, the channels guarded for a mod's page.
    const filesHandlers = {};
    const filesGuards = {};
    const shown = []; // what the environment was handed
    createFiles({
        deckit: {
            channels: {
                bind: (declared) => {
                    filesGuards[declared.channel] = declared.guard;
                    return { handle: (handler) => (filesHandlers[declared.channel] = handler) };
                },
            },
        },
        dialogs: { chooseFolders: async (options) => shown.push(['chooseFolders', options]) && ['/f'] },
        reveal: (path) => shown.push(['reveal', path]),
    }).start();
    const revealed = await filesHandlers['deckit-shell:files-reveal']({ path: '/a' }, { mod: 'a' });
    const relative = await filesHandlers['deckit-shell:files-reveal']({ path: 'a' }, { mod: 'a' });
    const folders = await filesHandlers['deckit-shell:files-choose-folders'](
        { multiple: true, title: 'T', message: 'M' },
        { mod: 'a' }
    );
    check(
        "a mod's page has an absolute path shown, answered nothing, and the folders it asks the person for",
        revealed === undefined &&
            relative === undefined &&
            JSON.stringify(folders) === '["/f"]' &&
            JSON.stringify(shown) ===
                '[["reveal","/a"],["chooseFolders",{"title":"T","buttonLabel":"Choose","message":"M","multiple":true}]]',
        { revealed, relative, folders, shown }
    );
    check(
        "the files are shown for a mod's page alone",
        Object.keys(filesGuards).length === 2 &&
            Object.values(filesGuards).every((guard) => guard === CHANNEL.GUARD.MOD),
        filesGuards
    );

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
