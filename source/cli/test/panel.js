// The panel's list order (deckit-shell/shell/panel/model/list-order): the mods the person placed first, as placed, the
// rest as deckit lists them, and a drag that moves the ids it names among the places they held. The Dock's items
// (model/dock): those kept, then those running. Where the frame's parts are (model/layout) at a panel's size. And the
// shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, each held in
// the keymap by the key's name and held again as it changes, a chord a mod holds refused, the privileged permission
// main holds a page to before it lists or changes them, and a page's recording of its keys, for any page, as
// `shell.keys.record` asks it (shell/key/renderer). And the
// panel (shell/panel/main) over a stand-in for what connect answers: the manifest fields it names, a mod in front as a
// mod with deckit.mods asks, launched when it does not run, the mods that load in the Dock, the list and its order,
// and no bundle that does not, what deckit refuses to keep, the shell's keys as the chords they hold are pressed, and
// Escape as the keymap's monitor tells it. Exits 1 with a line
// for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LIST_ORDER = await import(url('deckit-shell', 'shell', 'panel', 'model', 'list-order.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'panel', 'model', 'layout.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'panel', 'model', 'dock.js'));
    const KEY_PERMISSION = await import(url('deckit-shell', 'shell', 'key', 'model', 'permission.js'));
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
    const { createPanel } = await import(url('deckit-shell', 'shell', 'panel', 'main.js'));
    const { createKeys } = await import(url('deckit-shell', 'shell', 'key', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const sorted = LIST_ORDER.sorted(['a', 'b', 'c', 'd'], ['c', 'x', 'a']).join();
    check('those placed come first, as placed, then the rest as listed', sorted === 'c,a,b,d', sorted);
    const arranged = LIST_ORDER.arranged(['a', 'b', 'c', 'd'], ['d', 'b', 'x', 'd']).join();
    check('the ids named move among the places they held, the rest stay put', arranged === 'a,d,c,b', arranged);

    const ids = ['a', 'b', 'c', 'd', 'e'];
    const docked = DOCK.items(ids, { pinned: new Set(['d', 'b']), running: new Set(['b', 'c', 'e']) });
    check(
        'the Dock holds the mods kept, in the list order, then those running that are not kept',
        JSON.stringify(docked) ===
            JSON.stringify([
                { id: 'b', pinned: true, running: true },
                { id: 'd', pinned: true, running: false },
                { id: 'c', pinned: false, running: true },
                { id: 'e', pinned: false, running: true },
            ]),
        docked
    );
    const unkept = DOCK.items(ids, { pinned: new Set(['b']), running: new Set(['c']) }).map(({ id }) => id);
    check('a mod taken out of the Dock that does not run leaves it', unkept.join() === 'b,c', unkept);
    const kept = DOCK.items(ids, { pinned: new Set(['a', 'c']), running: new Set(['c']) }).map(({ id }) => id);
    check('a running mod kept is listed once, where it is kept', kept.join() === 'a,c', kept);

    const slot = { top: 100, bottom: 10 };
    const open = LAYOUT.laidOut({ size: { width: 1000, height: 700 }, width: 300, collapsed: false, slot });
    check(
        'open, the content starts past the card and the handle stands over its edge',
        open.content.x === 316 && open.content.width === 684 && open.handle.x === 314 && open.handle.y === 318,
        open
    );
    check(
        'the slot takes the card below the list, as tall as the panel lets it',
        JSON.stringify(open.sidebar) === JSON.stringify({ x: 9, y: 109, width: 298, height: 572 }),
        open.sidebar
    );
    const narrow = LAYOUT.laidOut({ size: { width: 640, height: 700 }, width: 400, collapsed: false, slot });
    check('a narrow panel draws the sidebar narrower, leaving the mod room', narrow.drawn === 280, narrow.drawn);
    const titled = { height: 52, controlsWidth: 80 };
    const folded = LAYOUT.laidOut({
        size: { width: 1000, height: 700 },
        titleBar: titled,
        width: 300,
        collapsed: true,
        slot,
    });
    check(
        "folded, the content takes the panel and the frame covers only the window's buttons",
        folded.content.x === 0 &&
            LAYOUT.barRoom(titled) === 44 &&
            JSON.stringify(folded.obscured) === JSON.stringify({ x: 0, y: 0, width: 80, height: 52 }),
        folded
    );

    // The shell's keys, over a stand-in for what connect answers: `settings` holds deckit.shell-keys, `other` does not.
    const handlers = {};
    const state = { 'panel-keys': { back: { code: 'KeyB', meta: true }, gone: null, forward: 'none' } };
    const written = [];
    const holding = (id, permissions) => ({ mod: { id, permissions: permissions.map((one) => ({ id: one })) } });
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
        keymap.holder({ code: 'Backslash', meta: true }) === 'Toggle Sidebar' &&
            keymap.holder({ code: 'KeyB', meta: true }) === 'Back to the Previous Mod' &&
            keymap.holder({ code: 'BracketLeft', meta: true, control: true }) === null &&
            keymap.press({ mod: 'a' }, { code: 'Backslash', meta: true }) &&
            keyPresses[0]?.[0] === 'toggleSidebar' &&
            keyPresses[0][1].mod === 'a',
        { held: [...keymap.held.keys()], keyPresses }
    );
    const listed = channel('list')({}, 'settings');
    check(
        "the shell's keys are listed in order, each with its default and the chord set for it, as kept",
        listed.map(({ id }) => id).join() === 'toggleSidebar,back,forward' &&
            JSON.stringify(listed[1].keystroke) ===
                JSON.stringify({ code: 'KeyB', meta: true, control: false, alt: false, shift: false }) &&
            listed[1].defaultKeystroke.code === 'BracketLeft' &&
            listed[2].keystroke.code === 'BracketRight',
        listed
    );
    check(
        'a chord reads as a person reads it',
        KEY.chordOf('toggleSidebar') === '⌘\\' && KEY.chordOf('forward') === '⌃⌘]' && KEY.chordOf('gone') === '',
        [KEY.chordOf('toggleSidebar'), KEY.chordOf('forward')]
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
            refusedTo(() => channel('set')({ id: 'back', keystroke: null }, 'other')) === 'NOT_PERMITTED' &&
            refusedTo(() => channel('reset')({ id: 'back' }, 'other')) === 'NOT_PERMITTED',
        ''
    );
    const chosen = { code: 'KeyS', meta: true, alt: true };
    const set = await channel('set')({ id: 'toggleSidebar', keystroke: chosen }, 'settings');
    check(
        'a key set takes its chord, kept in the shell state, held again and the chord it had let go',
        set.keystroke.code === 'KeyS' &&
            state['panel-keys'].toggleSidebar.alt === true &&
            keymap.holder({ code: 'KeyS', meta: true, alt: true }) === 'Toggle Sidebar' &&
            keymap.holder({ code: 'Backslash', meta: true }) === null,
        { set, state, held: [...keymap.held.keys()] }
    );
    const modHolds = await channel('set')(
        { id: 'toggleSidebar', keystroke: { code: 'KeyM', meta: true, alt: true } },
        'settings'
    ).then(
        () => '',
        (error) => error.kind
    );
    check(
        'a chord another holds is refused, and the key keeps the chord it had',
        modHolds === 'REFUSED' &&
            state['panel-keys'].toggleSidebar.code === 'KeyS' &&
            keymap.holder({ code: 'KeyS', meta: true, alt: true }) === 'Toggle Sidebar' &&
            keymap.holder({ code: 'KeyM', meta: true, alt: true }) === 'keymap',
        { modHolds, state }
    );
    const taken = await channel('set')({ id: 'forward', keystroke: { code: 'KeyB', meta: true } }, 'settings').then(
        () => '',
        (error) => error.kind
    );
    check('a chord another of the shell keys has is refused', taken === 'REFUSED', taken);
    await channel('set')({ id: 'back', keystroke: null }, 'settings');
    check(
        'a key set to none has no chord, and holds none',
        KEY.chordOf('back') === '' &&
            state['panel-keys'].back === null &&
            keymap.holder({ code: 'KeyB', meta: true }) === null,
        state
    );
    const reset = await channel('reset')({ id: 'back' }, 'settings');
    check(
        'a key reset has its default again, held, and the state keeps no chord for it',
        reset.keystroke.code === 'BracketLeft' &&
            !Object.hasOwn(state['panel-keys'], 'back') &&
            keymap.holder({ code: 'BracketLeft', meta: true, control: true }) === 'Back to the Previous Mod',
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
            refusedTo(() => channel('set')({ id: 'back', keystroke: { meta: true } }, 'settings')) !== '',
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

    // The panel: `notes` has a view and does not run, `switcher` holds deckit.mods and has no view.
    const panel = panelOver(createPanel, {
        mods: [
            { id: 'notes', name: 'Notes', uses: {} },
            { id: 'switcher', name: 'Switcher', uses: {} },
        ],
        fields: { notes: { view: {} }, switcher: {} },
        managers: ['switcher'],
    });
    check(
        'the panel names the manifest fields it reads before deckit starts',
        panel.named.join() === 'view,icon,keywords',
        panel.named
    );
    let started = '';
    try {
        panel.PANEL.start();
    } catch (error) {
        started = error.message;
    }
    check('the panel starts on what connect answers', started === '', started);
    const opening = panel.ask('open', { id: 'notes' }, 'switcher');
    await opening;
    check(
        'a mod with deckit.mods puts a mod in front, which launches as it does not run',
        panel.launched.join() === 'notes' && panel.shown.length === 1,
        { launched: panel.launched, shown: panel.shown }
    );
    const refusals = [
        await panel.ask('open', { id: 'notes' }, 'notes').then(
            () => '',
            (error) => error.kind || error.message
        ),
        await panel.ask('open', { id: 'switcher' }, 'switcher').then(
            () => '',
            (error) => error.message
        ),
    ];
    check(
        'a mod without deckit.mods is refused, and so is a mod with nothing to show',
        refusals[0] === 'NOT_PERMITTED' && refusals[1] !== '' && panel.launched.length === 1,
        refusals
    );

    const first = panelOver(createPanel, {
        mods: ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), uses: {} })),
        fields: { a: { view: {} }, b: { view: {} }, c: { view: {} } },
        managers: [],
        dock: ['c', 'a'],
    });
    first.PANEL.start();
    const firstDock = (await first.ask('frame-setup', {}, FRAME)).state.mods.map(({ id }) => id).join();
    check(
        "at the first start the Dock keeps the host app's mods in the order it names them, as the shell's own order",
        JSON.stringify(first.state['panel-order']) === '["c","a"]' && firstDock === 'c,a',
        { state: first.state, firstDock }
    );
    const later = panelOver(createPanel, {
        mods: ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), uses: {} })),
        fields: { a: { view: {} }, b: { view: {} }, c: { view: {} } },
        managers: [],
        dock: ['c', 'a'],
        state: { 'panel-pinned': ['a', 'b'], 'panel-order': ['b'] },
    });
    later.PANEL.start();
    const left = (await later.ask('frame-setup', {}, FRAME)).state.mods.map(({ id }) => id).join();
    check(
        'later the Dock is as the person left it, whatever the host app names',
        left === 'b,a' && JSON.stringify(later.state['panel-order']) === '["b"]',
        left
    );

    // A bundle that does not load, as deckit lists it, between two that do: it has no manifest fields and no run.
    const broken = { id: 'broken', refusal: { stage: 'read', kind: 'NOT_LOADABLE', message: 'no main.js' } };
    const listing = panelOver(createPanel, {
        mods: [{ id: 'a', name: 'A', uses: {} }, broken, { id: 'b', name: 'B', uses: {} }],
        fields: { a: { view: {} }, b: { view: {} } },
        managers: ['switcher'],
    });
    listing.PANEL.start();
    const inDock = (await listing.ask('frame-setup', {}, FRAME)).state.mods.map(({ id }) => id).join();
    const switching = (await listing.ask('list', {}, 'switcher')).map(({ id }) => id).join();
    await listing.ask('reorder', { ids: ['b', 'a'] }, FRAME);
    check(
        'the Dock, the list and its order hold the mods that load, and no bundle that does not',
        inDock === 'a,b' && switching === 'a,b' && JSON.stringify(listing.state['panel-order']) === '["b","a"]',
        { inDock, switching, order: listing.state['panel-order'] }
    );
    const refusing = panelOver(createPanel, {
        mods: ['a', 'b'].map((id) => ({ id, name: id.toUpperCase(), uses: {} })),
        fields: { a: { view: {} }, b: { view: {} } },
        managers: [],
        refusesWrites: true,
    });
    refusing.PANEL.start();
    await new Promise((resolve) => setImmediate(resolve));
    const held = (await refusing.ask('frame-setup', {}, FRAME)).state.mods.map(({ id }) => id).join();
    check('the panel goes on with what deckit refuses to keep, as state it did not read', held === 'a,b', held);

    // The shell's keys, pressed in a page of the app where the panel is in front, run what they do.
    const keyed = panelOver(createPanel, {
        mods: ['a', 'b'].map((id) => ({ id, name: id.toUpperCase(), uses: {} })),
        fields: { a: { view: {} }, b: { view: {} } },
        managers: [],
        keepers: ['settings'],
        running: ['a', 'b'],
        answers: { 'deckit-shell:panel-escape': false },
    });
    keyed.PANEL.start();
    const toggle = { code: 'Backslash', meta: true };
    const collapsed = () => keyed.state['panel-frame']?.collapsed;
    const front = async () => (await keyed.ask('frame-setup', {}, FRAME)).state.current;
    check("a key pressed while the panel is not up is not the panel's", keyed.press(FRAME, toggle) === false, '');
    keyed.PANEL.control.show();
    check(
        "the shell's key toggles the sidebar, pressed in the panel's frame",
        keyed.press(FRAME, toggle) === true && collapsed() === true,
        keyed.state['panel-frame']
    );
    check(
        'and pressed in the page of the mod in front',
        keyed.press(keyed.page('a'), toggle) === true && collapsed() === false,
        keyed.state['panel-frame']
    );
    keyed.ask('pick', { id: 'b' }, FRAME);
    const picked = await front();
    keyed.press({ in: keyed.page('b') }, { code: 'BracketLeft', meta: true, control: true });
    const back = await front();
    keyed.press(FRAME, { code: 'BracketRight', meta: true, control: true });
    const forward = await front();
    check(
        'back and forward go through the mods put in front, pressed in a web page shown in the mod in front too',
        picked === 'b' && back === 'a' && forward === 'b',
        { picked, back, forward }
    );
    check(
        "a chord none of the shell's keys has is not the panel's",
        keyed.press(FRAME, { code: 'KeyJ' }) === false,
        ''
    );
    const rebound = { code: 'KeyS', meta: true, alt: true };
    await keyed.askKey('set', { id: 'toggleSidebar', keystroke: rebound }, 'settings');
    check(
        'a chord set through shell.keys takes effect at once, and the one it had is no longer the key',
        keyed.press(FRAME, toggle) === false && keyed.press(FRAME, rebound) === true && collapsed() === true,
        keyed.state['panel-frame']
    );
    const escape = { code: 'Escape' };
    check("in its own window Escape is the window's", keyed.press(FRAME, escape) === false, keyed.dismissed);
    keyed.PANEL.control.present({ floating: true, dismissible: true });
    const escaped = keyed.press(FRAME, escape);
    await new Promise((resolve) => setImmediate(resolve));
    check(
        'Escape in the frame of a panel floating over something, the frame not taking it, puts the panel away',
        escaped === true && keyed.dismissed.length === 1,
        { escaped, dismissed: keyed.dismissed }
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} panel checks`);
    process.exit(0);
}

// `createPanel` over stand-ins: `mods` as deckit lists them, `fields` each one's manifest fields, `managers` the mods
// that hold deckit.mods, `keepers` those that hold deckit.shell-keys, `running` the mods whose views have joined,
// `dock` as the host app hands it, `state` what the shell kept, `answers` what a page answers main, by channel,
// true where none is given, and `refusesWrites` deckit refusing every write to state, as it does state it did not
// read. `ask(name, payload, mod)` asks one of the panel's channels as the page of `mod`, or as the frame's for FRAME,
// and `askKey` one of the shell keys'. `press(page, keystroke)` is a key pressed in a page of the app, or in the frame
// for FRAME, as the keymap hands it on.
function panelOver(
    createPanel,
    { mods, fields, managers, keepers = [], running = [], dock = null, state = {}, answers = {}, refusesWrites = false }
) {
    const handlers = {};
    const named = [];
    const launched = [];
    const shown = [];
    const dismissed = [];
    const KEYMAP = keymapOver();
    const frame = { mod: null };
    const modPages = new Map();
    const page = (mod) => {
        if (mod === FRAME) return frame;
        if (!modPages.has(mod)) modPages.set(mod, { mod });
        return modPages.get(mod);
    };
    const runs = running.map((id) => ({
        run: { mod: { id }, state: 'running', summary: { view: {} } },
        page: page(id),
    }));
    const keeping = (id) => ({ mod: { id, permissions: [{ id: 'deckit.shell-keys' }] } });
    const channel = (declared) => ({
        handle: (handler) => (handlers[declared.channel] = handler),
        on: (handler) => (handlers[declared.channel] = handler),
        send() {},
        invoke: async () => answers[declared.channel] ?? true,
    });
    const deckit = {
        config: { name: 'Deckit' },
        channels: { bind: channel },
        fields: { define: (key) => named.push(key) },
        permissions: { define() {} },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                if (refusesWrites) throw new Error('the state the core keeps was not read');
                state[key] = value;
            },
        },
        keymap: KEYMAP,
        core: { onDown() {} },
        pages: { whenEnds() {} },
        // A web page is `{ in }`, shown in the page `in`.
        web: { pageFor: (one) => one.in ?? one },
        log: { error() {}, warn() {} },
        mods: {
            notifications: [],
            list: () => mods,
            shipped: () => mods.filter(({ refusal }) => !refusal).map(({ id }) => id),
            runs: () => runs,
            runOf: (id) =>
                runs.find(({ run }) => run.mod.id === id)?.run ?? (keepers.includes(id) ? keeping(id) : null),
            fieldsOf: (id) => fields[id] ?? null,
            modOf: (sender) => sender?.mod ?? null,
            managerFrom: (sender) => {
                if (managers.includes(sender?.mod)) return sender.mod;
                throw Object.assign(new Error(`${sender?.mod} does not have deckit.mods`), { kind: 'NOT_PERMITTED' });
            },
            launch: async (id) => launched.push(id),
            observe() {},
            onChange() {},
        },
    };
    const stage = { whenResized() {}, size: () => ({ width: 800, height: 600 }), lay() {}, show() {} };
    const PANEL = createPanel({
        REGION: {
            onChange() {},
            parentOf: () => null,
            interfaceOf: () => null,
            laidOut: () => new Map(),
            rectOf: () => null,
        },
        PAGES: { open: () => frame, whenFocused() {}, focus() {}, isAlive: () => true },
        OVERLAY: { onChange() {}, withOverlays: (laid) => laid, holdsKeyboard: () => false, ownerOf: (one) => one },
        makeStage: () => stage,
        deckit,
        host: {
            show: () => shown.push(true),
            showsPanel: () => true,
            panelTitled() {},
            dismiss: () => dismissed.push(true),
        },
        dock,
    });
    const ask = async (name, payload, mod) => handlers[`deckit-shell:panel-${name}`](payload, page(mod));
    const askKey = async (name, payload, mod) => handlers[`deckit-shell:key-${name}`](payload, page(mod));
    const press = (at, keystroke) => KEYMAP.press(at === FRAME ? frame : at, keystroke);
    return { PANEL, named, launched, shown, dismissed, state, page, ask, askKey, press };
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

const FRAME = Symbol('the frame');

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
