// The regions mods give in their views (deckit-shell/shell/region/main), over a stand-in for what connect answers: a
// child is the child of the mod picked for the interface its view names as parent, at a version it takes, a region
// shows only the children of its own interface, so a mod that gives regions for two keeps them apart, and a new pick
// takes a child out of the old one's region and to the new one's children. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createRegion } = await import(url('deckit-shell', 'shell', 'region', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // `board` and `tool` are children of `dash/boards` and `dash/tools`, which `dash` implements, and `other` and
    // `tool` implement one of.
    const mods = [
        { id: 'dash', name: 'Dash', implements: { 'dash/boards': '1.0.0', 'dash/tools': '1.0.0' } },
        { id: 'other', name: 'Other', implements: { 'dash/boards': '1.0.0' } },
        { id: 'board', name: 'Board', implements: {} },
        { id: 'tool', name: 'Tool', implements: { 'dash/tools': '1.0.0' } },
    ];
    const picks = new Map([
        ['dash/boards', 'dash'],
        ['dash/tools', 'dash'],
    ]);
    const untaken = new Set(); // the mods that do not take the version picked for what they name
    const pages = Object.fromEntries(mods.map(({ id }) => [id, { mod: id }]));
    const runs = Object.fromEntries(mods.map(({ id }) => [id, { mod: { id }, state: 'running', relaunches: false }]));
    const handlers = {};
    const sent = [];
    const observers = {};
    const changes = [];
    const deckit = {
        channels: {
            bind: (declared) => ({
                handle: (handler) => (handlers[declared.channel] = handler),
                on: (handler) => (handlers[declared.channel] = handler),
                send: (page, payload) => sent.push({ page, payload }),
            }),
        },
        mods: {
            notifications: ['didTerminate'],
            list: () => mods,
            // As deckit's: null for a dependent that does not take the pick, and for one that is itself the pick.
            pickOf: (named, dependent) => {
                const picked = picks.get(named) ?? null;
                return untaken.has(dependent) || picked === dependent ? null : picked;
            },
            runOf: (id) => runs[id],
            runs: () => Object.values(runs).map((run) => ({ run, page: pages[run.mod.id] })),
            listingOf: () => null,
            modOf: (page) => page?.mod ?? null,
            observe: (name, observer) => ((observers[name] ||= []).push(observer), () => {}),
            onChange: (listener) => (changes.push(listener), () => {}),
        },
        pages: { whenEnds() {} },
    };
    const REGION = createRegion({ deckit });
    REGION.start();
    const channel = (name) => handlers[`deckit-shell:region-${name}`];
    const join = (id, parent) =>
        observers.didJoin.forEach((observer) => observer({ mod: { id }, summary: { view: true, parent } }));
    join('dash', null);
    join('other', null);
    join('board', 'dash/boards');
    join('tool', 'dash/tools');
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    channel('rect')({ region: 1, interface: 'dash/boards', ...rect }, pages.dash);
    channel('rect')({ region: 2, interface: 'dash/tools', ...rect }, pages.dash);

    const children = channel('children')({}, pages.dash);
    check(
        "a parent's children are listed by the interface they name",
        JSON.stringify(children) ===
            JSON.stringify({
                'dash/boards': [{ id: 'board', name: 'Board', icon: '' }],
                'dash/tools': [{ id: 'tool', name: 'Tool', icon: '' }],
            }),
        children
    );
    check(
        'a child is the child of the mod picked for its interface',
        REGION.parentOf('board') === 'dash' && REGION.interfaceOf('board') === 'dash/boards',
        [REGION.parentOf('board'), REGION.interfaceOf('board')]
    );

    let refused = '';
    try {
        channel('place')({ region: 1, interface: 'dash/boards', id: 'tool' }, pages.dash);
    } catch (error) {
        refused = error.message;
    }
    check("a region refuses a child of another of its mod's interfaces", !!refused, refused);
    refused = '';
    try {
        channel('place')({ region: 3, interface: 'dash/boards', id: 'board' }, pages.other);
    } catch (error) {
        refused = error.message;
    }
    check('a mod not picked for the interface has no children of it', !!refused, refused);

    channel('place')({ region: 1, interface: 'dash/boards', id: 'board' }, pages.dash);
    channel('place')({ region: 2, interface: 'dash/tools', id: 'tool' }, pages.dash);
    const laid = [...REGION.laidOut('dash', () => true).keys()].join();
    check("each region shows its interface's child", laid === 'board,tool', laid);

    picks.set('dash/boards', 'other');
    sent.length = 0;
    changes.forEach((listener) => listener());
    const after = [...REGION.laidOut('dash', () => true).keys()].join();
    check("a new pick takes the child out of the old one's region", after === 'tool', after);
    const told = sent.find(({ page }) => page === pages.other)?.payload.children;
    check(
        'the mod picked now hears the child among its children',
        JSON.stringify(told) === JSON.stringify({ 'dash/boards': [{ id: 'board', name: 'Board', icon: '' }] }),
        sent
    );
    const before = sent.find(({ page }) => page === pages.dash)?.payload.children;
    check(
        'the mod picked before hears it gone',
        JSON.stringify(before) ===
            JSON.stringify({ 'dash/boards': [], 'dash/tools': [{ id: 'tool', name: 'Tool', icon: '' }] }),
        sent
    );

    untaken.add('board');
    check('a child that does not take the version picked has no parent', REGION.parentOf('board') === null, '');
    untaken.delete('board');

    picks.set('dash/tools', 'tool');
    check('a mod picked for the interface it names is no child', REGION.parentOf('tool') === null, '');
    check('a child with no parent picked is still a child', REGION.interfaceOf('tool') === 'dash/tools', '');

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} region checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
