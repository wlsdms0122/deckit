// The Switcher's list (mods/switcher/src/switcher/switcher.js) over a stand-in for deckit, the shell and the list it
// draws: the actions mods declare to switcher/actions are listed under their mods beside those a run set, one with a
// command runs it through deckit/commands and one with none is read only, and none is listed while the switcher does
// not own the interface. Exits 1 with a line for each check that failed.
const path = require('path');

const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const source = path.join(__dirname, '..', '..', 'deckit', 'mods', 'switcher', 'src');
    // The list as it is drawn: what it was opened with is kept.
    const opened = [];
    const model = { setNow: () => {}, mark: () => {}, say: () => {}, setResolved: () => {} };
    require.cache[path.join(source, 'list', 'list.js')] = {
        loaded: true,
        exports: { open: (_drawing, options) => (opened.push(options), { model, close: () => {} }) },
    };
    const { switcher } = require(path.join(source, 'switcher', 'switcher.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let owns = true;
    const ran = [];
    const contributions = [
        {
            mod: { id: 'a', name: 'A' },
            entry: { label: 'Show Log', keywords: ['log'], command: 'show-log', args: { lines: 10 } },
        },
        { mod: { id: 'a', name: 'A' }, entry: { label: 'Read Only' } },
        { mod: { id: 'b', name: 'B' }, entry: { hint: 'no label', command: 'show' } },
    ];
    const commands = { run: async (mod, id, args) => (ran.push([mod, id, args]), null) };
    const deckit = {
        storage: { records: { get: (_key, fallback) => fallback, set: () => {} } },
        mods: { list: async () => ({ found: [{ id: 'a', name: 'A' }], running: [], interfaces: {} }) },
        exports: {
            contributions: async (name) => {
                if (!owns) throw Object.assign(new Error(`does not own ${name}`), { kind: 'NOT_OWNER' });
                return name === 'switcher/actions'
                    ? contributions.map(({ mod, entry }) => ({
                          mod: { name: mod.name },
                          credential: { mod: mod.id, permissions: [] },
                          entry,
                      }))
                    : [];
            },
        },
    };
    // The page's document and the shell's windows, each window opened answering one to close.
    global.document = { createElement: () => ({}) };
    const shell = {
        ui: {},
        theme: {},
        iconOf: () => '',
        mods: { list: () => [], open: async () => {} },
        windows: { open: () => ({ close: () => {} }) },
    };
    const connection = { mod: { name: 'A' }, credential: { mod: 'a', permissions: [] } };
    const given = new Map([[connection, { list: () => [{ label: 'Set', value: 1 }] }]]);
    const list = switcher(shell, deckit, given, { commands: () => commands });

    await list.show();
    const items = opened[0]?.items ?? [];
    const labels = items.map((item) => `${item.mod}:${item.label}`);
    check(
        'the declared actions are listed under their mod beside those its run set',
        labels.join() === 'a:Set,a:Show Log,a:Read Only',
        labels
    );
    check(
        'a declared action keeps the data it was declared with',
        items[1]?.keywords === 'log' && items[1]?.command === 'show-log' && items[1]?.args?.lines === 10,
        items[1]
    );
    check('a declared action with no command is read only', items[2]?.run === undefined, items[2]);
    await items[1].run();
    await tick();
    check(
        'picking a declared action runs its command through deckit/commands',
        JSON.stringify(ran) === JSON.stringify([['a', 'show-log', { lines: 10 }]]),
        ran
    );

    list.putAway();
    owns = false;
    await list.show();
    const after = (opened[1]?.items ?? []).map((item) => item.label);
    check('no declared action is listed while the switcher does not own the interface', after.join() === 'Set', after);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} switcher checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} switcher checks`);
}

main().catch((error) => {
    console.error('[switcher] ' + (error.stack || error.message));
    process.exit(1);
});
