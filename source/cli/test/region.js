// The regions mods give in their views (deckit-shell/shell/region/main), over a stand-in for what connect answers: a
// child is the child of the owner of the interface its view names as parent, at the major it uses, a region shows only
// the children of its own interface, so a mod that gives regions for two keeps them apart, and a new owner takes a
// child out of the old one's region and to the new one's children, a child that does not run launches as a region
// shows it, a view, as a mod's manifest fields give it, names as parent only an interface its mod uses, and a bundle
// that does not load is no child and has none. Exits 1 with a line for each check that failed. The packages are ES
// modules, so they are imported as such.
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

    // `board` and `tool` are children of `dash/boards` and `dash/tools`, which `dash` provides, and `other` and `tool`
    // provide one of.
    const mods = [
        { id: 'dash', name: 'Dash', provides: { 'dash/boards': [1], 'dash/tools': [1] }, uses: {} },
        { id: 'other', name: 'Other', provides: { 'dash/boards': [1] }, uses: {} },
        { id: 'board', name: 'Board', provides: {}, uses: { 'dash/boards': 1 } },
        { id: 'tool', name: 'Tool', provides: { 'dash/tools': [1] }, uses: { 'dash/tools': 1 } },
        { id: 'idle', name: 'Idle', provides: {}, uses: { 'dash/boards': 1 } },
        // A bundle that does not load, as deckit lists it: it has no manifest, so it is no child and gives no regions.
        { id: 'broken', refusal: { stage: 'read', kind: 'NOT_LOADABLE', message: 'no main.js' } },
    ];
    // The manifest fields of each: every one a view, `board`, `tool` and `idle` naming a parent; `idle` does not run.
    const fields = {
        dash: { view: { sidebar: true } },
        other: { view: {} },
        board: { view: { parent: 'dash/boards' }, icon: '<svg/>' },
        tool: { view: { parent: 'dash/tools' } },
        idle: { view: { parent: 'dash/boards' } },
    };
    const launched = [];
    const owners = new Map([
        ['dash/boards', 'dash'],
        ['dash/tools', 'dash'],
    ]);
    const unreached = new Set(); // the mods whose interface's owner does not provide the major they use
    const pages = Object.fromEntries(mods.map(({ id }) => [id, { mod: id }]));
    const runs = Object.fromEntries(
        mods
            .filter(({ id, refusal }) => id !== 'idle' && !refusal)
            .map(({ id }) => [id, { mod: { id }, state: 'running', relaunches: false }])
    );
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
            // As deckit's: null for a dependent the owner does not reach, and for one that is itself the owner.
            ownerOf: (named, dependent) => {
                const owner = owners.get(named) ?? null;
                return unreached.has(dependent) || owner === dependent ? null : owner;
            },
            runOf: (id) => runs[id],
            runs: () => Object.values(runs).map((run) => ({ run, page: pages[run.mod.id] })),
            fieldsOf: (id) => fields[id] ?? null,
            launch: async (id) => launched.push(id),
            modOf: (page) => page?.mod ?? null,
            observe: (name, observer) => ((observers[name] ||= []).push(observer), () => {}),
            onChange: (listener) => (changes.push(listener), () => {}),
        },
        pages: { whenEnds() {} },
    };
    const REGION = createRegion({ deckit });
    REGION.start();
    const channel = (name) => handlers[`deckit-shell:region-${name}`];
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    channel('rect')({ region: 1, interface: 'dash/boards', ...rect }, pages.dash);
    channel('rect')({ region: 2, interface: 'dash/tools', ...rect }, pages.dash);

    const children = channel('children')({}, pages.dash);
    check(
        "a parent's children are listed by the interface they name",
        JSON.stringify(children) ===
            JSON.stringify({
                'dash/boards': [
                    { id: 'board', name: 'Board', icon: '<svg/>' },
                    { id: 'idle', name: 'Idle', icon: '' },
                ],
                'dash/tools': [{ id: 'tool', name: 'Tool', icon: '' }],
            }),
        children
    );
    check(
        'a child is the child of the owner of its interface',
        REGION.parentOf('board') === 'dash' && REGION.interfaceOf('board') === 'dash/boards',
        [REGION.parentOf('board'), REGION.interfaceOf('board')]
    );

    check(
        'a bundle that does not load is no child and has none',
        REGION.interfaceOf('broken') === null &&
            REGION.parentOf('broken') === null &&
            JSON.stringify(channel('children')({}, pages.broken)) === '{}',
        ''
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
    check('a mod that does not own the interface has no children of it', !!refused, refused);

    channel('place')({ region: 1, interface: 'dash/boards', id: 'idle' }, pages.dash);
    check('a child that does not run launches as a region shows it', launched.join() === 'idle', launched);
    channel('place')({ region: 1, interface: 'dash/boards', id: 'board' }, pages.dash);
    check('a child that runs is not launched again', launched.join() === 'idle', launched);
    channel('place')({ region: 2, interface: 'dash/tools', id: 'tool' }, pages.dash);
    const laid = [...REGION.laidOut('dash', () => true).keys()].join();
    check("each region shows its interface's child", laid === 'board,tool', laid);

    owners.set('dash/boards', 'other');
    sent.length = 0;
    changes.forEach((listener) => listener());
    const after = [...REGION.laidOut('dash', () => true).keys()].join();
    check("a new owner takes the child out of the old one's region", after === 'tool', after);
    const told = sent.find(({ page }) => page === pages.other)?.payload.children;
    check(
        'the owner now hears the child among its children',
        JSON.stringify(told) ===
            JSON.stringify({
                'dash/boards': [
                    { id: 'board', name: 'Board', icon: '<svg/>' },
                    { id: 'idle', name: 'Idle', icon: '' },
                ],
            }),
        sent
    );
    const before = sent.find(({ page }) => page === pages.dash)?.payload.children;
    check(
        'the owner before hears it gone',
        JSON.stringify(before) ===
            JSON.stringify({ 'dash/boards': [], 'dash/tools': [{ id: 'tool', name: 'Tool', icon: '' }] }),
        sent
    );

    unreached.add('board');
    check("a child its interface's owner does not reach has no parent", REGION.parentOf('board') === null, '');
    unreached.delete('board');

    owners.set('dash/tools', 'tool');
    check('the owner of the interface it names is no child', REGION.parentOf('tool') === null, '');
    check('a child with no parent is still a child', REGION.interfaceOf('tool') === 'dash/tools', '');

    const FIELD = await import(url('deckit-shell', 'shell', 'panel', 'model', 'field.js'));
    const child = { uses: { 'dash/boards': 1 } };
    const named = FIELD.viewOf({ view: { parent: 'dash/boards', sidebar: true } }, child);
    check(
        'a view may name as parent an interface its mod uses',
        JSON.stringify(named) === JSON.stringify({ sidebar: true, parent: 'dash/boards' }),
        named
    );
    check(
        'a view naming as parent an interface its mod does not use is left out',
        FIELD.viewOf({ view: { parent: 'dash/tools' } }, child) === null,
        ''
    );
    check(
        'a mod whose fields give no view has none',
        FIELD.viewOf({}, child) === null && FIELD.viewOf({ view: 'yes' }, child) === null,
        ''
    );
    const keywords = FIELD.keywordsOf({ keywords: ['files', 3, '', 'folder'] }).join();
    check('the keywords field reads as the words among it', keywords === 'files,folder', keywords);
    check('an icon that is no text is left out', FIELD.iconOf({ icon: 3 }) === '', '');
    check(
        'the panel reads its manifest fields by the keys it names',
        FIELD.KEYS.join() === 'view,icon,keywords',
        FIELD.KEYS
    );

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
