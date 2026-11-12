// The regions mods give in their windows (deckit-shell/shell/region/main), over a stand-in for what connect answers: a
// child is the child of the owner of the interface its view names as parent, at the major it uses, a region shows only
// the children of its own interface, so a mod that gives regions for two keeps them apart, each laid in the window of
// its region, and a new owner takes a child out of the old one's region and to the new one's children, a child that
// does not run launches as a region shows it, the children on screen are told so and told nothing as they move from
// one stage to another, a view, as a mod's manifest fields (shell/mods/field) give it, names as parent only an
// interface its mod uses, a mod is an app unless its fields say it is an accessory, and a bundle that does not load is
// no child and has none. Exits 1 with a line for each check that failed. The packages are ES modules, so they are
// imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createRegion } = await import(url('deckit-shell', 'shell', 'region', 'main.js'));
    const { createIcons } = await import(url('deckit-shell', 'shell', 'mods', 'icon.js'));
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
    // `board`'s icon is a file of its folder; `tool`'s field holds an SVG's text, which names no file.
    const ICON = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'/>";
    const files = { board: { 'icon.svg': ICON } };
    const fields = {
        dash: {},
        other: {},
        board: { view: { parent: 'dash/boards' }, icon: 'icon.svg' },
        tool: { view: { parent: 'dash/tools' }, icon: ICON },
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
            readFile: async (id, file) => files[id]?.[file] ?? null,
            launch: async (id) => launched.push(id),
            modOf: (page) => page?.mod ?? null,
            observe: (name, observer) => ((observers[name] ||= []).push(observer), () => {}),
            onChange: (listener) => (changes.push(listener), () => {}),
        },
        pages: { whenEnds() {} },
    };
    const ICONS = createIcons({ deckit });
    const REGION = createRegion({ deckit, ICONS });
    ICONS.start();
    REGION.start();
    await ICONS.ready();
    const channel = (name) => handlers[`deckit-shell:region-${name}`];
    const rect = { x: 0, y: 0, width: 100, height: 100 };
    channel('rect')({ region: 1, interface: 'dash/boards', window: 1, ...rect }, pages.dash);
    channel('rect')({ region: 2, interface: 'dash/tools', window: 2, ...rect }, pages.dash);

    const children = await channel('children')({}, pages.dash);
    check(
        "a parent's children are listed by the interface they name",
        JSON.stringify(children) ===
            JSON.stringify({
                'dash/boards': [
                    { id: 'board', name: 'Board', icon: ICON },
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
            JSON.stringify(await channel('children')({}, pages.broken)) === '{}',
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
    const laidOut = REGION.laidOut('dash', () => true);
    const laid = [...laidOut.keys()].join();
    check("each region shows its interface's child", laid === 'board,tool', laid);
    check(
        'each child is laid in the window of its region, at the rect in that window',
        JSON.stringify(laidOut.get('tool')) === JSON.stringify({ window: 2, rect }),
        [...laidOut]
    );
    channel('rect')({ region: 2, interface: 'dash/tools', window: null, ...rect }, pages.dash);
    const windowless = [...REGION.laidOut('dash', () => true).keys()].join();
    check('a region in no window lays no child', windowless === 'board', windowless);
    channel('rect')({ region: 2, interface: 'dash/tools', window: 2, ...rect }, pages.dash);
    sent.length = 0;
    const [desktop, floating] = [{}, {}];
    REGION.show(desktop, [pages.board]);
    await Promise.resolve();
    REGION.show(desktop, [pages.tool]);
    await Promise.resolve();
    const visible = sent.map(({ page, payload }) => `${page.mod}:${payload.open}`).join();
    check(
        'a child on screen is told so once, and told again as it leaves',
        visible === 'board:true,board:false,tool:true',
        visible
    );
    sent.length = 0;
    REGION.show(desktop, []);
    REGION.show(floating, [pages.tool]);
    await Promise.resolve();
    const moved = sent.map(({ page, payload }) => `${page.mod}:${payload.open}`).join();
    check('a child moved from one stage to another is told nothing', moved === '', moved);
    check(
        'a child one stage shows is shown elsewhere for every other',
        REGION.shownElsewhere(pages.tool, desktop) && !REGION.shownElsewhere(pages.tool, floating),
        [REGION.shownElsewhere(pages.tool, desktop), REGION.shownElsewhere(pages.tool, floating)]
    );

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
                    { id: 'board', name: 'Board', icon: ICON },
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

    const FIELD = await import(url('deckit-sdk', 'shell', 'mods', 'field.js'));
    const child = { uses: { 'dash/boards': 1 } };
    const named = FIELD.parentOf({ view: { parent: 'dash/boards' } }, child);
    check('a view may name as parent an interface its mod uses', named === 'dash/boards', named);
    check(
        'a view naming as parent an interface its mod does not use is left out',
        FIELD.parentOf({ view: { parent: 'dash/tools' } }, child) === null,
        ''
    );
    check(
        'a mod whose fields give no view has no parent',
        FIELD.parentOf({}, child) === null && FIELD.parentOf({ view: 'yes' }, child) === null,
        ''
    );
    check(
        'a mod is an app unless its fields say it is an accessory',
        FIELD.activationPolicyOf({}) === FIELD.REGULAR &&
            FIELD.activationPolicyOf({ activationPolicy: 'other' }) === FIELD.REGULAR &&
            FIELD.activationPolicyOf({ activationPolicy: 'accessory' }) === FIELD.ACCESSORY,
        ''
    );
    const keywords = FIELD.keywordsOf({ keywords: ['files', 3, '', 'folder'] }).join();
    check('the keywords field reads as the words among it', keywords === 'files,folder', keywords);
    check(
        "the icon field names a file of the mod's folder, and one that is no text names none",
        FIELD.iconPathOf({ icon: 'art/icon.svg' }) === 'art/icon.svg' &&
            FIELD.iconPathOf({ icon: 3 }) === null &&
            FIELD.iconPathOf({ icon: '' }) === null,
        ''
    );
    const square = "<?xml version='1.0'?>\n<!-- drawn -->\n<svg viewBox='0 0 128 128'><rect/></svg>";
    check('an SVG with a square viewBox is the icon', FIELD.iconOf(square) === square, '');
    check(
        'no file, one over 32 KB, a root that is not svg, and a viewBox absent or not square read as no icon',
        [
            null,
            `<svg viewBox="0 0 8 8">${' '.repeat(FIELD.ICON_BYTES)}</svg>`,
            '<html><svg viewBox="0 0 8 8"/></html>',
            '<svg width="8" height="8"/>',
            '<svg viewBox="0 0 16 12"/>',
        ].every((text) => FIELD.iconOf(text) === ''),
        ''
    );
    check(
        'the shell reads its manifest fields by the keys it names',
        FIELD.KEYS.join() === 'activationPolicy,view,icon,keywords',
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
