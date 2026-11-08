// The configuration mod (mods/configuration/src) over a stand-in for deckit: the settings it reads from what mods
// declare to deckit/configuration, what a client reads, sets and hears of its own mod's, what a client that holds
// deckit.system-services lists and sets of every mod's, and the values kept in its records across a restart. Exits 1
// with a line for each check that failed.
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'configuration', 'src');
const { configuration } = require(path.join(MOD, 'configuration', 'configuration.js'));

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

    // What mods declare.
    const mod = (id) => ({ id, name: id[0].toUpperCase() + id.slice(1) });
    const of = (id, entries) => entries.map((entry) => ({ mod: mod(id), entry }));
    const command = { key: 'forge', type: 'string', title: 'Forge command', default: '', placeholder: 'forge' };
    const contributions = [
        ...of('forge', [
            command,
            { key: 'forgeConfig', type: 'string', title: 'Forge configuration', description: 'Its config.toml.' },
            { key: 'forge', type: 'string', title: 'Again' },
        ]),
        ...of('editor', [
            { key: 'tab-size', type: 'number', title: 'Tab size', default: 4, minimum: 1, maximum: 8, unit: 'spaces' },
            { key: 'wrap', type: 'boolean', title: 'Wrap lines', default: false },
            {
                key: 'theme',
                type: 'string',
                title: 'Theme',
                default: 'light',
                oneOf: [
                    { const: 'light', title: 'Light' },
                    { const: 'dark', title: 'Dark' },
                ],
            },
            { key: 'scale', type: 'number', title: 'Scale' },
        ]),
        ...of('bad', [
            { key: 'a b', type: 'string', title: 'Spaced' },
            { key: 'kind', type: 'integer', title: 'Kind' },
            { key: 'untitled', type: 'string' },
            { key: 'blank', type: 'string', title: ' ' },
            { key: 'told', type: 'string', title: 'Told', description: 7 },
            { key: 'off', type: 'number', title: 'Off', default: '4' },
            { key: 'low', type: 'number', title: 'Low', default: 0, minimum: 1 },
            { key: 'bounds', type: 'number', title: 'Bounds', minimum: 5, maximum: 1 },
            { key: 'bounded', type: 'string', title: 'Bounded', maximum: 3 },
            { key: 'choice', type: 'string', title: 'Choice', oneOf: [] },
            { key: 'choices', type: 'string', title: 'Choices', oneOf: [{ const: 1, title: 'One' }] },
            { key: 'named', type: 'string', title: 'Named', oneOf: [{ const: 'a' }] },
            { key: 'outside', type: 'string', title: 'Outside', default: 'c', oneOf: [{ const: 'a', title: 'A' }] },
            'key',
            { key: 'fine', type: 'boolean', title: 'Fine' },
        ]),
        ...of('none', [{ type: 'string', title: 'No key' }]),
    ];

    const store = new Map();
    let refusingWrites = false;
    const records = {
        get: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
        set: async (key, value) => {
            if (refusingWrites) throw new Error('the disk is full');
            store.set(key, JSON.stringify(value));
        },
    };
    const deckit = {
        exports: { contributions: async (name) => (name === 'deckit/configuration' ? contributions : []) },
        storage: { records },
    };

    const settings = configuration(deckit);
    const connection = (id, permissions) => ({ mod: { name: mod(id).name }, credential: { mod: id, permissions } });
    const settingsConnection = connection('settings', ['deckit.system-services']);
    const system = settings.exportsFor(settingsConnection);
    const editorConnection = connection('editor', []);
    const editor = settings.exportsFor(editorConnection);
    const forge = settings.exportsFor(connection('forge', []));

    // The list, and the entries left out.
    const { mods: listed, refused } = await system.list();
    const shown = listed.map(({ mod, items }) => `${mod.id}: ${items.map(({ entry }) => entry.key).join(' ')}`);
    check(
        'list',
        json(shown) === json(['forge: forge forgeConfig', 'editor: tab-size wrap theme scale', 'bad: fine']),
        shown
    );
    check(
        'an entry as written',
        listed[0].items[0].entry === command && json(listed[0].mod) === json(mod('forge')),
        listed[0]
    );
    const values = listed.map(({ items }) => items.map(({ value }) => value));
    check('defaults, or null', json(values) === json([['', null], [4, false, 'light', null], [null]]), values);
    check('warned', warnings.length === 16, warnings);
    check(
        'refused as warned',
        refused.length === 16 &&
            refused.every(
                ({ mod, entry, problem }, index) =>
                    warnings[index] === `[configuration] ${mod.id}: ${problem}` && entry !== undefined && !!mod.name
            ),
        refused
    );
    await system.list();
    await editor.values();
    check('warned once', warnings.length === 16, warnings);
    warnings.length = 0;

    // A client's own settings.
    check(
        'values',
        json(await editor.values()) === json({ 'tab-size': 4, wrap: false, theme: 'light', scale: null }),
        await editor.values()
    );
    check('get', (await editor.get('tab-size')) === 4 && (await forge.get('forgeConfig')) === null);
    check('no such key', (await rejection(editor.get('nope')))?.kind === 'KEY');
    check('only its own', (await rejection(forge.get('tab-size')))?.kind === 'KEY');
    check('one left out', (await rejection(system.setOf('bad', 'off', 4)))?.kind === 'KEY');

    const heard = [];
    await editor.onChange(async (key, value) => heard.push(['editor', key, value]));
    await forge.onChange(async (key, value) => heard.push(['forge', key, value]));
    await editor.onChange(() => {
        throw new Error('it broke');
    });
    check(
        'a listener is a function',
        (await rejection(editor.onChange('no')))?.message === 'onChange() takes a function'
    );

    check('set', (await editor.set('tab-size', 2)) === 2, store.get('editor'));
    check('kept by mod id', store.get('editor') === json({ 'tab-size': 2 }), store.get('editor'));
    check('read back', (await editor.get('tab-size')) === 2);
    await ticks();
    check('heard', json(heard) === json([['editor', 'tab-size', 2]]), heard);
    heard.length = 0;
    await editor.set('tab-size', 2);
    await ticks();
    check('no change, nothing heard', heard.length === 0, heard);
    check('unset to the default', (await editor.set('tab-size', null)) === 4);
    check('nothing kept', store.get('editor') === json({}), store.get('editor'));
    await ticks();
    check('heard the default', json(heard) === json([['editor', 'tab-size', 4]]), heard);
    heard.length = 0;
    check('unset to null', (await editor.set('scale', 1.5)) === 1.5 && (await editor.set('scale', null)) === null);
    check(
        'to its default, kept',
        (await editor.set('wrap', false)) === false && store.get('editor') === json({ wrap: false })
    );
    await ticks();
    check(
        'heard the unset',
        json(heard) ===
            json([
                ['editor', 'scale', 1.5],
                ['editor', 'scale', null],
            ]),
        heard
    );
    heard.length = 0;

    // Values that do not fit.
    for (const [key, value] of [
        ['tab-size', '2'],
        ['tab-size', 0],
        ['tab-size', 9],
        ['tab-size', Infinity],
        ['wrap', 'yes'],
        ['theme', 'blue'],
        ['theme', 1],
        ['scale', true],
    ])
        check(`${key} ${json(value)} refused`, (await rejection(editor.set(key, value)))?.kind === 'VALUE');
    check('a key not declared', (await rejection(editor.set('nope', 1)))?.kind === 'KEY');
    check('nothing set', store.get('editor') === json({ wrap: false }), store.get('editor'));

    // What a client that holds deckit.system-services sets.
    check('list refused', (await rejection(editor.list()))?.kind === 'REFUSED');
    check('setOf refused', (await rejection(editor.setOf('forge', 'forge', '/bin/forge')))?.kind === 'REFUSED');
    check('setOf', (await system.setOf('forge', 'forge', '/bin/forge')) === '/bin/forge');
    check('setOf, its own', (await forge.get('forge')) === '/bin/forge');
    check('setOf, no such key', (await rejection(system.setOf('forge', 'tab-size', 2)))?.kind === 'KEY');
    check('setOf, no such mod', (await rejection(system.setOf('gone', 'forge', 'x')))?.kind === 'KEY');
    check('setOf, no fit', (await rejection(system.setOf('editor', 'theme', 'blue')))?.kind === 'VALUE');
    await system.setOf('editor', 'theme', 'dark');
    await ticks();
    check(
        'setOf heard by its mod alone',
        json(heard) ===
            json([
                ['forge', 'forge', '/bin/forge'],
                ['editor', 'theme', 'dark'],
            ]),
        heard
    );
    heard.length = 0;
    const theme = (await system.list()).mods[1].items[2];
    check('listed as set', theme.value === 'dark' && theme.entry.key === 'theme', theme);

    // A connection that ended hears no more.
    settings.forget(editorConnection);
    await system.setOf('editor', 'theme', 'light');
    await ticks();
    check('forgotten', heard.length === 0, heard);

    // A write refused sets nothing.
    refusingWrites = true;
    check('a write refused', (await rejection(forge.set('forge', 'x')))?.message === 'the disk is full');
    check('not set', (await forge.get('forge')) === '/bin/forge');
    refusingWrites = false;

    // Kept across a restart: a value of a key no longer declared is left out but kept, and one that does not fit reads
    // as the default.
    store.set('editor', json({ 'tab-size': 3, theme: 'blue', gone: 'kept', wrap: true }));
    store.set('forge', json(['not', 'a', 'table']));
    const restarted = configuration(deckit);
    const after = restarted.exportsFor(connection('editor', []));
    check(
        'kept across a restart',
        json(await after.values()) === json({ 'tab-size': 3, wrap: true, theme: 'light', scale: null }),
        await after.values()
    );
    check('another shape holds nothing', (await restarted.exportsFor(connection('forge', [])).get('forge')) === '');
    check('told again after a restart', warnings.length === 16, warnings);
    warnings.length = 0;
    await after.set('tab-size', 5);
    check(
        'the undeclared kept',
        store.get('editor') === json({ 'tab-size': 5, theme: 'blue', gone: 'kept', wrap: true }),
        store.get('editor')
    );

    check('nothing logged', errors.length === 0 && warnings.length === 0, { errors, warnings });

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
