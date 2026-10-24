// The key map (deckit-shell/deckit/keymap) over a stand-in for the environment's keys, pages and messages: a key pressed in a
// page is answered at once, taken or not, by what the core last told of the bindings, the page's own keys, the
// shell's monitor and the page in front, the narrowest scope first, a field focused keeps a text editing chord, and
// recording takes every key. A key that works in every app, the app's or a mod's, is held as a hotkey on the chord it
// is bound to now, and lands, pressed, in the page that has the keyboard.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createKeymap } = await import(url('deckit-shell', 'deckit', 'keymap', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The environment: what captures a page's keys and watches it is kept, and the test presses keys and tells what
    // happens to a page.
    const capturing = new Map(); // page -> handler
    const watching = new Map(); // page -> watchers
    const tells = []; // [page, message]
    let heard = null;
    const hotkeys = []; // { keystroke, handler, held }, each hotkey asked for
    let refusing = false; // whether the system gives no hotkey
    let focused = null; // the page with the keyboard
    const keys = {
        capture: (page, handler) => capturing.set(page, handler),
        hotkey: (keystroke, handler) => {
            const hotkey = { keystroke, handler, held: !refusing };
            hotkeys.push(hotkey);
            return refusing ? null : () => (hotkey.held = false);
        },
        focused: () => focused,
    };
    const pages = {
        isGone: () => false,
        watch: (page, watchers) => watching.set(page, { ...(watching.get(page) || {}), ...watchers }),
    };
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    IPC.carry({ messages, pages }, { report: () => {} });

    const shell = { name: 'shell' }; // a page of the shell's, in front or not
    const mod = { name: 'mod a' }; // mod a's page
    const press = (page, code, modifiers = {}, type = 'keydown') =>
        capturing.get(page)({ type, code, meta: false, control: false, alt: false, shift: false, ...modifiers });
    const keystroke = (code, modifiers = {}) => ({
        code,
        meta: false,
        control: false,
        alt: false,
        shift: false,
        ...modifiers,
    });
    const binding = (fields) => ({
        id: `${fields.app ? '@app' : fields.owner}.${fields.action}`,
        active: true,
        editsText: false,
        scope: 'local',
        app: false,
        ...fields,
    });

    let bindingsChanged = null;
    const RUNNER = { handleEffect: (name, handler) => name === 'bindingsChanged' && (bindingsChanged = handler) };
    const IDENTITY = {
        modOf: (page) => (page === mod ? { id: 'a' } : null),
        pageOf: (id) => (id === 'a' ? mod : null),
        modFrom: () => ({ id: 'a' }),
        whenPageEnds: () => () => {},
    };
    const CATALOG = { mods: () => [{ id: 'a' }] };
    const LOG = { error: () => {}, warn: () => {} };
    const asked = [];
    const CORE = {
        request: (method, params) => {
            asked.push({ method, params });
            if (method === 'keymap/keystrokes') return Promise.resolve([keystroke('KeyL', { meta: true })]);
            if (method === 'keymap/record') return Promise.resolve({ pending: true });
            return Promise.resolve({ revision: 0, bindings: [] });
        },
    };
    const KEYMAP = createKeymap({ LOG, IDENTITY, CATALOG, RUNNER, CORE, pages, keys });
    KEYMAP.start();
    let inFront = shell;
    const monitored = [];
    KEYMAP.delegate({
        isActive: (page) => page === inFront,
        monitor: (page, pressed) => {
            monitored.push(pressed);
            return pressed.code === 'Escape';
        },
    });
    const ran = [];
    KEYMAP.register({ action: 'summon', key: 'Alt+Space', scope: 'app', run: (page) => ran.push(['summon', page]) });
    KEYMAP.register({ action: 'switch', key: 'Meta+K', run: (page) => ran.push(['switch', page]) });
    KEYMAP.register({ action: 'find', key: 'Meta+G', scope: 'app', run: (page) => ran.push(['find', page]) });
    KEYMAP.register({ action: 'jump', key: 'Ctrl+J', run: (page) => ran.push(['jump', page]) });
    KEYMAP.register({
        action: 'anywhere',
        key: 'Ctrl+Space',
        scope: 'global',
        run: (page) => ran.push(['any', page]),
    });
    const anywhere = (fields) =>
        binding({ action: 'anywhere', app: true, scope: 'global', chord: '⌃Space', ...fields });
    // As the core lists them, the narrowest scope first.
    bindingsChanged({
        revision: 1,
        bindings: [
            binding({
                action: 'copy',
                owner: 'a',
                editsText: true,
                keystroke: keystroke('KeyC', { meta: true }),
            }),
            binding({ action: 'go', owner: 'a', keystroke: keystroke('KeyG', { meta: true }) }),
            binding({ action: 'switch', app: true, keystroke: keystroke('KeyK', { meta: true }) }),
            binding({ action: 'summon', app: true, scope: 'app', keystroke: keystroke('Space', { alt: true }) }),
            binding({ action: 'find', app: true, scope: 'app', keystroke: keystroke('KeyG', { meta: true }) }),
            anywhere({ keystroke: keystroke('Space', { control: true }) }),
        ],
    });

    KEYMAP.listen(shell, { page: shell });
    KEYMAP.listen(mod, { page: mod, keys: [{ key: 'Meta+L', run: () => ran.push(['own']) }] });
    await tick();

    // A key that works anywhere in the app runs wherever a listened page has the keyboard, run with that page, and is
    // taken at once.
    check('a key that works anywhere in the app is taken', press(mod, 'Space', { alt: true }) === true, ran);
    check(
        'a key that works anywhere in the app runs with the page it landed in',
        ran.at(-1)?.[0] === 'summon' && ran.at(-1)?.[1] === mod,
        ran
    );
    // An app key runs only in the page in front.
    inFront = shell;
    check('an app key is taken in the page in front', press(shell, 'KeyK', { meta: true }) === true, ran);
    check('an app key is not taken in a page behind', press(mod, 'KeyK', { meta: true }) === false, ran);
    // A key released is no binding's.
    check('a key released is not taken', press(shell, 'KeyK', { meta: true }, 'keyup') === false, ran);
    // The shell's monitor looks first, and takes what it answers true for.
    check('the monitor takes its key', press(shell, 'Escape') === true, monitored);
    check('the monitor reads a keystroke without its type', !('type' in (monitored.at(-1) || {})), monitored);
    // The page's own keys are taken there first.
    check("a page's own key is taken", press(mod, 'KeyL', { meta: true }) === true && ran.at(-1)?.[0] === 'own', ran);
    // A mod's key goes to its page, in front; a field focused there keeps a text editing chord.
    inFront = mod;
    tells.length = 0;
    check("a mod's key is taken in its page", press(mod, 'KeyC', { meta: true }) === true, tells);
    check("a mod's key is told to its page", tells[0]?.[1]?.channel === 'deckit-shell:keymap-key', tells);
    // A narrower key on a chord wins where it works, and the wider one runs elsewhere.
    tells.length = 0;
    press(mod, 'KeyG', { meta: true });
    check("a mod's key in its page wins over one anywhere in the app", tells[0]?.[1]?.payload?.action === 'go', tells);
    check('a key anywhere in the app runs past the narrower', press(shell, 'KeyG', { meta: true }) === true, ran);
    check(
        'a key anywhere in the app runs where no narrower works',
        ran.at(-1)?.[0] === 'find' && ran.at(-1)?.[1] === shell,
        ran
    );
    heard.told(mod, { channel: 'deckit-shell:keymap-typing', payload: { on: true } });
    check('a focused field keeps a text editing chord', press(mod, 'KeyC', { meta: true }) === false, tells);
    // A replaced document forgets the field it had focused.
    watching.get(mod).ended();
    check('a replaced document forgets its field', press(mod, 'KeyC', { meta: true }) === true, tells);
    // Recording takes every key, a release too, and asks the core what a press comes to.
    heard.told(mod, { channel: 'deckit-shell:keymap-record', payload: { on: true } });
    check('recording takes a key released', press(mod, 'KeyX', {}, 'keyup') === true, asked);
    check('recording takes a key pressed', press(mod, 'KeyX') === true, asked);
    check(
        'recording asks the core of a press only',
        asked.filter(({ method }) => method === 'keymap/record').length === 1,
        asked
    );

    heard.told(mod, { channel: 'deckit-shell:keymap-record', payload: { on: false } });

    let threw = false;
    try {
        KEYMAP.register({ action: 'nowhere', key: 'Ctrl+N', scope: 'everywhere', run: () => {} });
    } catch {
        threw = true;
    }
    check('a key of no known scope is refused', threw, threw);
    // A key that works in every app tells the core its scope, and is held as a hotkey, which runs it with no page.
    const registered = asked.find(({ method, params }) => method === 'keymap/register' && params.action === 'anywhere');
    check('a key tells the core its scope', registered?.params.scope === 'global', registered);
    const first = hotkeys[0];
    check(
        'a system-wide key is held on its chord',
        hotkeys.length === 1 && first.held && first.keystroke.code === 'Space' && first.keystroke.control,
        hotkeys
    );
    first.handler();
    check('a hotkey runs its key with no page', ran.at(-1)?.[0] === 'any' && ran.at(-1)?.[1] === null, ran);
    heard.told(mod, { channel: 'deckit-shell:keymap-record', payload: { on: true } });
    const before = ran.length;
    const recorded = asked.filter(({ method }) => method === 'keymap/record').length;
    first.handler();
    const asks = asked.filter(({ method }) => method === 'keymap/record');
    check(
        'a hotkey pressed while a chord is recorded is recorded, and runs nothing',
        ran.length === before && asks.length === recorded + 1 && asks.at(-1).params.keystroke.code === 'Space',
        asks
    );
    heard.told(mod, { channel: 'deckit-shell:keymap-record', payload: { on: false } });
    // Bound to another chord, it is held there instead; the same chord again is held as it was.
    bindingsChanged({
        revision: 2,
        bindings: [anywhere({ chord: '⌃⌥Space', keystroke: keystroke('Space', { control: true, alt: true }) })],
    });
    check('a rebound key lets its old chord go', !first.held && hotkeys.length === 2 && hotkeys[1].held, hotkeys);
    bindingsChanged({
        revision: 3,
        bindings: [anywhere({ chord: '⌃⌥Space', keystroke: keystroke('Space', { control: true, alt: true }) })],
    });
    check('the same chord stays held', hotkeys.length === 2 && hotkeys[1].held, hotkeys);
    // Unbound, it is held nowhere; one the system does not give still runs in a page, as one anywhere in the app.
    bindingsChanged({ revision: 4, bindings: [anywhere({ active: false, chord: '', keystroke: null })] });
    check('an unbound key is held nowhere', hotkeys.length === 2 && !hotkeys[1].held, hotkeys);
    refusing = true;
    bindingsChanged({ revision: 5, bindings: [anywhere({ keystroke: keystroke('Space', { control: true }) })] });
    check('a hotkey the system refuses is asked for once', hotkeys.length === 3, hotkeys);
    check(
        'a refused hotkey runs in a page',
        press(mod, 'Space', { control: true }) === true && ran.at(-1)?.[1] === mod,
        ran
    );
    // Two keys on one chord hold it once, and a press runs the first the core lists.
    refusing = false;
    const onJ = { chord: '⌃J', keystroke: keystroke('KeyJ', { control: true }) };
    bindingsChanged({
        revision: 6,
        bindings: [
            anywhere({ ...onJ, id: '@app.anywhere' }),
            binding({ ...onJ, action: 'shared', owner: 'a', scope: 'global' }),
        ],
    });
    check('two keys on one chord hold it once', hotkeys.length === 4 && hotkeys[3].held, hotkeys);
    hotkeys[3].handler();
    check('a chord held once runs the first key on it', ran.at(-1)?.[0] === 'any' && ran.at(-1)?.[1] === null, ran);
    // A mod's key that works in every app is held as the app's are, and a press of it is told to its page.
    bindingsChanged({
        revision: 7,
        bindings: [
            binding({
                action: 'call',
                owner: 'a',
                scope: 'global',
                chord: '⌥K',
                keystroke: keystroke('KeyK', { alt: true }),
            }),
        ],
    });
    const call = hotkeys.at(-1);
    check("a mod's key that works in any app is held", call.held && call.keystroke.code === 'KeyK', hotkeys);
    tells.length = 0;
    call.handler();
    check(
        "a mod's hotkey is told to its page",
        tells[0]?.[1]?.channel === 'deckit-shell:keymap-key' && tells[0]?.[1]?.payload?.action === 'call',
        tells
    );
    // A hotkey pressed where a listened page has the keyboard lands there, so a narrower key on its chord wins.
    bindingsChanged({
        revision: 8,
        bindings: [binding({ ...onJ, action: 'jump', app: true }), anywhere({ ...onJ, id: '@app.anywhere' })],
    });
    const onShared = hotkeys.at(-1);
    inFront = shell;
    focused = shell;
    onShared.handler();
    check('a hotkey lands in the page with the keyboard', ran.at(-1)?.[0] === 'jump', ran);
    focused = mod;
    onShared.handler();
    check(
        'a hotkey runs past a narrower key that does not work there',
        ran.at(-1)?.[0] === 'any' && ran.at(-1)?.[1] === mod,
        ran
    );
    focused = null;
    onShared.handler();
    check('a hotkey with no page of the app having the keyboard runs with no page', ran.at(-1)?.[1] === null, ran);

    for (const line of failed) console.error(line);
    if (failed.length) process.exit(1);
    console.log(`ok: ${count} key map checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
