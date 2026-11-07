// The mods as the core reads them (deckit-shell/deckit/catalog), over a stand-in for the core: each with whether it is
// a system mod, the manifest fields the layers named, by key, as written, and whether a permission is privileged; and
// what a mod with deckit.mods (deckit/mods/main.js) and the host app (api/index.js) are answered of them. Exits 1 with
// a line for each check that failed. The packages are ES modules, so they are imported as such.
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
    hides: [],
    revision: '1',
    uses: [],
    entry: `/mods/${id}/main.js`,
});

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const { createCatalog } = await import(url('deckit-shell', 'deckit', 'catalog', 'index.js'));
    const { createMods } = await import(url('deckit-shell', 'deckit', 'mods', 'main.js'));
    const { createApi } = await import(url('deckit-shell', 'api', 'index.js'));
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
    // Mod s is a system mod granted a privileged permission and writes two fields; mod p is not, and writes none.
    const REACH = { id: 'deckit.reach-mods', name: 'Reach Mods', means: 'It reaches.', privileged: true };
    const answers = {
        'catalog/install-shipped': [],
        'catalog/read': [
            found('s', {
                system: true,
                fields: { icon: '<svg/>', view: { sidebar: true } },
                permissions: [{ ...REACH, reach: 'deckit', reason: 'It runs commands.', usable: true }],
            }),
            found('p', { system: false, fields: {} }),
        ],
        'catalog/interfaces': [],
        'erasure/uncleared': [],
    };
    const CORE = { request: async (method) => structuredClone(answers[method]) };
    const LOG = { info: () => {}, warn: () => {}, error: () => {} };
    const CATALOG = createCatalog({ CORE, LOG, files: { readText: async () => '' } });
    await CATALOG.load();

    const [system, plain] = CATALOG.found();
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

    // A mod with deckit.mods asks what it reads of every mod.
    const PAGE = { mod: 's' };
    const IDENTITY = {
        modFrom: (page) => ({ id: page.mod }),
        modOf: (page) => ({ id: page.mod }),
        whenPageEnds: () => {},
    };
    const RUNNER = {
        runOf: () => null,
        launchedOf: () => null,
        observe: () => () => {},
        onProblem: () => () => {},
    };
    const MODS = createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, pages: { clearStorage: async () => {} } });
    MODS.start({ facts: () => ({}), installed: async () => ({}), removed: () => {}, erase: async () => {} });
    await tick();
    const listed = await heard.askedSync(PAGE, { channel: 'deckit-shell:mods', payload: {} });
    const entries = listed?.value?.found ?? [];
    check(
        'deckit.mods lists each mod with whether it is a system mod',
        JSON.stringify(entries.map(({ id, system }) => [id, system])) === '[["s",true],["p",false]]',
        listed
    );
    check(
        'deckit.mods lists each mod with its manifest fields, by key, as written',
        entries[0]?.fields?.icon === '<svg/>' && entries[0]?.fields?.view?.sidebar === true,
        entries[0]?.fields
    );

    // The host app reads a mod's fields.
    const api = createApi({
        CONFIG: { id: 'deckit', name: 'Deckit' },
        CORE: { onDown: () => () => {} },
        STORAGE: { stateIn: () => ({}) },
        LOG,
        IDENTITY,
        CATALOG,
        RUNNER,
        PERMISSION: { define: () => {} },
        MANIFEST_FIELD: { define: () => {} },
        WEB: {},
        KEYMAP: {},
        MAIN_PROCESS: { onChange: () => () => {}, restartPending: () => [] },
        SETUP: { stack: () => {} },
    }).make({ onStart: () => {}, restart: () => {} });
    const fields = api.mods.fieldsOf('s');
    check(
        "the host app reads a mod's manifest fields, frozen",
        fields?.icon === '<svg/>' && fields.view.sidebar === true && Object.isFrozen(fields.view),
        fields
    );
    check('the host app reads no fields of a mod that does not load', api.mods.fieldsOf('none') === null, '');

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
