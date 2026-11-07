// The panel's list order (deckit-shell/shell/panel/model/list-order): the mods the person placed first, as placed, the
// rest as deckit lists them, and a drag that moves the ids it names among the places they held. The Dock's items
// (model/dock): those kept, then those running. Where the frame's parts are (model/layout) at a panel's size. And the
// shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, and the
// privileged permission main holds a page to before it lists or changes them. And the panel (shell/panel/main) over a
// stand-in for what connect answers: the manifest fields it names, and a mod in front as a mod with deckit.mods asks,
// launched when it does not run. Exits 1 with a line for each check that failed. The packages are ES modules, so they
// are imported as such.
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
    const deckit = {
        channels: { bind: (declared) => ({ handle: (handler) => (handlers[declared.channel] = handler) }) },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                written.push(value);
                state[key] = value;
            },
        },
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
    KEY.start();
    const channel = (name) => (payload, mod) => handlers[`deckit-shell:key-${name}`](payload, { mod });
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
        refusedTo(() => channel('list')({}, 'other')) === 'REFUSED' &&
            refusedTo(() => channel('set')({ id: 'back', keystroke: null }, 'other')) === 'REFUSED' &&
            refusedTo(() => channel('reset')({ id: 'back' }, 'other')) === 'REFUSED',
        ''
    );
    const chosen = { code: 'KeyS', meta: true, alt: true };
    const set = await channel('set')({ id: 'toggleSidebar', keystroke: chosen }, 'settings');
    check(
        'a key set takes its chord, kept in the shell state, and a press of it is that key',
        set.keystroke.code === 'KeyS' &&
            state['panel-keys'].toggleSidebar.alt === true &&
            KEY.idOf({ code: 'KeyS', meta: true, alt: true }) === 'toggleSidebar' &&
            KEY.idOf({ code: 'Backslash', meta: true }) === null,
        { set, state }
    );
    const taken = await channel('set')({ id: 'forward', keystroke: { code: 'KeyB', meta: true } }, 'settings').then(
        () => '',
        (error) => error.kind
    );
    check('a chord another of the shell keys has is refused', taken === 'REFUSED', taken);
    await channel('set')({ id: 'back', keystroke: null }, 'settings');
    check('a key set to none has no chord', KEY.chordOf('back') === '' && state['panel-keys'].back === null, state);
    const reset = await channel('reset')({ id: 'back' }, 'settings');
    check(
        'a key reset has its default again, and the state keeps no chord for it',
        reset.keystroke.code === 'BracketLeft' && !Object.hasOwn(state['panel-keys'], 'back'),
        { reset, state }
    );
    check(
        'what is no key of the shell, or no keystroke, is refused',
        refusedTo(() => channel('set')({ id: 'gone', keystroke: null }, 'settings')) !== '' &&
            refusedTo(() => channel('set')({ id: 'back', keystroke: { meta: true } }, 'settings')) !== '',
        ''
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
        await panel.ask('open', { id: 'notes' }, 'notes').then(() => '', (error) => error.kind || error.message),
        await panel.ask('open', { id: 'switcher' }, 'switcher').then(() => '', (error) => error.message),
    ];
    check(
        'a mod without deckit.mods is refused, and so is a mod with nothing to show',
        refusals[0] === 'REFUSED' && refusals[1] !== '' && panel.launched.length === 1,
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} panel checks`);
    process.exit(0);
}

// `createPanel` over stand-ins: `mods` as deckit lists them, `fields` each one's manifest fields, `managers` the mods
// that hold deckit.mods, `dock` as the host app hands it, and `state` what the shell kept. `ask(name, payload, mod)`
// asks one of the panel's channels as the page of `mod`, or as the frame's for FRAME.
function panelOver(createPanel, { mods, fields, managers, dock = null, state = {} }) {
    const handlers = {};
    const named = [];
    const launched = [];
    const shown = [];
    const frame = { mod: null };
    const page = (mod) => (mod === FRAME ? frame : { mod });
    const channel = (declared) => ({
        handle: (handler) => (handlers[declared.channel] = handler),
        on: (handler) => (handlers[declared.channel] = handler),
        send() {},
        invoke: async () => true,
    });
    const deckit = {
        config: { name: 'Deckit' },
        channels: { bind: channel },
        fields: { define: (key) => named.push(key) },
        permissions: { define() {} },
        state: { read: (key, fallback) => state[key] ?? fallback, write: async (key, value) => (state[key] = value) },
        keymap: { listen() {} },
        core: { onDown() {} },
        pages: { whenEnds() {} },
        web: { pageFor: () => null },
        log: { error() {} },
        mods: {
            notifications: [],
            list: () => mods,
            shipped: () => mods.map(({ id }) => id),
            runs: () => [],
            runOf: () => null,
            fieldsOf: (id) => fields[id] ?? null,
            modOf: (sender) => sender?.mod ?? null,
            managerFrom: (sender) => {
                if (managers.includes(sender?.mod)) return sender.mod;
                throw Object.assign(new Error(`${sender?.mod} does not have deckit.mods`), { kind: 'REFUSED' });
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
        host: { show: () => shown.push(true), showsPanel: () => true, panelTitled() {}, dismiss() {} },
        dock,
    });
    const ask = async (name, payload, mod) => handlers[`deckit-shell:panel-${name}`](payload, page(mod));
    return { PANEL, named, launched, shown, state, ask };
}

const FRAME = Symbol('the frame');

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
