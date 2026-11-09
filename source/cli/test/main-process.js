// A mod's main process modules (deckit-electron/main-process), main's side on a stand-in for what connect answers and
// for the loader, and the page's side, its layer, carried to main in the same process: a module started once per path
// on a page however many handles ask for it, what it emits reaching the page and heard by `on` until its lifecycle's
// scope is cut, an answer that cannot be copied refused, a call of a module not started refused NOT_STARTED, a start
// refused NOT_PERMITTED for a mod without system.main-process and an argument of another type INVALID_ARGUMENT, and
// `restartPending`, `statusOf` and `onChange` held to deckit.mods on both sides. A run launching, ending and its mod
// installed or removed reach the loader with the run's folder and data folder and the run's limit, and the app waits
// for the modules of a run that ended. Exits 1 with a line for each check that failed. The packages are ES modules, so
// they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const MAIN_IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const PAGE_IPC = await import(url('deckit-sdk', 'deckit', 'ipc', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const { attach } = await import(url('deckit-electron', 'main-process', 'main.js'));
    const { LAYERS } = await import(url('deckit-electron', 'main-process', 'renderer.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const refusalOf = (promise) =>
        promise.then(
            () => 'fulfilled',
            (error) => `${error.stage} ${error.kind}`
        );
    const thrownOf = (call) => {
        try {
            call();
            return 'answered';
        } catch (error) {
            return `${error.stage} ${error.kind}`;
        }
    };

    // The mods: `a` holds system.main-process and deckit.mods, `plain` nothing. The page is a's, and the channels
    // between it and main cross in this process.
    const modPage = { name: "a's page" };
    const plainPage = { name: "plain's page" };
    const granted = new Map([
        [modPage, { id: 'a', granted: ['system.main-process', 'deckit.mods'] }],
        [plainPage, { id: 'plain', granted: [] }],
    ]);
    let heard = null; // main's side of the channels
    let toPage = null; // the page's side
    MAIN_IPC.carry(
        {
            messages: {
                listen: (listeners) => (heard = listeners),
                tell: (page, message) => page === modPage && toPage(message),
            },
            pages: { isGone: () => false, watch: () => {} },
        },
        { report: () => {} }
    );
    PAGE_IPC.carry(
        {
            messages: {
                listen: ({ told }) => (toPage = told),
                tell: (message) => heard.told(modPage, message),
                ask: (message) => heard.asked(modPage, message),
            },
        },
        { report: () => {} }
    );
    // What main answers a page of plain's, as it asks.
    const askAsPlain = (channel, payload) =>
        heard
            .asked(plainPage, { channel, payload })
            .then((answer) => (answer.error ? `call ${answer.error.kind}` : ''));

    // The loader, as environment() answers it: a module has the method `add` and `bad`, which answers a function.
    const loaded = []; // [mod id, path]: each module started
    const handed = new Map(); // path -> what the module was handed
    const done = []; // what the loader was told
    let changed = null;
    const loader = {
        start: async (mod, given, handedOf) => {
            loaded.push([mod.id, given]);
            handed.set(given, handedOf(given));
            return { path: given, methods: [['add'], ['bad']] };
        },
        call: async (modId, given, [method], args) => {
            if (!loaded.some(([id, one]) => id === modId && one === given))
                throw Object.assign(new Error(`${given} is not started`), { kind: 'NOT_STARTED' });
            return method === 'add' ? args[0] + args[1] : () => {};
        },
        launching: (mod) => done.push(['launching', mod.id, mod.folder, mod.data, mod.pageOf() === modPage]),
        ended: async (mod, { within }) => {
            done.push(['ended', mod.id, within]);
            await tick();
        },
        removed: (modId, { running }) => done.push(['removed', modId, running]),
        installed: async (modId) => done.push(['installed', modId]),
        statusOf: (modId) => ({ running: modId === 'a', failure: null }),
        onChange: (listener) => (changed = listener),
        restartPending: () => [{ id: 'a', why: 'updated' }],
    };
    // What connect answers, as the module reaches it: a's run, its page a's page.
    const run = { mod: { id: 'a' }, folder: '/mods/a', data: '/data/a', state: 'running' };
    const observers = new Map(); // notification -> its observer
    const defined = [];
    const stacked = [];
    let started = null;
    let installed = null;
    let removed = null;
    let hold = null;
    let quits = 0;
    const deckit = {
        channels: MAIN_IPC.layerChannels,
        permissions: { define: (permission) => defined.push(permission.id) },
        stack: (name, options) => stacked.push([name, options]),
        onStart: (listener) => (started = listener),
        mods: {
            observe: (name, observer) => observers.set(name, observer),
            onInstalled: (listener) => (installed = listener),
            onRemoved: (listener) => (removed = listener),
            timeout: () => ({ launch: 20000, end: 5000 }),
            runOf: (id) => (id === 'a' ? run : null),
            runs: () => [{ run, page: modPage }],
            modFrom: (page, permission) => {
                const mod = granted.get(page);
                if (!mod) throw Object.assign(new Error('only a mod asks this'), { stage: 'call', kind: 'REFUSED' });
                if (permission && !mod.granted.includes(permission))
                    throw Object.assign(new Error(`${mod.id} does not have the ${permission} permission`), {
                        stage: 'call',
                        kind: 'NOT_PERMITTED',
                    });
                return mod.id;
            },
        },
        pages: { whenEnds: () => {} },
    };
    const files = { name: () => {}, fresh: () => {}, rename: () => {}, move: () => {}, trash: () => {} };
    const app = { onQuit: (given) => (hold = given), quit: () => quits++ };
    attach(deckit, { mainProcess: loader, app, files });
    check(
        'attach defines system.main-process and stacks its layer, which main sets up with nothing',
        JSON.stringify(defined) === '["system.main-process"]' &&
            stacked.length === 1 &&
            stacked[0][0] === 'mainProcess' &&
            stacked[0][1] === undefined,
        [defined, stacked]
    );
    started();

    // A run launching, ending, and its mod installed or removed.
    observers.get('willLaunch')(run);
    installed('a');
    removed('a');
    observers.get('didTerminate')(run);
    check(
        "the loader is told of a run with the run's folder and data folder and the page it runs in, and of its end in " +
            "the run's limit",
        JSON.stringify(done) ===
            '[["launching","a","/mods/a","/data/a",true],["installed","a"],["removed","a",true],["ended","a",5000]]',
        done
    );
    check('the app waits for the modules of a run that ended', hold() === true && quits === 0, quits);
    await tick();
    await tick();
    check('the app quits once they have ended', quits === 1 && hold() === false, quits);

    // The page's side: the layer hands every lifecycle the handle `mainProcess`, made with that lifecycle's scope.
    const delivered = [];
    const deliver = (what, listener, ...args) => {
        delivered.push(what);
        listener(...args);
    };
    const layerOf = (permissions) =>
        LAYERS.mainProcess({ setup: null, channels: PAGE_IPC.layerChannels })({
            mod: { id: 'a' },
            granted: permissions,
            deliver,
        });
    const layer = layerOf(['system.main-process', 'deckit.mods']);
    const first = makeScope();
    const second = makeScope();
    const [one, other] = await Promise.all([
        layer.frameworks.mainProcess(first).start('main-process/a.js'),
        layer.frameworks.mainProcess(second).start('main-process/a.js'),
    ]);
    check(
        'a module is started once per path on a page, however many handles ask for it',
        JSON.stringify(loaded) === '[["a","main-process/a.js"]]',
        loaded
    );
    check('its methods are called through main', (await one.add(2, 3)) === 5, '');
    check(
        'an answer that cannot be copied is refused',
        await one.bad().then(
            () => false,
            (error) => /cannot be copied/.test(error.message)
        ),
        ''
    );
    const heardOne = [];
    const heardOther = [];
    one.on('tick', (value) => heardOne.push(value));
    other.on('tick', (value) => heardOther.push(value));
    handed.get('main-process/a.js').emit('tick', 1);
    check(
        "what a module emits reaches the mod's page and each listener on it",
        JSON.stringify([heardOne, heardOther]) === '[[1],[1]]',
        [heardOne, heardOther]
    );
    first.cut();
    handed.get('main-process/a.js').emit('tick', 2);
    check(
        "a listener is heard until its lifecycle's scope is cut",
        JSON.stringify([heardOne, heardOther]) === '[[1],[1,2]]',
        [heardOne, heardOther]
    );
    check(
        'a call of a module not started is refused NOT_STARTED',
        await heard
            .asked(modPage, {
                channel: 'deckit-electron:main-process-call',
                payload: { path: 'main-process/b.js', method: ['add'], args: [] },
            })
            .then(
                (answer) => answer.error?.kind === 'NOT_STARTED' && /mainProcess\.start\(\)/.test(answer.error.message)
            ),
        ''
    );
    const handle = layer.frameworks.mainProcess(makeScope());
    check(
        'a mod with deckit.mods reads which mods only a restart finishes and how their modules are',
        JSON.stringify([await handle.restartPending(), await handle.statusOf('a')]) ===
            '[[{"id":"a","why":"updated"}],{"running":true,"failure":null}]',
        ''
    );
    let changes = 0;
    const scope = makeScope();
    layer.frameworks.mainProcess(scope).onChange(() => changes++);
    await tick();
    changed();
    await tick();
    scope.cut();
    changed();
    await tick();
    check(
        'onChange hears what the loader tells, through deliver, until its scope is cut',
        changes === 1 && delivered.includes('mainProcess.onChange listener'),
        [changes, delivered]
    );

    // Refusals: on the page for the mod's own permissions and arguments, in main for a page's.
    const asked = loaded.length;
    const plain = layerOf([]).frameworks.mainProcess(makeScope());
    check(
        'start, restartPending and statusOf refuse a mod granted nothing at call with NOT_PERMITTED',
        (
            await Promise.all(
                [plain.start('main-process/a.js'), plain.restartPending(), plain.statusOf('a')].map(refusalOf)
            )
        ).join() === 'call NOT_PERMITTED,call NOT_PERMITTED,call NOT_PERMITTED',
        ''
    );
    check(
        'onChange throws NOT_PERMITTED for a mod without deckit.mods',
        thrownOf(() => plain.onChange(() => {})) === 'call NOT_PERMITTED',
        ''
    );
    check(
        'an argument of another type is refused at call with INVALID_ARGUMENT',
        (await Promise.all([handle.start(5), handle.statusOf(5)].map(refusalOf))).join() ===
            'call INVALID_ARGUMENT,call INVALID_ARGUMENT' &&
            thrownOf(() => handle.onChange('a')) === 'call INVALID_ARGUMENT',
        ''
    );
    check('a request refused on the page starts nothing', loaded.length === asked, loaded);
    check(
        "main refuses a page whose mod does not have the permission a channel's request needs",
        (
            await Promise.all([
                askAsPlain('deckit-electron:main-process-start', { path: 'main-process/a.js' }),
                askAsPlain('deckit-electron:main-process-call', {
                    path: 'main-process/a.js',
                    method: ['add'],
                    args: [],
                }),
                askAsPlain('deckit-electron:main-process-restart-pending', {}),
                askAsPlain('deckit-electron:main-process-status-of', { id: 'a' }),
            ])
        ).join() === 'call NOT_PERMITTED,call NOT_PERMITTED,call NOT_PERMITTED,call NOT_PERMITTED',
        ''
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} main process checks`);
}

// A question left unanswered keeps nothing running, so the checks would end without a word.
let finished = false;
process.on('exit', (code) => {
    if (finished || code) return;
    console.error('FAIL the main process checks did not finish: something asked was never answered');
    process.exitCode = 1;
});

main().then(
    () => (finished = true),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
