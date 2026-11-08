// The commands mod's registry (mods/commands/src/registry/registry.js) over a stand-in for deckit. Exits 1 with a line
// for each check that failed.
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'commands', 'src');
const { registry } = require(path.join(MOD, 'registry', 'registry.js'));

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (count = 5) => {
    for (let index = 0; index < count; index++) await tick();
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const rejection = async (promise) => {
        try {
            await promise;
            return null;
        } catch (error) {
            return { message: error.message, kind: error.kind, stage: error.stage };
        }
    };

    const warnings = [];
    console.warn = (line) => warnings.push(line);
    const errors = [];
    console.error = (...line) => errors.push(line.join(' '));

    const contributions = [
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'today', title: 'Show Today', keywords: ['day'] } },
        {
            mod: { id: 'calendar', name: 'Calendar' },
            entry: {
                id: 'open-event',
                title: 'Open Event',
                params: {
                    type: 'object',
                    properties: {
                        start: { type: 'integer' },
                        view: { type: 'string', enum: ['day', 'week'] },
                        tags: { type: 'array', items: { type: 'string' } },
                        mode: { oneOf: [{ const: 'a', title: 'A' }, { const: 'b' }] },
                    },
                    required: ['start'],
                },
            },
        },
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'today', title: 'Again' } },
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'bad id', title: 'Bad' } },
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'untitled' } },
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'p', title: 'P', params: { type: 'string' } } },
        { mod: { id: 'calendar', name: 'Calendar' }, entry: { id: 'q', title: 'Q', params: { type: 'object', x: 1 } } },
        { mod: { id: 'note', name: 'Note' }, entry: { id: 'today', title: 'Today Note' } },
        { mod: { id: 'plain', name: 'Plain' }, entry: { id: 'go', title: 'Go' } },
        { mod: { id: 'off', name: 'Off' }, entry: { id: 'go', title: 'Go' } },
        ...[
            ['note', 'Note'],
            ['plain', 'Plain'],
            ['off', 'Off'],
        ].map(([id, name]) => ({
            mod: { id, name },
            entry: { id: 'pick', title: 'Pick', params: { type: 'object', properties: { which: { type: 'string' } } } },
        })),
    ];

    // The signals the registry listens for, and one sent.
    const heard = new Map(); // name -> [listener]
    const signal = (name) => {
        for (const listener of heard.get(name) ?? []) listener();
    };

    // The core: `reach(id)` answers the exports a running mod opens for its id once its connection stands, or rejects
    // with the kind and stage `refusing` holds for it.
    const asked = [];
    const exportsOf = new Map(); // id -> exports a running mod opens for its id
    const refusing = new Map(); // id -> [kind, stage]
    const deckit = {
        dependencies: {
            reach: async (id) => {
                asked.push(['reach', id]);
                await wait(5);
                const refused = refusing.get(id);
                if (refused) {
                    const [kind, stage] = refused;
                    throw Object.assign(new Error(`${id} is out of reach`), { kind, stage });
                }
                return exportsOf.get(id);
            },
            release: async (id) => {
                asked.push(['release', id]);
            },
        },
        exports: { contributions: async (name) => (name === 'deckit/commands' ? [...contributions] : []) },
        events: {
            on: (name, listener) => {
                if (!heard.has(name)) heard.set(name, []);
                heard.get(name).push(listener);
            },
        },
    };

    const ran = [];
    exportsOf.set('calendar', {
        runCommand: async (id, args) => {
            ran.push(['calendar', id, args]);
            await wait(10);
            if (id === 'today') return { day: 7 };
            return undefined;
        },
    });
    const completed = [];
    exportsOf.get('calendar').completeCommand = async (id, param, partial, args) => {
        completed.push(['calendar', id, param, partial, args]);
        await wait(5);
        return [{ value: 'week', title: 'Week', hint: 'seven days' }];
    };
    exportsOf.set('note', { runCommand: async () => () => 1, completeCommand: async () => ({ not: 'a list' }) });
    exportsOf.set('plain', {});
    exportsOf.set('off', {
        runCommand: async () => {
            throw Object.assign(new Error('it broke'), { kind: 'BROKE' });
        },
        completeCommand: async () => {
            throw Object.assign(new Error('it broke'), { kind: 'BROKE' });
        },
    });

    const commands = registry(deckit);
    const credential = (permissions) => ({
        mod: { id: 'switcher', name: 'Switcher' },
        credential: { mod: 'switcher', permissions },
    });
    const outsider = commands.exportsFor(credential(['deckit.mods']));
    const client = commands.exportsFor(credential(['deckit.system-services']));

    // Refused without the permission.
    check('list refused', (await rejection(outsider.list()))?.kind === 'REFUSED');
    check('run refused', (await rejection(outsider.run('calendar', 'today')))?.kind === 'REFUSED');
    check(
        'complete refused',
        (await rejection(outsider.complete('calendar', 'open-event', 'view', '')))?.kind === 'REFUSED'
    );
    check('refused reaches nothing', asked.length === 0, asked);

    // The list.
    const { commands: listed, refused } = await client.list();
    check(
        'list',
        JSON.stringify(listed.map((each) => `${each.mod.id}:${each.id}`)) ===
            JSON.stringify([
                'calendar:today',
                'calendar:open-event',
                'note:today',
                'plain:go',
                'off:go',
                'note:pick',
                'plain:pick',
                'off:pick',
            ]),
        listed
    );
    check(
        'list fields',
        JSON.stringify(listed[0]) ===
            JSON.stringify({
                mod: { id: 'calendar', name: 'Calendar' },
                id: 'today',
                title: 'Show Today',
                keywords: ['day'],
                params: null,
            }),
        listed[0]
    );
    check('warned', warnings.length === 5, warnings);
    check(
        'refused as warned',
        JSON.stringify(
            refused.map(({ mod, entry, problem }) => [mod, entry.id, `[commands] ${mod.id}: ${problem}`])
        ) ===
            JSON.stringify(
                ['today', 'bad id', 'untitled', 'p', 'q'].map((id, index) => [
                    { id: 'calendar', name: 'Calendar' },
                    id,
                    warnings[index],
                ])
            ),
        refused
    );
    await client.list();
    check('warned once', warnings.length === 5, warnings);

    // Args checked before reaching.
    const kinds = async (...args) => (await rejection(client.run(...args)))?.kind;
    check('no such command', (await kinds('calendar', 'nope')) === 'COMMAND');
    check('no such mod', (await kinds('ghost', 'today')) === 'COMMAND');
    check('takes no args', (await kinds('calendar', 'today', { a: 1 })) === 'ARGUMENTS');
    check('required', (await kinds('calendar', 'open-event', {})) === 'ARGUMENTS');
    check('none for required', (await kinds('calendar', 'open-event')) === 'ARGUMENTS');
    check('integer', (await kinds('calendar', 'open-event', { start: 1.5 })) === 'ARGUMENTS');
    check('enum', (await kinds('calendar', 'open-event', { start: 1, view: 'year' })) === 'ARGUMENTS');
    check('items', (await kinds('calendar', 'open-event', { start: 1, tags: ['a', 2] })) === 'ARGUMENTS');
    check('oneOf', (await kinds('calendar', 'open-event', { start: 1, mode: 'c' })) === 'ARGUMENTS');
    check('function in args', (await kinds('calendar', 'open-event', { start: 1, f: () => 1 })) === 'ARGUMENTS');
    check('checked reaches nothing', asked.length === 0, asked);

    // A run reaches, runs, and lets go.
    check('run today', JSON.stringify(await client.run('calendar', 'today')) === JSON.stringify({ day: 7 }));
    check('{} for none', JSON.stringify(ran[0]) === JSON.stringify(['calendar', 'today', {}]), ran);
    check('{} is none', JSON.stringify(await client.run('calendar', 'today', {})) === JSON.stringify({ day: 7 }));
    const fit = { start: 3, view: 'week', tags: ['x'], mode: 'b' };
    check('undefined is null', (await client.run('calendar', 'open-event', fit)) === null);
    check('args handed', JSON.stringify(ran[2]) === JSON.stringify(['calendar', 'open-event', fit]), ran);
    await ticks();
    check(
        'reached and let go each run',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'calendar'],
                ['release', 'calendar'],
                ['reach', 'calendar'],
                ['release', 'calendar'],
                ['reach', 'calendar'],
                ['release', 'calendar'],
            ]),
        asked
    );

    // Runs at once on one mod: each reaches and lets go.
    asked.length = 0;
    const both = await Promise.all([client.run('calendar', 'today'), client.run('calendar', 'today')]);
    await ticks();
    check(
        'both ran',
        both.every((one) => one?.day === 7),
        both
    );
    check(
        'each reach let go',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'calendar'],
                ['reach', 'calendar'],
                ['release', 'calendar'],
                ['release', 'calendar'],
            ]),
        asked
    );

    // A refused reach is the run's refusal, with its stage, and nothing is let go; the next run asks again.
    for (const [kind, stage] of [
        ['NOT_INSTALLED', 'launch'],
        ['TIMED_OUT', 'launch'],
        ['NOT_EXPORTED', 'call'],
        ['REFUSED', 'call'],
    ]) {
        asked.length = 0;
        refusing.set('calendar', [kind, stage]);
        const refused = await rejection(client.run('calendar', 'today'));
        await ticks();
        check(`reach refused ${kind}`, refused?.kind === kind && refused?.stage === stage, refused);
        check(`${kind} not let go`, JSON.stringify(asked) === JSON.stringify([['reach', 'calendar']]), asked);
    }
    refusing.delete('calendar');
    check('asks again', (await client.run('calendar', 'today'))?.day === 7);

    // No runCommand, a throw, and a function answered: each let go.
    asked.length = 0;
    check('no runCommand', (await kinds('plain', 'go')) === 'COMMAND');
    check('a throw handed on', (await kinds('off', 'go')) === 'BROKE');
    await ticks();
    check(
        'let go after a throw',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'plain'],
                ['release', 'plain'],
                ['reach', 'off'],
                ['release', 'off'],
            ]),
        asked
    );
    const answered = await rejection(client.run('note', 'today'));
    check('function answered', !!answered && answered.kind === undefined, answered);

    // A completion is checked, reaches, asks, and lets go; none where the mod has no completeCommand or is not
    // reached, and a throw or an answer not a list is handed on.
    asked.length = 0;
    const completing = async (...args) => (await rejection(client.complete(...args)))?.kind;
    check('complete no such command', (await completing('calendar', 'nope', 'x', '')) === 'COMMAND');
    check('complete no such arg', (await completing('calendar', 'open-event', 'nope', '')) === 'ARGUMENTS');
    check('complete takes no args', (await completing('calendar', 'today', 'x', '')) === 'ARGUMENTS');
    check(
        'complete function in args',
        (await completing('calendar', 'open-event', 'view', '', { f: () => 1 })) === 'ARGUMENTS'
    );
    check('complete checked reaches nothing', asked.length === 0, asked);
    const offered = await client.complete('calendar', 'open-event', 'view', 'w', { start: 3 });
    check(
        'complete offers',
        JSON.stringify(offered) === JSON.stringify([{ value: 'week', title: 'Week', hint: 'seven days' }]),
        offered
    );
    check(
        'complete asked',
        JSON.stringify(completed[0]) === JSON.stringify(['calendar', 'open-event', 'view', 'w', { start: 3 }]),
        completed
    );
    await client.complete('calendar', 'open-event', 'view');
    check(
        'complete defaults',
        JSON.stringify(completed[1]) === JSON.stringify(['calendar', 'open-event', 'view', '', {}]),
        completed
    );
    await ticks();
    check(
        'complete reached and let go',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'calendar'],
                ['release', 'calendar'],
                ['reach', 'calendar'],
                ['release', 'calendar'],
            ]),
        asked
    );
    const quiet = errors.length;
    asked.length = 0;
    refusing.set('calendar', ['NOT_EXPORTED', 'call']);
    const unreached = await client.complete('calendar', 'open-event', 'view', '');
    await ticks();
    check('complete unreached offers none', Array.isArray(unreached) && !unreached.length, unreached);
    check('complete unreached logged', errors.length === quiet + 1, errors);
    check('complete unreached not let go', JSON.stringify(asked) === JSON.stringify([['reach', 'calendar']]), asked);
    errors.length = quiet;
    refusing.delete('calendar');
    asked.length = 0;
    const plainOffers = await client.complete('plain', 'pick', 'which', '');
    check('no completeCommand offers none', Array.isArray(plainOffers) && !plainOffers.length, plainOffers);
    check('complete broke handed on', (await completing('off', 'pick', 'which', '')) === 'BROKE');
    const odd = await rejection(client.complete('note', 'pick', 'which', ''));
    check('complete no list rejects', !!odd && odd.kind === undefined, odd);
    await ticks();
    check(
        'complete let go each',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'plain'],
                ['release', 'plain'],
                ['reach', 'off'],
                ['release', 'off'],
                ['reach', 'note'],
                ['release', 'note'],
            ]),
        asked
    );

    // What is declared is kept, and read again on the interface's signals.
    check(
        'signals heard',
        JSON.stringify([...heard.keys()]) ===
            JSON.stringify(['deckit/commands:contributions-changed', 'deckit/commands:owner-changed']),
        [...heard.keys()]
    );
    const later = { mod: { id: 'plain', name: 'Plain' }, entry: { id: 'later', title: 'Later' } };
    const hasLater = async () => (await client.list()).commands.some((each) => each.id === 'later');
    contributions.push(later);
    check('kept until a signal', !(await hasLater()));
    signal('deckit/commands:contributions-changed');
    check('read again as declarations change', await hasLater());
    contributions.pop();
    check('kept again', await hasLater());
    signal('deckit/commands:owner-changed');
    check('read again as the owner changes', !(await hasLater()));
    check('nothing logged', errors.length === 0, errors);

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
