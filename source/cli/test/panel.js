// The panel's list order (deckit-shell/shell/panel/model/list-order): the mods the person placed first, as placed, the
// rest as deckit lists them, and a drag that moves the ids it names among the places they held. The Dock's items
// (model/dock): those kept, then those running. Where the frame's parts are (model/layout) at a panel's size. And the
// shell's own keys (deckit-shell/shell/key/main): their table, the chords set kept in the shell's state, and the
// privileged permission main holds a page to before it lists or changes them. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LIST_ORDER = await import(url('deckit-shell', 'shell', 'panel', 'model', 'list-order.js'));
    const LAYOUT = await import(url('deckit-shell', 'shell', 'panel', 'model', 'layout.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'panel', 'model', 'dock.js'));
    const { createKey } = await import(url('deckit-shell', 'shell', 'key', 'main.js'));
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
    const defined = [];
    const handlers = {};
    const state = { 'panel-keys': { back: { code: 'KeyB', meta: true }, gone: null, forward: 'none' } };
    const written = [];
    const holding = (id, permissions) => ({ mod: { id, permissions: permissions.map((one) => ({ id: one })) } });
    const runs = { settings: holding('settings', ['deckit.shell-keys']), other: holding('other', ['deckit.mods']) };
    const deckit = {
        channels: { bind: (declared) => ({ handle: (handler) => (handlers[declared.channel] = handler) }) },
        permissions: { define: (permission) => defined.push(permission) },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                written.push(value);
                state[key] = value;
            },
        },
        mods: { modOf: (page) => page.mod, runOf: (id) => runs[id] ?? null },
    };
    const KEY = createKey({ deckit });
    check(
        'the shell defines deckit.shell-keys as privileged',
        defined.length === 1 && defined[0].id === 'deckit.shell-keys' && defined[0].privileged === true,
        defined
    );
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} panel checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
