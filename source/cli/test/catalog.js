// The mods as the core reads them (deckit-shell/deckit/catalog), over a stand-in for the core: each with whether it is
// a system mod, the manifest fields the layers named, by key, as written, whether a permission is privileged, and why
// one does not load, with its kind; what a mod with deckit.mods (deckit/mods/main.js) is answered of them, a launch it
// asks made in its name and a refusal of a request answered with its stage and kind; and what the host app
// (deckit/api/index.js) is answered of them, and what it hears through it: each mod's sandbox page by the mod's id,
// each erase of a mod's data, and its own state in a folder by name. Exits 1 with a line for each check that failed.
// The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

// A mod as `catalog/read` answers it.
const found = (id, { system, fields, permissions = [] }) => ({
    manifest: {
        id,
        name: id.toUpperCase(),
        version: '1.0.0',
        api: '1.0.0',
        main: 'main.js',
        provides: {},
        uses: {},
        permissions,
        contributes: {},
        fields,
    },
    folder: `/mods/${id}`,
    data: `/data/${id}`,
    installed: true,
    shipped: true,
    system,
    granted: permissions.filter(({ usable }) => usable).map(({ id }) => id),
    hides: [],
    revision: '1',
    uses: [],
    entry: `/mods/${id}/main.js`,
});

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const { createCatalog } = await import(url('deckit-shell', 'deckit', 'catalog', 'index.js'));
    const { createMods } = await import(url('deckit-shell', 'deckit', 'mods', 'main.js'));
    const { createApi } = await import(url('deckit-shell', 'deckit', 'api', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let heard = null;
    IPC.carry(
        {
            messages: { listen: (listeners) => (heard = listeners), tell: () => {} },
            pages: { isGone: () => false, watch: () => {} },
        },
        { report: () => {} }
    );
    // Mod s is a system mod granted a privileged permission and writes two fields; mod p is not, and writes none. Mod r
    // is refused as it is read, and mod d, shipped, did not install, with no refusal.
    const REACH = { id: 'deckit.reach-mods', name: 'Reach Mods', description: 'It reaches.', privileged: true };
    const answers = {
        'catalog/install-shipped': [],
        'catalog/read': [
            found('s', {
                system: true,
                fields: { icon: '<svg/>', view: { sidebar: true } },
                permissions: [{ ...REACH, reason: 'It runs commands.', usable: true }],
            }),
            found('p', { system: false, fields: {} }),
            { ...found('r', { system: false, fields: {} }), problem: { kind: 'NOT_LOADABLE', message: 'no main.js' } },
            {
                ...found('d', { system: false, fields: {} }),
                installed: false,
                problem: { message: 'the disk is full' },
            },
        ],
        'catalog/interfaces': [],
        'erasure/uncleared': [],
    };
    const CORE = { request: async (method) => structuredClone(answers[method]) };
    const warned = [];
    const LOG = { info: () => {}, warn: (line) => warned.push(line), error: () => {} };
    const CATALOG = createCatalog({ CORE, LOG, files: { readText: async () => '' } });
    await CATALOG.load();

    const [system, plain, refused, notInstalled] = CATALOG.found();
    check(
        'a mod read says whether it is a system mod',
        system.system === true && plain.system === false,
        CATALOG.found().map(({ id, system }) => [id, system])
    );
    check(
        'a mod read has the manifest fields it writes, by key, as written',
        system.fields.icon === '<svg/>' && system.fields.view.sidebar === true && !Object.keys(plain.fields).length,
        system.fields
    );
    check(
        'a permission a mod asks for says whether it is privileged',
        system.permissions[0].privileged === true,
        system.permissions
    );
    check(
        'a mod that does not load says why, with its kind, null for a problem that is no refusal',
        system.problem === null &&
            JSON.stringify(refused.problem) === '{"kind":"NOT_LOADABLE","message":"no main.js"}' &&
            JSON.stringify(notInstalled.problem) === '{"kind":null,"message":"the disk is full"}',
        [system.problem, refused.problem, notInstalled.problem]
    );
    check('the log says why a mod does not load', warned.includes('mod r not loaded: no main.js'), warned);
    check(
        'the mods that load are those with no problem',
        CATALOG.mods()
            .map(({ id }) => id)
            .join() === 's,p',
        CATALOG.mods().map(({ id }) => id)
    );

    // A mod with deckit.mods asks what it reads of every mod.
    const PAGE = { mod: 's' };
    const IDENTITY = {
        modFrom: (page) => ({ id: page.mod }),
        modOf: (page) => ({ id: page.mod }),
        whenPageEnds: () => {},
    };
    const launches = [];
    const RUNNER = {
        runOf: () => null,
        launchedOf: () => null,
        observe: () => () => {},
        onProblem: () => () => {},
        launch: async (id, by) => {
            launches.push([id, by]);
            if (id === 'r')
                throw Object.assign(new Error('r did not launch'), { stage: 'launch', kind: 'NOT_LAUNCHED' });
        },
    };
    const requests = []; // `from>to`, each request told
    const REQUEST = { tell: (from, to) => requests.push(`${from}>${to}`), onRequest: () => () => {} };
    const MODS = createMods({
        CORE,
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        REQUEST,
        pages: { clearStorage: async () => {} },
    });
    MODS.start();
    await tick();
    const listed = await heard.asked(PAGE, { channel: 'deckit-shell:mods', payload: {} });
    const entries = listed?.value?.found ?? [];
    check(
        'deckit.mods lists each mod with whether it is a system mod',
        JSON.stringify(entries.map(({ id, system }) => [id, system])) ===
            '[["s",true],["p",false],["r",false],["d",false]]',
        listed
    );
    check(
        'deckit.mods lists each mod with its manifest fields, by key, as written',
        entries[0]?.fields?.icon === '<svg/>' && entries[0]?.fields?.view?.sidebar === true,
        entries[0]?.fields
    );
    check(
        'deckit.mods lists why a mod does not load, with its kind',
        entries[0]?.problem === null &&
            entries[2]?.problem?.kind === 'NOT_LOADABLE' &&
            entries[2]?.problem?.message === 'no main.js' &&
            entries[3]?.problem?.kind === null,
        entries.map(({ problem }) => problem)
    );

    const launched = await heard.asked(PAGE, { channel: 'deckit-shell:mods-launch', payload: { id: 'p' } });
    check(
        'a launch a mod asks is made in its name',
        JSON.stringify(launches) === '[["p","s"]]' && 'value' in launched && !launched.error,
        { launches, launched }
    );
    check('a launch a mod asks is told as its request of that mod', requests.join() === 's>p', requests);
    const refusedLaunch = await heard.asked(PAGE, { channel: 'deckit-shell:mods-launch', payload: { id: 'r' } });
    check(
        'a request refused is answered with its stage and kind',
        JSON.stringify(refusedLaunch.error) === '{"message":"r did not launch","kind":"NOT_LAUNCHED","stage":"launch"}',
        refusedLaunch
    );

    // The host app reads a mod's fields.
    const sandboxListeners = []; // what hears each sandbox page through the runner
    const erasers = []; // what MODS asks to erase
    const api = createApi({
        CONFIG: { id: 'deckit', name: 'Deckit' },
        CORE: { onDown: () => () => {} },
        STORAGE: { stateIn: (folder) => ({ folder }) },
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER: {
            ...RUNNER,
            onSandbox: (listener) => sandboxListeners.push(listener) && (() => sandboxListeners.pop()),
        },
        MODS: { onErase: (eraser) => erasers.push(eraser) && (() => erasers.pop()) },
        OPEN: {},
        REQUEST,
        PERMISSION: { define: () => {} },
        MANIFEST_FIELD: { define: () => {} },
        SETUP: { stack: () => {} },
    }).make({ onStart: () => {}, restart: () => {} });
    const fields = api.mods.fieldsOf('s');
    check(
        "the host app reads a mod's manifest fields, frozen",
        fields?.icon === '<svg/>' && fields.view.sidebar === true && Object.isFrozen(fields.view),
        fields
    );
    check('the host app reads no fields of a mod that does not load', api.mods.fieldsOf('none') === null, '');
    const granted = api.mods.grantedOf('s');
    check(
        'the host app reads what a mod is granted, frozen, and nothing of a mod that does not load',
        granted?.join() === 'deckit.reach-mods' && Object.isFrozen(granted) && api.mods.grantedOf('none') === null,
        granted
    );
    const hosted = api.mods.list();
    check(
        'the host app lists every mod found, in order',
        hosted.map(({ id }) => id).join() === 's,p,r,d',
        hosted.map(({ id }) => id)
    );
    check(
        'the host app lists a mod that loads as its manifest was read',
        JSON.stringify(hosted[0]) === JSON.stringify(answers['catalog/read'][0].manifest) && !('refusal' in hosted[0]),
        hosted[0]
    );
    check(
        'the host app lists a mod that does not load as its refusal at read, with its kind, null for no refusal',
        JSON.stringify(hosted[2]) ===
            '{"id":"r","refusal":{"stage":"read","kind":"NOT_LOADABLE","message":"no main.js"}}' &&
            JSON.stringify(hosted[3].refusal) === '{"stage":"read","kind":null,"message":"the disk is full"}',
        [hosted[2], hosted[3]]
    );
    check(
        'what the host app lists is frozen',
        Object.isFrozen(hosted) && Object.isFrozen(hosted[2].refusal) && Object.isFrozen(hosted[0].fields),
        ''
    );

    const sandboxed = [];
    const offSandbox = api.pages.onSandbox((page, id) => sandboxed.push([page, id]));
    for (const listener of sandboxListeners) listener(PAGE, { id: 's', granted: [] });
    offSandbox();
    check(
        "the host app hears each mod's sandbox page with the mod's id, until its off",
        JSON.stringify(sandboxed) === '[[{"mod":"s"},"s"]]' && !sandboxListeners.length,
        sandboxed
    );
    const eraser = async () => {};
    const offErase = api.mods.onErase(eraser);
    const asked = erasers[0] === eraser;
    offErase();
    check('the host app erases what it keeps of a mod as deckit erases its data', asked && !erasers.length, '');
    check(
        "the host app keeps its state in a folder by name, and its own in the host's",
        api.stateIn('web').folder === 'web' && api.state.folder === 'host',
        api.state
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} catalog checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} catalog checks`);
}

main().catch((error) => {
    console.error('[catalog] ' + (error.stack || error.message));
    process.exit(1);
});
