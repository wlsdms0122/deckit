// The key map (deckit-shell/shell/key/main.js) over a stand-in for the environment's keys and messages and for what
// connect answers: a mod with deckit.app-keys takes a chord in every page listened to, every mod's page among them, one
// with system.global-keys takes it as a system hotkey too, and a press is told to the page of the mod that took it. A
// chord is one mod's at a time, a mod without the permission for the scope is refused, and a chord is let go when
// released or when the mod's page ends. A monitor looks at each key pressed in a page listened to before the chords,
// and what it takes runs none. The shell's own keys are in the same table: a mod's take of one's chord is refused with
// the key's name, and it runs only for a key the page did not handle, after the page had it. Each chord told to a mod
// is heard by its id. A page that records is handed each key pressed in it before anything else, until it stops or
// ends. A mod's page asks whether the app is in front. Exits 1 with a line for each check that failed. The packages
// are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The environment: what captures a page's keys and what hears the keys it did not handle are kept, and the test
    // presses keys and reads what main tells a page.
    const capturing = new Map(); // page -> handler
    const passing = new Map(); // page -> handler of the keys it did not handle
    const tells = []; // [page, message]
    let heard = null;
    const hotkeys = []; // { keystroke, handler, held }, each hotkey asked for
    let refusing = false; // whether the system gives no hotkey
    const keys = {
        capture: (page, handler) => capturing.set(page, handler),
        unhandled: (page, handler) => passing.set(page, handler),
        hotkey: (keystroke, handler) => {
            const hotkey = { keystroke, handler, held: !refusing };
            hotkeys.push(hotkey);
            return refusing ? null : () => (hotkey.held = false);
        },
        focused: () => focused,
    };
    let focused = null; // the page that has the keyboard, or null while another app is in front
    const pages = { isGone: () => false, watch: () => {} };
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    // The router holds each channel to its guard by the mod a page runs, as `mods` below says.
    IPC.carry({ messages, pages }, { report: () => {}, identify: (page) => mods.get(page) ?? null });

    // Mod a holds deckit.app-keys, mod g system.global-keys, mod n neither, mod s deckit.shell-keys; the shell's page
    // runs no mod.
    const shell = { name: 'shell' };
    const a = { name: 'mod a' };
    const g = { name: 'mod g' };
    const n = { name: 'mod n' };
    const s = { name: 'mod s' };
    const mods = new Map([
        [a, { id: 'a', granted: ['deckit.app-keys'] }],
        [g, { id: 'g', granted: ['system.global-keys'] }],
        [n, { id: 'n', granted: [] }],
        [s, { id: 's', granted: ['deckit.shell-keys'] }],
    ]);
    const ends = new Map(); // page -> what its end calls
    const end = (page) => [...(ends.get(page) || [])].forEach((undo) => undo({ replaced: true }));
    const sandboxed = []; // what hears each mod's sandbox page as it is made
    const warned = [];
    const errors = [];
    const deckit = {
        channels: IPC.layerChannels,
        pages: {
            onSandbox: (listener) => sandboxed.push(listener),
            whenEnds: (page, undo) => {
                const undos = ends.get(page) || new Set();
                ends.set(page, undos.add(undo));
                return () => undos.delete(undo);
            },
        },
        mods: {
            modOf: (page) => mods.get(page)?.id || null,
            runOf: (id) => [...mods.values()].find((mod) => mod.id === id) ?? null,
        },
        log: { warn: (line) => warned.push(line), error: (line) => errors.push(line) },
    };
    const keyPresses = []; // [id, page], each press of one of the shell's keys
    let keyTakes = true;
    const state = { read: (_key, fallback) => fallback, write: async () => {} };
    const KEY = createKey({ deckit, state, keys });
    KEY.start((id, page) => keyPresses.push([id, page]) > 0 && keyTakes);
    KEY.listen(shell);
    for (const page of [a, g, n]) for (const listener of sandboxed) listener(page);
    const chords = []; // the mods each chord told was heard for
    KEY.onChord((mod) => chords.push(mod));

    const keystroke = (code, modifiers = {}) => ({
        code,
        meta: false,
        control: false,
        alt: false,
        shift: false,
        ...modifiers,
    });
    const press = (page, code, modifiers = {}, type = 'keydown') =>
        capturing.get(page)({ type, ...keystroke(code, modifiers) });
    const pass = (page, code, modifiers = {}) => passing.get(page)(keystroke(code, modifiers));
    const ask = async (page, channel, payload) => {
        const answer = await heard.asked(page, { channel, payload });
        return answer.error ? { error: answer.error } : { value: answer.value };
    };
    const take = (page, id, chord, scope) => ask(page, 'deckit-shell:key-take', { id, keystroke: chord, scope });
    const release = (page, id) => heard.told(page, { channel: 'deckit-shell:key-release', payload: { id } });
    const told = () => tells.filter(([, message]) => message.channel === 'deckit-shell:key-pressed');
    const recorded = () => tells.filter(([, message]) => message.channel === 'deckit-shell:key-recorded');
    const record = (page, channel, id) => heard.told(page, { channel: `deckit-shell:key-${channel}`, payload: { id } });

    // A chord taken in the app works in every page listened to, and the press is told to the mod that took it.
    const altK = keystroke('KeyK', { alt: true });
    const taken = await take(a, 1, altK, 'app');
    check('a mod with deckit.app-keys takes a chord in the app', taken.value === true, taken);
    check('a chord in the app holds no hotkey', hotkeys.length === 0, hotkeys);
    check('a chord taken is taken in a page of the shell', press(shell, 'KeyK', { alt: true }) === true, tells);
    check("a chord taken is taken in another mod's page", press(n, 'KeyK', { alt: true }) === true, tells);
    check(
        'a press is told to the page of the mod that took it, by the id it took it under',
        told().length === 2 && told().every(([page, message]) => page === a && message.payload.id === 1),
        told()
    );
    check('each chord told is heard by the id of its mod', chords.join() === 'a,a', chords);
    check('a key released is not taken', press(shell, 'KeyK', { alt: true }, 'keyup') === false, tells);
    check('a chord no mod took is not taken', press(shell, 'KeyJ', { alt: true }) === false, tells);
    tells.length = 0;
    check(
        'a chord a mod took does not run for a key the page did not handle',
        pass(n, 'KeyK', { alt: true }) === false && !told().length,
        told()
    );

    // A monitor looks at each key pressed before the chords taken, and what it takes runs no chord.
    const looked = []; // [page, keystroke]
    let takes = true;
    const off = KEY.monitor((page, pressed) => looked.push([page, pressed]) && takes);
    tells.length = 0;
    check('a key a monitor takes is taken', press(n, 'KeyK', { alt: true }) === true, looked);
    check(
        'a monitor is handed the page it was pressed in and the keystroke',
        looked.length === 1 &&
            looked[0][0] === n &&
            JSON.stringify(looked[0][1]) === JSON.stringify(keystroke('KeyK', { alt: true })),
        looked
    );
    check('a key a monitor takes runs no chord', told().length === 0, told());
    takes = false;
    check('a key a monitor leaves goes to the chords', press(n, 'KeyK', { alt: true }) === true, told());
    check('a key a monitor leaves runs the chord taken', told().length === 1, told());
    looked.length = 0;
    press(n, 'KeyK', { alt: true }, 'keyup');
    check('a monitor looks at a key pressed, not released', looked.length === 0, looked);
    off();
    takes = true;
    press(shell, 'KeyJ', { alt: true });
    check('a monitor off looks no more', looked.length === 0, looked);
    const offThrows = KEY.monitor(() => {
        throw new Error('broken');
    });
    tells.length = 0;
    check(
        'a monitor that throws takes nothing, and is logged',
        press(n, 'KeyK', { alt: true }) === true && told().length === 1 && errors.length === 1,
        errors
    );
    offThrows();

    // The permission is the scope's, and a chord is one mod's at a time.
    const global = await take(a, 2, keystroke('KeyG', { meta: true }), 'global');
    check(
        'a mod without system.global-keys takes no chord in every app',
        /system\.global-keys/.test(global.error?.message),
        global
    );
    const none = await take(n, 1, keystroke('KeyN', { meta: true }), 'app');
    check(
        'a mod without deckit.app-keys takes no chord in the app',
        /deckit\.app-keys/.test(none.error?.message),
        none
    );
    const shellTakes = await take(shell, 1, keystroke('KeyS', { meta: true }), 'app');
    check('a page that runs no mod takes no chord', !!shellTakes.error, shellTakes);
    const scope = await take(a, 3, keystroke('KeyL', { meta: true }), 'local');
    check('a chord is taken in the app or in every app only', /not local/.test(scope.error?.message), scope);
    const twice = await take(g, 1, altK, 'global');
    check('a chord another mod took is refused', /taken by a/.test(twice.error?.message), twice);
    check('a chord refused holds no hotkey', hotkeys.length === 0, hotkeys);
    const nameless = await take(a, 4, keystroke(''), 'app');
    check('a chord names its key', !!nameless.error, nameless);

    // A chord taken in every app is held as a hotkey, and works in every page of the app too.
    tells.length = 0;
    const space = keystroke('Space', { control: true });
    const anywhere = await take(g, 1, space, 'global');
    check('a mod with system.global-keys takes a chord in every app', anywhere.value === true, anywhere);
    const hotkey = hotkeys[0];
    check(
        'a chord in every app is held as a hotkey',
        hotkeys.length === 1 && hotkey.held && hotkey.keystroke.code === 'Space' && hotkey.keystroke.control,
        hotkeys
    );
    hotkey.handler();
    check(
        'a hotkey pressed is told to the mod that took it',
        told()[0]?.[0] === g && told()[0][1].payload.id === 1,
        told()
    );
    check('a chord in every app is taken in a page too', press(a, 'Space', { control: true }) === true, tells);
    check('the press in a page is told to that mod too', told()[1]?.[0] === g, told());
    check('a hotkey told is heard by the id of its mod', chords.slice(-2).join() === 'g,g', chords);

    // Released, a chord is held nowhere and taken nowhere, and another mod may take it.
    release(g, 1);
    check('a chord released lets its hotkey go', !hotkey.held, hotkeys);
    check('a chord released is not taken in a page', press(a, 'Space', { control: true }) === false, tells);
    release(a, 1);
    check('a chord released in the app is not taken', press(shell, 'KeyK', { alt: true }) === false, tells);
    const again = await take(g, 2, altK, 'global');
    check("a chord let go is another mod's to take", again.value === true, again);

    // One the system does not give still works in every page of the app, and is told so.
    refusing = true;
    const refused = await take(g, 3, keystroke('KeyR', { control: true }), 'global');
    check('a chord the system does not give answers false', refused.value === false, refused);
    check(
        'a chord the system does not give is logged',
        warned.some((line) => /did not give/.test(line)),
        warned
    );
    tells.length = 0;
    check(
        'a chord the system does not give works in a page of the app',
        press(shell, 'KeyR', { control: true }) === true && told()[0]?.[0] === g,
        told()
    );

    // A page that ends lets every chord its mod took go.
    const onK = hotkeys.find((one) => one.keystroke.code === 'KeyK');
    check('a chord taken again is held again', onK?.held === true, hotkeys);
    end(g);
    check('a page that ends lets its hotkeys go', !onK.held, hotkeys);
    check('a page that ends lets its chords in the app go', press(shell, 'KeyR', { control: true }) === false, tells);
    tells.length = 0;
    onK.handler();
    check('a hotkey let go tells no page', told().length === 0, told());

    // One of the shell's keys: in the one table, held before any mod takes its chord, run for a key the page did not
    // handle alone.
    const onHeld = await take(a, 9, keystroke('KeyM', { meta: true }), 'app');
    check(
        "a mod's take of the chord of one of the shell's keys is refused, REFUSED, with the key's name",
        onHeld.error?.kind === 'REFUSED' && /taken by Minimize Window/.test(onHeld.error.message),
        onHeld
    );
    tells.length = 0;
    check(
        "the chord of one of the shell's keys is left to the page before it has the key",
        press(n, 'KeyM', { meta: true }) === false && !keyPresses.length,
        keyPresses
    );
    check(
        "a key the page did not handle of the chord of one of the shell's keys that takes it is taken",
        pass(n, 'KeyM', { meta: true }) === true,
        ''
    );
    check(
        'the press is handed the key and the page, and no mod is told',
        keyPresses.length === 1 && keyPresses[0][0] === 'minimizeWindow' && keyPresses[0][1] === n && !told().length,
        keyPresses
    );
    keyTakes = false;
    check("a key one of the shell's keys leaves goes on in the app", pass(n, 'KeyM', { meta: true }) === false, '');
    check('a key no chord is held for is not taken after the page', pass(n, 'KeyJ', { meta: true }) === false, '');
    await ask(s, 'deckit-shell:key-set', { id: 'minimizeWindow', keystroke: null });
    const afterHeld = await take(a, 11, keystroke('KeyM', { meta: true }), 'app');
    check("a chord one of the shell's keys let go is a mod's to take", afterHeld.value === true, afterHeld);

    // A page that records: each key pressed in it is handed over first, and taken, until it stops or ends.
    const seenByMonitor = [];
    const offMonitor = KEY.monitor((page, pressed) => seenByMonitor.push(pressed) && false);
    tells.length = 0;
    record(n, 'record', 1);
    check(
        'a key pressed in a page that records is told to it under its id and taken, before monitors and chords',
        press(n, 'KeyM', { meta: true }) === true &&
            recorded().length === 1 &&
            recorded()[0][0] === n &&
            recorded()[0][1].payload.id === 1 &&
            recorded()[0][1].payload.keystroke.code === 'KeyM' &&
            recorded()[0][1].payload.keystroke.meta &&
            !seenByMonitor.length &&
            !told().length,
        { recorded: recorded(), seenByMonitor, told: told() }
    );
    check(
        'a key pressed in another page is not recorded',
        press(shell, 'KeyM', { meta: true }) === true && recorded().length === 1 && told().length === 1,
        recorded()
    );
    record(n, 'stop-recording', 2);
    press(n, 'KeyQ');
    check('a stop of another recording stops nothing', recorded().length === 2, recorded());
    record(n, 'stop-recording', 1);
    tells.length = 0;
    press(n, 'KeyM', { meta: true });
    check('a recording stopped is told nothing', !recorded().length && told().length === 1, recorded());
    record(n, 'record', 3);
    end(n);
    press(n, 'KeyQ');
    check('a recording ends with its page', !recorded().length, recorded());
    offMonitor();

    // Any mod's page asks whether the app is in front; a page that runs no mod is refused.
    const front = [];
    for (const page of [null, shell]) {
        focused = page;
        front.push((await ask(n, 'deckit-shell:key-active', {})).value);
    }
    check('a mod asks whether the app is in front', front[0] === false && front[1] === true, front);
    check(
        'a page that runs no mod asks nothing',
        (await ask(shell, 'deckit-shell:key-active', {})).error?.kind === 'REFUSED',
        await ask(shell, 'deckit-shell:key-active', {})
    );

    for (const line of failed) console.error(line);
    if (failed.length) process.exit(1);
    console.log(`ok: ${count} key checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
