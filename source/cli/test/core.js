// Deckit's client of the core (deckit-shell/deckit/core), checked over a stand-in for how the environment reaches the
// core: what it sends first, the version of the mod contract it runs mods with, the shipped folders with their system
// marks, the permissions the layers define with their tier (deckit/permission) and the manifest fields they name
// (deckit/manifest-field), each refused with its kind, how it waits for that, what an answer and a refusal, with its
// kind and stage, come to, the start refused with the kind the core refuses initialize with and left to its caller to
// log, that a core that ended refuses everything after, and the state over the core (deckit/storage) not written while
// it is not read, a failure logged once. Exits 1 with a line for each check that failed. The packages are ES modules,
// so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const thrown = (work) => {
    try {
        work();
        return '';
    } catch (error) {
        return error.message;
    }
};
const kindThrown = (work) => {
    try {
        work();
        return null;
    } catch (error) {
        return error.kind ?? null;
    }
};
const outcome = (promise) =>
    promise.then(
        (value) => ({ value }),
        (error) => ({ error: error.message, kind: error.kind ?? null, stage: error.stage ?? null })
    );

async function main() {
    const { createCore } = await import(url('deckit-shell', 'deckit', 'core', 'main.js'));
    const { createPermission } = await import(url('deckit-shell', 'deckit', 'permission', 'index.js'));
    const { createManifestField } = await import(url('deckit-shell', 'deckit', 'manifest-field', 'index.js'));
    const { createStorage } = await import(url('deckit-shell', 'deckit', 'storage', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The core as the environment gives it: what deckit sends is kept, and the test answers for the core.
    const sent = [];
    let listeners = null;
    const core = {
        open(given) {
            listeners = given;
            return { send: (line) => sent.push(JSON.parse(line)) };
        },
    };
    const logged = [];
    const LOG = {
        info: (...parts) => logged.push(['info', ...parts]),
        warn: (...parts) => logged.push(['warn', ...parts]),
        error: (...parts) => logged.push(['error', ...parts]),
    };
    const answer = (id, result) => listeners.onMessage(JSON.stringify({ jsonrpc: '2.0', id, result }));
    const FOLDERS = {
        ship: [
            { folder: '/ship/a', system: true },
            { folder: '/ship/b', system: false },
        ],
        sources: [],
    };
    const CORE = createCore({ FOLDERS, LOG, core, home: '/home/deckit', api: '1.2.0' });
    const PERMISSION = createPermission();
    PERMISSION.define({ id: 'a.b', name: 'B', description: 'It does b.' });
    PERMISSION.define({ id: 'a.c', name: 'C', description: 'It does c.', privileged: true });
    const MANIFEST_FIELD = createManifestField();
    MANIFEST_FIELD.define('icon');
    MANIFEST_FIELD.define('view');
    check(
        'a permission whose tier is no boolean is refused',
        /no boolean/.test(
            thrown(() => PERMISSION.define({ id: 'a.d', name: 'D', description: 'd', privileged: 'yes' }))
        ),
        ''
    );
    check('a manifest field named twice is refused', /twice/.test(thrown(() => MANIFEST_FIELD.define('icon'))), '');
    const kinds = [
        kindThrown(() => MANIFEST_FIELD.define('icon')),
        kindThrown(() => MANIFEST_FIELD.define(1)),
        kindThrown(() => PERMISSION.define({ id: 'a.b', name: 'B', description: 'It does b.' })),
        kindThrown(() => PERMISSION.define({ id: 'a.f', name: ' ', description: 'f' })),
    ];
    check(
        'a manifest field is refused of kind FIELD, and a permission of kind PERMISSION',
        kinds.join() === 'FIELD,FIELD,PERMISSION,PERMISSION',
        kinds
    );
    const blank = { field: createManifestField(), permission: createPermission() };
    blank.field.define('');
    blank.permission.define({ id: ' ', name: 'Blank', description: 'It does nothing.' });
    check(
        'a field of a blank name and a permission of a blank id are taken, and a name of White_Space only is refused',
        JSON.stringify(blank.field.all().fields) === '[""]' &&
            blank.permission.all().permissions[0].id === ' ' &&
            kindThrown(() => createPermission().define({ id: 'a.g', name: '\u0085', description: 'g' })) ===
                'PERMISSION',
        ''
    );

    const initialized = outcome(CORE.start({ ...PERMISSION.all(), ...MANIFEST_FIELD.all() }));
    const early = outcome(CORE.request('catalog/read', {}));
    await tick();
    check('initialize goes first, alone', sent.length === 1 && sent[0].method === 'initialize', sent);
    const { params } = sent[0];
    check('initialize carries the home', params.home === '/home/deckit', params);
    check('initialize carries the version of the mod contract the host app names', params.api === '1.2.0', params);
    check(
        'initialize carries each shipped folder with its system mark',
        JSON.stringify(params.ship) === JSON.stringify(FOLDERS.ship),
        params.ship
    );
    check(
        'initialize carries the permissions, each with its tier, not privileged unless defined so',
        JSON.stringify(params.permissions.map(({ id, privileged }) => [id, privileged])) ===
            '[["a.b",false],["a.c",true]]',
        params.permissions
    );
    check('initialize carries the manifest fields named', JSON.stringify(params.fields) === '["icon","view"]', params);
    check(
        'a permission or a manifest field is not defined once the core started',
        /after the core started/.test(thrown(() => PERMISSION.define({ id: 'a.e', name: 'E', description: 'e' }))) &&
            /after the core started/.test(thrown(() => MANIFEST_FIELD.define('keywords'))) &&
            kindThrown(() => PERMISSION.define({ id: 'a.e', name: 'E', description: 'e' })) === 'PERMISSION' &&
            kindThrown(() => MANIFEST_FIELD.define('keywords')) === 'FIELD',
        ''
    );
    answer(sent[0].id, { mods: '/home/deckit/mods', data: '/home/deckit/data', timeout: { launch: 20, end: 5 } });
    check('the start resolves once the core answered initialize', 'value' in (await initialized), await initialized);
    check(
        'what initialize answered is kept: the folders, and how long a run is given in milliseconds',
        CORE.folders().mods === '/home/deckit/mods' && CORE.timeout().launch === 20000 && CORE.timeout().end === 5000,
        [CORE.folders(), CORE.timeout()]
    );
    await tick();
    check('what was asked before initialize is sent once it is answered', sent[1]?.method === 'catalog/read', sent);
    answer(sent[1].id, [1, 2]);
    const read = await early;
    check('an answer settles its request with the result', JSON.stringify(read.value) === '[1,2]', read);

    const refused = outcome(CORE.request('state/write', {}));
    await tick();
    listeners.onMessage(
        JSON.stringify({
            jsonrpc: '2.0',
            id: sent[2].id,
            error: { message: 'no', data: { kind: 'RESERVED', stage: 'call' } },
        })
    );
    const refusal = await refused;
    check(
        'a refusal rejects with its kind and stage',
        refusal.error === 'no' && refusal.kind === 'RESERVED' && refusal.stage === 'call',
        refusal
    );

    listeners.onMessage('not json');
    listeners.onMessage(JSON.stringify({ jsonrpc: '2.0', id: 999, result: null }));
    check(
        'what is no message, and an answer to nothing asked, are logged',
        logged.filter(([level]) => level === 'error').length === 2,
        logged
    );
    listeners.onLog('hello');
    check(
        "the core's log goes to deckit's",
        logged.some(([, a, b]) => a === 'core:' && b === 'hello'),
        logged
    );

    const pending = outcome(CORE.request('catalog/read', {}));
    await tick();
    listeners.onEnd('it exited with 1');
    const ended = await pending;
    check(
        'a core that ends refuses what waits, of kind ENDED, saying to restart',
        ended.kind === 'ENDED' && /it exited with 1/.test(ended.error) && /restart the app/.test(ended.error),
        ended
    );
    const before = sent.length;
    const after = await outcome(CORE.request('catalog/read', {}));
    check('a core that ended refuses what is asked after', after.kind === 'ENDED', after);
    check('nothing is sent to a core that ended', sent.length === before, sent.length);

    // A core that refuses initialize refuses the start with its kind, and answers nothing more.
    let refusing = null;
    const coreRefusing = {
        open(given) {
            refusing = given;
            return {
                send: (line) =>
                    refusing.onMessage(
                        JSON.stringify({
                            jsonrpc: '2.0',
                            id: JSON.parse(line).id,
                            error: { code: -32803, message: 'main is a field of the core', data: { kind: 'FIELD' } },
                        })
                    ),
            };
        },
    };
    const refusingLogged = [];
    const REFUSING_LOG = { info() {}, warn() {}, error: (...parts) => refusingLogged.push(parts) };
    const REFUSING = createCore({ FOLDERS, LOG: REFUSING_LOG, core: coreRefusing, home: '/home/deckit', api: '1.0.0' });
    const downs = [];
    REFUSING.onDown((why) => downs.push(why));
    const start = await outcome(REFUSING.start({ permissions: [], fields: ['main'] }));
    await tick();
    check(
        'a core that refuses initialize refuses the start with its kind, and is down',
        start.kind === 'FIELD' && /main is a field/.test(start.error) && downs.length === 1,
        { start, downs }
    );
    check('a core that refuses initialize logs nothing of it itself', refusingLogged.length === 0, refusingLogged);

    // The state over a core that refused initialize: not read until it is, and not written over.
    const UNREAD = createStorage({ CORE: REFUSING, LOG: REFUSING_LOG });
    const unread = await outcome(UNREAD.state.write('arranged', 1));
    check(
        'state not read is not written, refused with why, and nothing is logged',
        /was not read/.test(unread.error) && UNREAD.state.read('arranged') === null && refusingLogged.length === 0,
        { unread, refusingLogged }
    );
    const UNREADABLE = createStorage({ CORE: REFUSING, LOG: REFUSING_LOG });
    await UNREADABLE.load();
    const unwritten = await outcome(UNREADABLE.state.write('arranged', 1));
    check(
        'state the core did not give is logged once as not read, and a write to it is refused with why',
        refusingLogged.length === 1 && /not read/.test(refusingLogged[0][0]) && unwritten.kind === 'FIELD',
        { refusingLogged, unwritten }
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} core checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} core checks`);
}

main().catch((error) => {
    console.error('[core] ' + (error.stack || error.message));
    process.exit(1);
});
