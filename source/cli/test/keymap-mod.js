// The keymap mod (mods/keymap/src) over a stand-in for deckit and the shell's keys and whether the app is in front: its
// specs, the keys it reads from what mods declare to deckit/keys, the chords it takes through the shell's keys once
// attach hands them and none before, a press running a command through deckit/commands, and what a client sets and
// reads. Exits 1 with a line for each check that failed.
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'keymap', 'src');
const KEYSTROKE = require(path.join(MOD, 'keystroke', 'keystroke.js'));
const { keymap } = require(path.join(MOD, 'keymap', 'keymap.js'));

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (count = 5) => {
    for (let index = 0; index < count; index++) await tick();
};
const json = (value) => JSON.stringify(value);

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${json(seen)}`);
    };
    const rejection = async (promise) => {
        try {
            await promise;
            return null;
        } catch (error) {
            return { message: error.message, kind: error.kind };
        }
    };

    const warnings = [];
    console.warn = (line) => warnings.push(line);
    const errors = [];
    console.error = (...line) => errors.push(line.join(' '));

    // Specs.
    const parsed = KEYSTROKE.parse('Mod+Shift+K');
    check(
        'parse',
        json(parsed) === json({ code: 'KeyK', meta: true, control: false, alt: false, shift: true }),
        parsed
    );
    check('spec', KEYSTROKE.specOf(parsed) === 'shift+cmd+k', KEYSTROKE.specOf(parsed));
    check('one spelling', KEYSTROKE.specOf(KEYSTROKE.parse('cmd+ctrl+opt+shift+1')) === 'ctrl+alt+shift+cmd+1');
    check('chord', KEYSTROKE.chordOf(parsed) === '⇧⌘K', KEYSTROKE.chordOf(parsed));
    check('chord of a name', KEYSTROKE.chordOf(KEYSTROKE.parse('alt+space')) === '⌥Space');
    check('chord of a symbol', KEYSTROKE.chordOf(KEYSTROKE.parse('ctrl+left')) === '⌃←');
    check('f keys', KEYSTROKE.parse('alt+f12')?.code === 'F12');
    check('punctuation', KEYSTROKE.parse('cmd+[')?.code === 'BracketLeft');
    check('two keys', KEYSTROKE.parse('ctrl+a+b') === null);
    check('an unknown word', KEYSTROKE.parse('hyper+k') === null);
    check('modifiers alone', KEYSTROKE.parse('ctrl+shift') === null);
    check('nameless code', KEYSTROKE.specOf({ code: 'Numpad1', meta: true }) === null);
    const fits = (spec) => KEYSTROKE.fitsWide(KEYSTROKE.parse(spec));
    check('wide', fits('ctrl+c') && fits('alt+space') && fits('cmd+shift+k'));
    check('wide needs a modifier', !fits('f5') && !fits('shift+k'));
    check('wide keeps fields', !fits('cmd+c') && !fits('cmd+left') && !fits('alt+backspace') && !fits('cmd+enter'));

    // The declarations, and the commands deckit/commands lists.
    const mod = (id, name) => ({ id, name });
    const calendar = mod('calendar', 'Calendar');
    const note = mod('note', 'Note');
    const switcher = mod('switcher', 'Switcher');
    const listed = [
        { mod: calendar, id: 'today', title: 'Show Today', keywords: [], params: null },
        { mod: calendar, id: 'week', title: 'Show Week', keywords: [], params: null },
        {
            mod: calendar,
            id: 'open-event',
            title: 'Open Event',
            keywords: [],
            params: { type: 'object', properties: { start: { type: 'integer' } }, required: ['start'] },
        },
        { mod: note, id: 'new', title: 'New Note', keywords: [], params: null },
        { mod: note, id: 'find', title: 'Find Note', keywords: [], params: null },
        { mod: note, id: 'fail', title: 'Fail', keywords: [], params: null },
        { mod: switcher, id: 'show', title: 'Show Switcher', keywords: [], params: null },
    ];
    // What each declaring mod is granted: Calendar both scopes, Note `app` only, Switcher `global` only.
    const granted = {
        calendar: ['deckit.app-keys', 'system.global-keys'],
        note: ['deckit.app-keys'],
        switcher: ['system.global-keys'],
    };
    const credentialOf = (entries) =>
        entries.map(({ mod, entry }) => ({
            mod: { name: mod.name },
            credential: { mod: mod.id, permissions: granted[mod.id] },
            entry,
        }));
    const contributions = [
        { mod: calendar, entry: { command: 'today', keystroke: 'mod+shift+t' } },
        { mod: calendar, entry: { command: 'week', keystroke: 'ctrl+alt+w', scope: 'global' } },
        { mod: calendar, entry: { command: 'today', keystroke: 'mod+shift+y' } },
        { mod: calendar, entry: { command: 'open-event', keystroke: 'ctrl+e' } },
        { mod: calendar, entry: { command: 'nope', keystroke: 'ctrl+n' } },
        { mod: calendar, entry: { command: 'week', keystroke: 'ctrl+w', scope: 'local' } },
        { mod: note, entry: { command: 'new', keystroke: 'mod+shift+t' } },
        { mod: note, entry: { command: 'find', keystroke: 'cmd+c' } },
        { mod: note, entry: { command: 'find', keystroke: 'mod+g+h' } },
        { mod: note, entry: { command: 'find' } },
        { mod: note, entry: { keystroke: 'ctrl+f' } },
        { mod: note, entry: { command: 'fail', keystroke: 'ctrl+alt+w' } },
        { mod: note, entry: { command: 'find', keystroke: 'ctrl+alt+f', scope: 'global' } },
        { mod: switcher, entry: { command: 'show', keystroke: 'alt+space', scope: 'global' } },
        { mod: switcher, entry: 'show' },
        { mod: switcher, entry: { command: 'show', keystroke: 'ctrl+alt+s' } },
    ];

    // The shell's keys: a chord in `othersHold` is another mod's, and the system gives no global chord in `notGiven`.
    const takes = []; // [spec, scope], each take asked
    const releases = [];
    const holding = new Map(); // spec -> { scope, run }
    const othersHold = new Set();
    const notGiven = new Set();
    const keys = {
        take: async (keystroke, run, { scope }) => {
            const spec = KEYSTROKE.specOf(keystroke);
            takes.push([spec, scope]);
            if (othersHold.has(spec) || holding.has(spec))
                throw Object.assign(new Error(`${spec} is taken by forge`), { kind: 'REFUSED' });
            holding.set(spec, { scope, run });
            return {
                held: scope !== 'global' || !notGiven.has(spec),
                release: () => {
                    releases.push(spec);
                    holding.delete(spec);
                },
            };
        },
    };
    const shell = { keys, active: async () => front };
    const pressed = async (spec) => {
        await holding.get(spec)?.run();
        await ticks();
    };

    // deckit/commands: what a run was asked.
    const runs = [];
    const commands = {
        list: async () => ({ commands: [...listed], refused: [] }),
        run: async (id, command, args) => {
            runs.push([id, command, args ?? null]);
            if (command === 'fail') throw Object.assign(new Error('it fails'), { kind: 'COMMAND' });
            return null;
        },
    };

    const store = new Map();
    let refusingWrites = false;
    const records = {
        get: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
        set: async (key, value) => {
            if (refusingWrites) throw new Error('the disk is full');
            store.set(key, JSON.stringify(value));
        },
    };
    let front = true;
    const listeners = new Map();
    const heard = new Map(); // name -> [listener]
    const signal = async (name) => {
        for (const listener of heard.get(name) ?? []) listener();
        await ticks();
    };
    const deckitOf = () => ({
        storage: { records },
        dependencies: {
            onConnect: (name, listener) => listeners.set(name, listener),
        },
        exports: { contributions: async (name) => (name === 'deckit/keys' ? credentialOf(contributions) : []) },
        events: {
            on: (name, listener) => {
                if (!heard.has(name)) heard.set(name, []);
                heard.get(name).push(listener);
            },
        },
    });
    const connection = (id, permissions) => ({ mod: { name: id }, credential: { mod: id, permissions } });

    const keymapped = keymap(deckitOf());
    const settings = keymapped.exportsFor(connection('settings', ['deckit.system-services']));
    const own = keymapped.exportsFor(connection('calendar', []));

    // Before deckit/commands connects nothing is known, and nothing is taken.
    check('not connected', (await rejection(settings.list()))?.kind === 'NOT_CONNECTED');
    check('nothing taken', takes.length === 0, takes);
    check('no chord yet', (await own.chordOf('today')) === '');

    // As it connects the keys are read and their chords taken.
    let cut = listeners.get('deckit/commands')(commands);
    await ticks();
    check('nothing taken before attach', takes.length === 0, takes);
    const unattached = (await settings.list()).keys;
    check(
        'no key taken or unavailable before attach',
        unattached.length > 0 &&
            unattached.every(({ issues }) => !issues.some(({ kind }) => kind === 'taken' || kind === 'unavailable')),
        unattached
    );
    keymapped.attach(shell);
    await ticks();
    check(
        'taken as connected',
        json(takes) ===
            json([
                ['shift+cmd+t', 'app'],
                ['ctrl+alt+w', 'global'],
                ['alt+space', 'global'],
            ]),
        takes
    );
    check('warned', warnings.length === 11, warnings);
    const warnedOf = (pattern) => warnings.some((line) => pattern.test(line));
    check(
        'a scope not granted',
        warnedOf(/note: .*"find" works in every app, which needs system\.global-keys, and note is not granted it/) &&
            warnedOf(/switcher: .*"show" works anywhere in the app, which needs deckit\.app-keys/),
        warnings
    );
    const first = await settings.list();
    let bindings = first.keys;
    check('warned once', warnings.length === 11, warnings);
    check(
        'refused as warned',
        first.refused.length === 11 &&
            first.refused.every(({ mod, problem }, index) => warnings[index] === `[keymap] ${mod.id}: ${problem}`) &&
            json(first.refused[0]) ===
                json({
                    mod: calendar,
                    entry: { command: 'today', keystroke: 'mod+shift+y' },
                    problem: 'a key for "today" is declared already, so a second one is left out',
                }),
        first.refused
    );
    const ids = (list) => list.map((binding) => `${binding.mod.id}:${binding.command}`);
    check(
        'list',
        json(ids(bindings)) === json(['calendar:today', 'note:new', 'note:fail', 'calendar:week', 'switcher:show']),
        ids(bindings)
    );
    check(
        'list fields',
        json(bindings[0]) ===
            json({
                mod: calendar,
                command: 'today',
                title: 'Show Today',
                scope: 'app',
                defaultKeystroke: KEYSTROKE.parse('shift+cmd+t'),
                keystroke: KEYSTROKE.parse('shift+cmd+t'),
                chord: '⇧⌘T',
                changed: false,
                active: true,
                issues: [],
            }),
        bindings[0]
    );
    const of = (list, id, command) => list.find((binding) => binding.mod.id === id && binding.command === command);

    // Two defaults of one scope on one chord: the first listed runs. One of app and one of global do not contend.
    const shadowed = of(bindings, 'note', 'new');
    check(
        'shadowed',
        !shadowed.active &&
            json(shadowed.issues.map(({ kind, other }) => [kind, other])) ===
                json([['shadowed', { mod: calendar, command: 'today', title: 'Show Today' }]]),
        shadowed
    );
    check(
        'app and global',
        of(bindings, 'note', 'fail').active && of(bindings, 'calendar', 'week').active,
        bindings.map((one) => one.active)
    );

    // A press runs its command, with no args; of an app and a global key on one chord, the app one while in front.
    await pressed('shift+cmd+t');
    check('press', json(runs) === json([['calendar', 'today', null]]), runs);
    runs.length = 0;
    await pressed('ctrl+alt+w');
    front = false;
    await pressed('ctrl+alt+w');
    check(
        'app in front, global elsewhere',
        json(runs) ===
            json([
                ['note', 'fail', null],
                ['calendar', 'week', null],
            ]),
        runs
    );
    check(
        'a failed run is logged',
        warnings.length === 12 && /Fail of Note did not run: it fails/.test(warnings[11]),
        warnings
    );
    front = true;

    // Its own mod's chord, for any client.
    check('own chord', (await own.chordOf('today')) === '⇧⌘T');
    check('own chord of none', (await own.chordOf('open-event')) === '');
    check('own mod only', (await keymapped.exportsFor(connection('note', [])).chordOf('today')) === '');

    // Refused without the permission.
    check('list refused', (await rejection(own.list()))?.kind === 'NOT_PERMITTED');
    check('set refused', (await rejection(own.set('calendar', 'today')))?.kind === 'NOT_PERMITTED');
    check('reset refused', (await rejection(own.reset('calendar', 'today')))?.kind === 'NOT_PERMITTED');
    check('chord of another type', (await rejection(own.chordOf(1)))?.kind === 'INVALID_ARGUMENT');

    // What a set is refused for.
    const kind = async (...args) => (await rejection(settings.set(...args)))?.kind;
    const stroke = (spec) => ({ ...KEYSTROKE.parse(spec) });
    check('no such key', (await kind('calendar', 'open-event', stroke('ctrl+e'))) === 'NOT_DECLARED');
    check('no keystroke', (await kind('calendar', 'today', { meta: true })) === 'INVALID_ARGUMENT');
    check(
        'a modifier of another type',
        (await kind('calendar', 'today', { code: 'KeyT', meta: 1 })) === 'INVALID_ARGUMENT'
    );
    check('an id of another type', (await kind(1, 'today', stroke('ctrl+e'))) === 'INVALID_ARGUMENT');
    check('nameless', (await kind('calendar', 'today', { code: 'Numpad1', meta: true })) === 'INVALID_ARGUMENT');
    check('wide rule', (await kind('calendar', 'today', stroke('cmd+v'))) === 'INVALID_ARGUMENT');
    check('reset of another type', (await rejection(settings.reset('calendar', 2)))?.kind === 'INVALID_ARGUMENT');
    check('refused keeps nothing', !store.has('keys'), [...store]);

    // A set onto a free chord: kept, and the chord taken in place of the old one.
    takes.length = 0;
    releases.length = 0;
    let set = await settings.set('calendar', 'today', stroke('ctrl+alt+t'));
    check('set answers', set.active && set.changed && set.chord === '⌃⌥T', set);
    check('kept', store.get('keys') === json([{ mod: 'calendar', command: 'today', keystroke: 'ctrl+alt+t' }]));
    check('retaken', json(takes) === json([['ctrl+alt+t', 'app']]), takes);
    bindings = (await settings.list()).keys;
    check('the shadowed one runs', of(bindings, 'note', 'new').active, of(bindings, 'note', 'new'));
    check('old chord stays for it', releases.length === 0, releases);

    // A set onto a chord one of that scope has: held, until it is free.
    set = await settings.set('note', 'fail', stroke('alt+space'));
    check('global chord, app key', set.active, set);
    set = await settings.set('calendar', 'week', stroke('ctrl+alt+t'));
    check('global on an app chord', set.active, set);
    set = await settings.set('switcher', 'show', stroke('ctrl+alt+t'));
    check('held', !set.active && set.issues[0]?.kind === 'held' && set.issues[0].other.command === 'week', set.issues);
    set = await settings.reset('calendar', 'week');
    check('reset answers', !set.changed && set.active && set.chord === '⌃⌥W', set);
    check('free, so applied', of((await settings.list()).keys, 'switcher', 'show').active);
    set = await settings.set('calendar', 'week');
    check('none', !('keystroke' in set) && set.chord === '' && set.changed && !set.active, set);
    check('none is let go', !holding.has('ctrl+alt+w'), [...holding.keys()]);
    await settings.set('calendar', 'today', stroke('shift+cmd+t'));
    check(
        'a set to the default keeps nothing',
        !JSON.parse(store.get('keys')).some(({ command }) => command === 'today'),
        store.get('keys')
    );

    // A write refused changes nothing.
    refusingWrites = true;
    const before = store.get('keys');
    check('write refused', !!(await rejection(settings.set('note', 'new', stroke('ctrl+alt+n')))));
    check(
        'write refused keeps',
        store.get('keys') === before && !of((await settings.list()).keys, 'note', 'new').changed
    );
    refusingWrites = false;

    // What the hole answers: a chord another mod took runs none on it, a global one not given works in the app.
    othersHold.add('ctrl+alt+n');
    set = await settings.set('note', 'new', stroke('ctrl+alt+n'));
    check('taken', !set.active && set.issues[0]?.kind === 'taken' && !('other' in set.issues[0]), set.issues);
    othersHold.delete('ctrl+alt+n');
    check('taken asks again', of((await settings.list()).keys, 'note', 'new').active);
    notGiven.add('ctrl+alt+g');
    set = await settings.set('switcher', 'show', stroke('ctrl+alt+g'));
    check('unavailable', set.active && set.issues[0]?.kind === 'unavailable', set.issues);

    // What is declared is kept, and read again on the signals of deckit/keys and as deckit/commands' declarations
    // change; the chords are taken again after each.
    check(
        'signals heard',
        json([...heard.keys()]) ===
            json([
                'deckit/keys:contributions-changed',
                'deckit/keys:owner-changed',
                'deckit/commands:contributions-changed',
            ]),
        [...heard.keys()]
    );
    contributions.push({ mod: note, entry: { command: 'later', keystroke: 'ctrl+alt+j' } });
    check('kept until a signal', !of((await settings.list()).keys, 'note', 'later'));
    takes.length = 0;
    releases.length = 0;
    await signal('deckit/keys:contributions-changed');
    check('its command not known yet', !of((await settings.list()).keys, 'note', 'later') && takes.length === 0, takes);
    listed.push({ mod: note, id: 'later', title: 'Later', keywords: [], params: null });
    await signal('deckit/commands:contributions-changed');
    check('taken as its command is listed', json(takes) === json([['ctrl+alt+j', 'app']]), takes);
    check('listed', of((await settings.list()).keys, 'note', 'later')?.active === true);
    contributions.pop();
    await signal('deckit/keys:owner-changed');
    check('let go as the owner changes', json(releases) === json(['ctrl+alt+j']), releases);
    warnings.length = 0;

    // What was kept is read as the keymap starts again; an entry of another shape is left out.
    store.set(
        'keys',
        json([
            { mod: 'calendar', command: 'today', keystroke: 'ctrl+alt+d' },
            { mod: 'calendar', command: 'week', keystroke: 'no chord' },
            { mod: 'calendar' },
        ])
    );
    for (const spec of [...holding.keys()]) holding.delete(spec);
    cut?.();
    const again = keymap(deckitOf());
    again.attach(shell);
    listeners.get('deckit/commands')(commands);
    await ticks();
    bindings = (await again.exportsFor(connection('settings', ['deckit.system-services'])).list()).keys;
    check('kept read', of(bindings, 'calendar', 'today').chord === '⌃⌥D', of(bindings, 'calendar', 'today'));
    check('malformed left out', of(bindings, 'calendar', 'week').chord === '⌃⌥W', of(bindings, 'calendar', 'week'));
    check('nothing logged', errors.length === 0, errors);

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
