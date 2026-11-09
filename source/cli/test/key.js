// The shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, each held
// in the keymap by the key's name and held again as it changes, a chord a mod holds refused, the privileged permission
// main holds a page to before it lists or changes them, and a page's recording of its keys, for any page, as
// `shell.keys.record` asks it (shell/key/renderer). Exits 1 with a line for each check that failed. The packages are
// ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const KEY_PERMISSION = await import(url('deckit-shell', 'shell', 'key', 'model', 'permission.js'));
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
    const { createKeys } = await import(url('deckit-shell', 'shell', 'key', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The shell's keys, over a stand-in for what connect answers: `settings` holds deckit.shell-keys, `other` does not.
    const handlers = {};
    const state = { 'panel-keys': { closeWindow: { code: 'KeyB', meta: true }, gone: null, cycleWindows: 'none' } };
    const written = [];
    const holding = (id, granted) => ({ mod: { id }, granted });
    const runs = { settings: holding('settings', ['deckit.shell-keys']), other: holding('other', ['deckit.mods']) };
    const keymap = keymapOver();
    const recordedTold = []; // [page, payload], what main told a page that records
    keymap.hold({ code: 'KeyM', meta: true, alt: true }, () => true, { name: 'keymap' });
    const deckit = {
        channels: {
            bind: (declared) => ({
                handle: (handler) => (handlers[declared.channel] = handler),
                on: (handler) => (handlers[declared.channel] = handler),
                send: (page, payload) => recordedTold.push([page, payload]),
            }),
        },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                written.push(value);
                state[key] = value;
            },
        },
        keymap,
        log: { warn() {} },
        mods: { modOf: (page) => page.mod, runOf: (id) => runs[id] ?? null },
    };
    const [shellKeys] = KEY_PERMISSION.PERMISSIONS;
    check(
        'deckit.shell-keys is privileged',
        KEY_PERMISSION.PERMISSIONS.length === 1 &&
            shellKeys.id === 'deckit.shell-keys' &&
            shellKeys.privileged === true,
        KEY_PERMISSION.PERMISSIONS
    );
    const KEY = createKey({ deckit });
    const keyPresses = [];
    KEY.start((id, page) => keyPresses.push([id, page]) > 0);
    const channel = (name) => (payload, mod) => handlers[`deckit-shell:key-${name}`](payload, { mod });
    check(
        "each of the shell's keys holds its chord, by the key's name, a press of it that key's",
        keymap.holder({ code: 'KeyM', meta: true }) === 'Minimize Window' &&
            keymap.holder({ code: 'KeyB', meta: true }) === 'Close Window' &&
            keymap.holder({ code: 'KeyW', meta: true }) === null &&
            keymap.press({ mod: 'a' }, { code: 'KeyM', meta: true }) &&
            keyPresses[0]?.[0] === 'minimizeWindow' &&
            keyPresses[0][1].mod === 'a',
        { held: [...keymap.held.keys()], keyPresses }
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
            keymap.holder({ code: 'KeyS', meta: true, alt: true }) === 'Minimize Window' &&
            keymap.holder({ code: 'KeyM', meta: true }) === null,
        { set, state, held: [...keymap.held.keys()] }
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
        modHolds === 'REFUSED' &&
            state['panel-keys'].minimizeWindow.code === 'KeyS' &&
            keymap.holder({ code: 'KeyS', meta: true, alt: true }) === 'Minimize Window' &&
            keymap.holder({ code: 'KeyM', meta: true, alt: true }) === 'keymap',
        { modHolds, state }
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
            keymap.holder({ code: 'KeyB', meta: true }) === null,
        state
    );
    const reset = await channel('reset')({ id: 'closeWindow' }, 'settings');
    check(
        'a key reset has its default again, held, and the state keeps no chord for it',
        reset.keystroke.code === 'KeyW' &&
            !Object.hasOwn(state['panel-keys'], 'closeWindow') &&
            keymap.holder({ code: 'KeyW', meta: true }) === 'Close Window',
        { reset, state }
    );

    // Any mod's page records the keys pressed in it, until it stops.
    const recorder = { mod: 'other' };
    handlers['deckit-shell:key-record']({ id: 1 }, recorder);
    const recordedPress = keymap.press(recorder, { code: 'KeyS', meta: true, alt: true });
    keymap.press({ mod: 'a' }, { code: 'KeyQ' });
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
    keymap.press(recorder, { code: 'KeyR' });
    check('a stop of another recording stops nothing', recordedTold.length === 2, recordedTold);
    handlers['deckit-shell:key-stop-recording']({ id: 1 }, recorder);
    keymap.press(recorder, { code: 'KeyR' });
    check('a recording stopped is told nothing more', recordedTold.length === 2, recordedTold);
    check(
        'what is no key of the shell, or no keystroke, is refused',
        refusedTo(() => channel('set')({ id: 'gone', keystroke: null }, 'settings')) !== '' &&
            refusedTo(() => channel('set')({ id: 'closeWindow', keystroke: { meta: true } }, 'settings')) !== '',
        ''
    );

    // shell.keys in a mod's page: record for every mod, the shell's keys changed with deckit.shell-keys alone.
    const pageSent = []; // [channel, payload]
    const pageHeard = {};
    const KEYS = createKeys({
        channels: {
            bind: (declared) => ({
                send: (payload) => pageSent.push([declared.channel, payload]),
                on: (handler) => (pageHeard[declared.channel] = handler),
                invoke: async (payload) => pageSent.push([declared.channel, payload]),
            }),
        },
    });
    const keysScope = makeScope();
    const plainKeys = KEYS.forScope(keysScope, { changes: false });
    const keeperKeys = KEYS.forScope(keysScope, { changes: true });
    check(
        'shell.keys records for every mod, and lists, sets and resets the shell keys with deckit.shell-keys alone',
        Object.keys(plainKeys).join() === 'record' && Object.keys(keeperKeys).join() === 'record,list,set,reset',
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} key checks`);
    process.exit(0);
}

// The keymap as deckit holds it (deckit-shell/deckit/keymap/main.js), the chords a layer holds alone: a key pressed
// goes to the page's recording, then the monitors, then the chord's holder. `holder(keystroke)` is the name a chord
// is held by, or null.
function keymapOver() {
    const monitors = [];
    const held = new Map(); // a chord -> { name, handler }
    const recording = new Map(); // page -> handler
    const keyOf = ({ code, meta, control, alt, shift }) => JSON.stringify([code, !!meta, !!control, !!alt, !!shift]);
    const full = (keystroke) => ({ code: '', meta: false, control: false, alt: false, shift: false, ...keystroke });
    return {
        held,
        listen() {},
        monitor: (handler) => monitors.push(handler),
        hold: (keystroke, handler, { name }) => {
            const key = keyOf(keystroke);
            if (held.has(key)) throw Object.assign(new Error(`taken by ${held.get(key).name}`), { kind: 'REFUSED' });
            const one = { name, handler };
            held.set(key, one);
            return () => held.get(key) === one && held.delete(key);
        },
        record: (page, handler) => {
            recording.set(page, handler);
            return () => recording.get(page) === handler && recording.delete(page);
        },
        holder: (keystroke) => held.get(keyOf(keystroke))?.name ?? null,
        press: (page, keystroke) => {
            const pressed = full(keystroke);
            if (recording.has(page)) {
                recording.get(page)(pressed);
                return true;
            }
            if (monitors.some((monitor) => monitor(page, pressed))) return true;
            return !!held.get(keyOf(pressed))?.handler(page, pressed);
        },
    };
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
