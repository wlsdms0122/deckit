// Deck's runner (deckit-shell/deck/runner) over a stand-in for the environment's pages, messages and app: the startup
// mods loaded as it starts, a run's page made, known as the mod's and set up before it loads, what the core is told as
// the page fails, crashes or is replaced, a run's end asked of its page, a mod loaded with what it requires, once that
// has launched, one restarted with the mods that require it, each for its origin, the core asked first what the owners
// come to as the catalog changes, with no new mod loaded for it and the owner change it delivers reaching the page that
// listens, a changed mod that ran loaded again, a startup mod that failed loaded again unless it reached the relaunch
// limit, a mod that quits its run, the page closed, and the quit held while a run has not ended. Exits 1 with a line
// for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const { createRunner } = await import(url('deckit-shell', 'deck', 'runner', 'main.js'));
    const { createEvent } = await import(url('deckit-shell', 'deck', 'event', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The environment's pages, messages and app: what is done to a page is kept, and the test tells what happens to
    // it and answers for it.
    const done = [];
    const watching = new Map(); // page -> what the runner watches it with
    const tells = []; // [page, message] main told a page
    let gone = false;
    let heard = null;
    let hold = null;
    const pages = {
        make: ({ modId }) => {
            const page = { modId };
            done.push(['make', modId]);
            return page;
        },
        load: (page) => done.push(['load', page.modId]),
        close: (page) => done.push(['close', page.modId]),
        isGone: () => gone,
        watch: (page, watchers) => {
            if (!watching.has(page)) done.push(['watch', page.modId]);
            if (watchers.failed) watching.set(page, watchers);
        },
    };
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    IPC.carry({ messages, pages }, { report: () => {} });
    const app = { onQuit: (given) => (hold = given), quit: () => done.push(['quit']) };
    const IDENTITY = {
        add: (page) => done.push(['add', page.modId]),
        modFrom: () => ({ id: 'a' }),
        pageOf: (id) => RUNNER.runs().find(({ run }) => run.mod.id === id)?.page ?? null,
    };
    let catalog = [{ id: 'a', relations: [], revision: '1', dependents: [], startupApproved: true }];
    let changed = null;
    const CATALOG = { onChange: (listener) => (changed = listener), mods: () => catalog };
    const LOG = { warn: () => {}, error: () => {} };
    // The core answers each request with what the test queued for its method, a list of effects or a function that
    // answers, and nothing otherwise.
    const asked = [];
    const answers = new Map();
    const CORE = {
        request: (method, params) => {
            asked.push({ method, params });
            const queued = answers.get(method)?.shift();
            return typeof queued === 'function' ? queued() : Promise.resolve(queued || []);
        },
    };
    const methods = (method) => asked.filter((request) => request.method === method);
    const found = (id) => ({ id, revision: '1', manifest: { id, name: id.toUpperCase() } });
    const told = (notification, state, mod = 'a', facts = {}) => ({
        effect: 'tell',
        mod,
        run: 1,
        notification,
        state,
        origin: { kind: 'person' },
        failed: false,
        relaunchLimited: false,
        ...facts,
    });
    const requests = (request) => JSON.stringify(request?.params.requests);
    const startup = { origin: { kind: 'startup' } };
    answers.set('runner/load', [
        [
            { effect: 'open', found: found('a') },
            told('willLaunch', 'launching', 'a', startup),
            { effect: 'loadPage', mod: 'a' },
        ],
    ]);

    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, CORE, pages, app });
    createEvent({ CORE, LOG, IDENTITY, RUNNER }).start();
    RUNNER.start({ preparePage: (page) => done.push(['prepare', page.modId]) });
    await tick();
    const order = done.map(([what]) => what).join(' ');
    check(
        'a run page is made, watched, known and set up before it loads',
        order === 'make watch add prepare load',
        done
    );
    check('a run is kept with its page', RUNNER.runs()[0]?.page?.modId === 'a', RUNNER.runs());
    check(
        'each startup mod is loaded as the runner starts, for the startup list',
        requests(methods('runner/load')[0]) === '[{"mod":"a","origin":{"kind":"startup"}}]',
        asked
    );
    check('a run keeps the origin the core told', RUNNER.runOf('a')?.origin.kind === 'startup', RUNNER.runOf('a'));

    const page = RUNNER.runs()[0].page;
    const crashes = () => methods('runner/crash').map(({ params }) => params.problem);
    watching.get(page).failed('ERR_NAME_NOT_RESOLVED');
    check(
        'a page that did not load crashes its run',
        crashes()[0] === 'its page did not load (ERR_NAME_NOT_RESOLVED)',
        crashes()
    );
    watching.get(page).gone('oom');
    check('a page whose process ended crashes its run, saying why', crashes()[1] === 'its page ended (oom)', crashes());
    check('a page whose document was replaced is told by what it set up, not here', !watching.get(page).ended, null);

    // stop(): asked of the page, and the core told it stopped once the page answers, its time runs out, or at once
    // when the page is gone.
    const stopping = () => answers.get('runner/unload').push([{ effect: 'stop', mod: 'a', run: 1 }]);
    answers.set('runner/unload', []);
    stopping();
    RUNNER.relaunch(['a']).catch(() => {});
    await tick();
    const question = tells.at(-1)?.[1];
    check('stop() is asked of the run page', question?.channel === 'deckit-shell:mod-stop', question);
    check('the core is not told before the page answers', methods('runner/stopped').length === 0, asked);
    heard.told(page, { channel: question.channel, id: question.id, value: null });
    await tick();
    await tick();
    check('the core is told once the page answered', methods('runner/stopped').length === 1, asked);
    stopping();
    RUNNER.relaunch(['a']).catch(() => {});
    await later(2100);
    check('the core is told once stop() ran out of time', methods('runner/stopped').length === 2, asked);
    gone = true;
    stopping();
    RUNNER.relaunch(['a']).catch(() => {});
    await tick();
    await tick();
    check('the core is told at once when the page is gone', methods('runner/stopped').length === 3, asked);
    gone = false;

    // What the page read of the mod's class, and how many lifecycles its run stacks: each has its own time to end.
    const fromPage = (channel, payload) => heard.told(page, { channel: `deckit-shell:${channel}`, payload });
    fromPage('mod-described', { run: 1, summary: { icon: 'i' }, lifecycles: 2 });
    await tick();
    check(
        'what the page read of the class is told the core',
        methods('runner/described')[0]?.params.summary.icon === 'i',
        asked
    );
    stopping();
    RUNNER.relaunch(['a']).catch(() => {});
    await later(2100);
    check('a run of two lifecycles is not ended by one limit', methods('runner/stopped').length === 3, asked);
    await later(2000);
    check('a run of two lifecycles ends within two limits', methods('runner/stopped').length === 4, asked);
    fromPage('mod-joined', { run: 1, summary: { view: true }, contributions: {} });
    await tick();
    check('a lifecycle joined is told the core', methods('runner/joined')[0]?.params.summary.view === true, asked);

    // A mod loads once what it requires has launched.
    catalog = [
        ...catalog,
        {
            id: 'b',
            relations: [{ id: 'a', optional: false, version: '1.0.0', name: 'a' }],
            revision: '1',
            dependents: [],
        },
    ];
    answers.set('runner/load', [
        [],
        [{ effect: 'open', found: found('b') }, told('willLaunch', 'launching', 'b'), { effect: 'loadPage', mod: 'b' }],
    ]);
    const loading = RUNNER.load(['b'], { kind: 'person' });
    await tick();
    check(
        'a mod loaded first asks for what it requires, for being required by it',
        requests(methods('runner/load').at(-1)) === '[{"mod":"a","origin":{"kind":"required","by":"b"}}]',
        asked
    );
    check('a mod is not loaded while what it requires launches', methods('runner/load').length === 2, asked);
    answers.set('runner/started', [[told('didLaunch', 'running')]]);
    await RUNNER.ask('runner/started', { mod: 'a', run: 1 });
    await tick();
    check(
        'a mod is loaded once what it requires has launched, for its own origin',
        requests(methods('runner/load')[2]) === '[{"mod":"b","origin":{"kind":"person"}}]' &&
            done.at(-1)?.join() === 'load,b',
        asked
    );
    answers.set('runner/started', [[told('didLaunch', 'running', 'b', startup)]]);
    await RUNNER.ask('runner/started', { mod: 'b', run: 1 });
    await loading;

    // A mod restarted brings back the mods that require it, their runs saying meanwhile that they load again.
    catalog = catalog.map((mod) => (mod.id === 'a' ? { ...mod, dependents: ['b'] } : mod));
    let marked = null;
    answers.set('runner/unload', [
        () => {
            marked = RUNNER.runOf('b').relaunches;
            return Promise.resolve([told('didTerminate', 'notRunning', 'b'), told('didTerminate', 'notRunning')]);
        },
    ]);
    let markedAgain = null;
    answers.set('runner/load', [
        [told('willLaunch', 'launching'), told('didLaunch', 'running')],
        () => {
            markedAgain = RUNNER.runOf('a').relaunches;
            return Promise.resolve([told('didLaunch', 'running', 'b')]);
        },
    ]);
    await RUNNER.relaunch(['a']);
    const loads = methods('runner/load')
        .slice(-2)
        .map(({ params }) => params.requests.map(({ mod, origin }) => `${mod}:${origin.kind}`).join());
    check(
        'a mod restarted loads as the person opens it, and the mods that require it again after it, as they launched',
        loads.join(' ') === 'a:person b:startup',
        loads
    );
    check('the mods that require a mod restarted say meanwhile that they load again', marked === true, marked);
    check('a run that launches while a reload is bringing its mod back says so too', markedAgain === true, markedAgain);
    check('a reload ended says so no more', RUNNER.runOf('a').relaunches === false, RUNNER.runOf('a').relaunches);

    // A mod found anew, which may own an interface now: the core says first what the owners come to, delivering the
    // owner change to the mods that listen, and it does not load, while what runs runs on.
    catalog = [...catalog, { id: 'c', relations: [], revision: '1', dependents: [] }];
    const before = asked.length;
    const toldBefore = tells.length;
    answers.set('runner/reconnect', [[{ effect: 'deliver', name: 'x/api:owner-changed', listeners: ['b'] }]]);
    changed();
    await RUNNER.whenReconciled();
    const reconnecting = asked.slice(before).map(({ method }) => method);
    check(
        'a catalog change asks the core first what the owners come to, and loads no mod new to it',
        reconnecting.join(' | ') === 'runner/reconnect',
        reconnecting
    );
    check('a mod that runs runs on as the owners change', RUNNER.runOf('b')?.state === 'running', null);
    const delivered = tells
        .slice(toldBefore)
        .filter(([, message]) => message.channel === 'deckit-shell:event')
        .map(([page, message]) => [page.modId, message.payload]);
    check(
        'an owner change the core delivers reaches the page of the mod that listens, carrying nothing',
        JSON.stringify(delivered) === '[["b",{"name":"x/api:owner-changed","args":[]}]]',
        delivered
    );

    // A changed mod that ran goes and loads again, as it launched, with what it requires.
    catalog = catalog.map((mod) => (mod.id === 'b' ? { ...mod, revision: '2' } : mod));
    const beforeChange = asked.length;
    answers.set('runner/unload', [[told('didTerminate', 'notRunning', 'b')]]);
    answers.set('runner/load', [[told('willLaunch', 'launching', 'b', startup), told('didLaunch', 'running', 'b')]]);
    changed();
    await RUNNER.whenReconciled();
    const changing = asked
        .slice(beforeChange)
        .map(({ method, params }) => `${method}${params.mods ? ' ' + params.mods : ''}${requests({ params }) ?? ''}`);
    check(
        'a changed mod that ran goes and loads again, as it launched, with what it requires',
        changing.join(' | ') ===
            'runner/reconnect | runner/unload b | runner/load[{"mod":"a","origin":{"kind":"required","by":"b"}}] | ' +
                'runner/load[{"mod":"b","origin":{"kind":"person"}}]',
        changing
    );

    // A startup mod whose run failed loads again for the startup list, unless it reached the relaunch limit; one
    // that ended as asked does not.
    const loadsNow = () => methods('runner/load').length;
    let loadsBefore = loadsNow();
    answers.set('runner/unload', [[told('didTerminate', 'notRunning')]]);
    answers.set('runner/load', [[]]);
    await RUNNER.ask('runner/unload', { mods: ['a'] });
    await tick();
    check('a startup mod that ended as asked does not load again', loadsNow() === loadsBefore, asked.slice(-2));
    answers.set('runner/crash', [[told('didTerminate', 'notRunning', 'a', { failed: true })]]);
    answers.set('runner/load', [[told('willLaunch', 'launching', 'a', startup), told('didLaunch', 'running')]]);
    await RUNNER.ask('runner/crash', { mod: 'a', run: 1, problem: 'x' });
    await tick();
    check(
        'a startup mod whose run failed loads again for the startup list',
        loadsNow() === loadsBefore + 1 &&
            requests(methods('runner/load').at(-1)) === '[{"mod":"a","origin":{"kind":"startup"}}]',
        asked.slice(-2)
    );
    check('a run says it failed as the core told', RUNNER.runOf('a').failed === false, RUNNER.runOf('a'));
    loadsBefore = loadsNow();
    const limited = { failed: true, relaunchLimited: true };
    answers.set('runner/crash', [[told('didTerminate', 'notRunning', 'a', limited)]]);
    await RUNNER.ask('runner/crash', { mod: 'a', run: 1, problem: 'x' });
    await tick();
    check('a startup mod at the relaunch limit does not load again', loadsNow() === loadsBefore, asked.slice(-2));
    check('a run says its mod reached the relaunch limit', RUNNER.runOf('a').relaunchLimited === true, null);
    answers.set('runner/started', [[told('didLaunch', 'running')]]);
    await RUNNER.ask('runner/started', { mod: 'a', run: 1 });

    // A mod quits its own run; what an older run asks is not the latest's.
    const unloads = () => methods('runner/unload').length;
    const unloadsBefore = unloads();
    fromPage('mod-quit', { run: 9 });
    await tick();
    check("an older run's quit ends nothing", unloads() === unloadsBefore, asked.slice(-1));
    answers.set('runner/unload', [[told('didTerminate', 'notRunning')]]);
    fromPage('mod-quit', { run: 1 });
    await tick();
    check(
        'a mod that quits ends its run',
        unloads() === unloadsBefore + 1 && RUNNER.runOf('a').state === 'notRunning',
        asked.slice(-1)
    );
    answers.set('runner/started', [[told('didLaunch', 'running')]]);
    await RUNNER.ask('runner/started', { mod: 'a', run: 1 });

    answers.set('runner/crash', [[{ effect: 'close', mod: 'a' }]]);
    watching.get(page).gone('killed');
    await tick();
    check(
        'a closed sandbox closes its page',
        done.some(([what]) => what === 'close'),
        done
    );
    check('a closed sandbox is no run', !RUNNER.runOf('a'), RUNNER.runs());

    // The quit, held while a run has not ended, and a core that ended frees it.
    let end = null;
    answers.set('runner/unload', [
        () =>
            new Promise(
                (_resolve, reject) => (end = () => reject(Object.assign(new Error('ended'), { kind: 'ENDED' })))
            ),
    ]);
    check('the quit is held while a run has not ended', hold() === true, RUNNER.runs());
    const quit = methods('runner/unload').at(-1)?.params;
    check('the core is asked to stop the runs as the app quits', quit?.mods.join() === 'b', quit);
    check('a quit asked again meanwhile waits too', hold() === true, null);
    end();
    await tick();
    check('a core that ended frees the quit, and the quit is asked again', done.at(-1)?.[0] === 'quit', done.at(-1));
    check('a freed quit is held no more', hold() === false, null);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} runner checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
