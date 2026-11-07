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
            return { message: error.message, kind: error.kind };
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
    ];

    // The core: `reach(id)` resolves, and the connection stands as `stand(id)` says.
    const listeners = new Map(); // id -> [listener]
    const cleanups = new Map(); // id -> [cleanup]
    const asked = [];
    const exportsOf = new Map(); // id -> exports a running mod opens for its id
    const refusing = new Set();
    const silent = new Set(); // ids whose connection never stands
    const standing = new Set();
    const stand = async (id) => {
        standing.add(id);
        const cuts = [];
        for (const listener of listeners.get(id) ?? []) {
            const cut = await listener(exportsOf.get(id));
            if (typeof cut === 'function') cuts.push(cut);
        }
        cleanups.set(id, cuts);
    };
    const deckit = {
        dependencies: {
            onConnect: (id, listener) => {
                if (!listeners.has(id)) listeners.set(id, []);
                listeners.get(id).push(listener);
            },
            reach: async (id) => {
                asked.push(['reach', id]);
                if (refusing.has(id)) throw Object.assign(new Error(`${id} is out of reach`), { kind: 'REFUSED' });
                if (!silent.has(id)) setTimeout(() => stand(id), 5);
            },
            release: async (id) => {
                asked.push(['release', id]);
                standing.delete(id);
                for (const cut of cleanups.get(id) ?? []) cut();
                cleanups.delete(id);
            },
        },
        exports: { contributions: async (name) => (name === 'deckit/commands' ? contributions : []) },
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
    exportsOf.set('note', { runCommand: async () => () => 1 });
    exportsOf.set('plain', {});

    const commands = registry(deckit, { within: 60 });
    const credential = (permissions) => ({
        mod: { id: 'switcher', name: 'Switcher' },
        credential: { mod: 'switcher', permissions },
    });
    const outsider = commands.exportsFor(credential(['deckit.mods']));
    const client = commands.exportsFor(credential(['deckit.system-services']));

    // Refused without the permission.
    check('list refused', (await rejection(outsider.list()))?.kind === 'REFUSED');
    check('run refused', (await rejection(outsider.run('calendar', 'today')))?.kind === 'REFUSED');
    check('refused reaches nothing', asked.length === 0, asked);

    // The list.
    const listed = await client.list();
    check(
        'list',
        JSON.stringify(listed.map((each) => `${each.mod.id}:${each.id}`)) ===
            JSON.stringify(['calendar:today', 'calendar:open-event', 'note:today', 'plain:go', 'off:go']),
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

    // Runs at once on one mod share one reach.
    asked.length = 0;
    const both = await Promise.all([client.run('calendar', 'today'), client.run('calendar', 'today')]);
    await ticks();
    check(
        'both ran',
        both.every((one) => one?.day === 7),
        both
    );
    check(
        'one reach',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'calendar'],
                ['release', 'calendar'],
            ]),
        asked
    );

    // A refused reach is the run's refusal, and nothing is let go; the next run asks again.
    asked.length = 0;
    refusing.add('calendar');
    check('reach refused', (await kinds('calendar', 'today')) === 'REFUSED');
    await ticks();
    check('refused not let go', JSON.stringify(asked) === JSON.stringify([['reach', 'calendar']]), asked);
    refusing.delete('calendar');
    check('asks again', (await client.run('calendar', 'today'))?.day === 7);

    // No exports in time.
    asked.length = 0;
    silent.add('off');
    const late = await rejection(client.run('off', 'go'));
    await ticks();
    check('in time', late?.kind === 'NOT_RUNNING', late);
    check(
        'late let go',
        JSON.stringify(asked) ===
            JSON.stringify([
                ['reach', 'off'],
                ['release', 'off'],
            ]),
        asked
    );

    // No runCommand, and a function answered.
    check('no runCommand', (await kinds('plain', 'go')) === 'COMMAND');
    const answered = await rejection(client.run('note', 'today'));
    check('function answered', !!answered && answered.kind === undefined, answered);
    check('nothing logged', errors.length === 0, errors);

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
