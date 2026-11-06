// The runner (deckit-shell/deckit/runner) over a stand-in for the environment's pages, messages and app: the core asked
// to start, a run's page made, known as the mod's and set up before it loads, what the core is told as the page fails,
// crashes or is replaced, a run's end asked of its page, what the page reports kept on its run while the core is told
// `exportedIn` and `awaits` alone, a launch asked of the core with the mod that asks or none, once a run that
// terminates has ended, a mod relaunched as it ends and launches again, the core asked first what the owners come to as
// the catalog changes, with no new mod loaded for it and the owner change it delivers reaching the page that listens, a
// changed mod that ran loaded again, a launch the core answers for a failed run done as told, a mod that quits its run,
// the page closed, and the quit held while a run has not ended. Exits 1 with a line for each check that failed. The
// packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const { createRunner } = await import(url('deckit-shell', 'deckit', 'runner', 'main.js'));
    const { createEvent } = await import(url('deckit-shell', 'deckit', 'event', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
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
    let catalog = [{ id: 'a', revision: '1' }];
    let changed = null;
    const CATALOG = { onChange: (listener) => (changed = listener), mods: () => catalog };
    const LOG = { warn: () => {}, error: () => {} };
    // The core answers each request with what the test queued for its method, a list of effects or a function that
    // answers, and otherwise as the core does when nothing changes: no effects.
    const asked = [];
    const answers = new Map();
    const CORE = {
        request: (method, params) => {
            asked.push({ method, params });
            const queued = answers.get(method)?.shift();
            if (typeof queued === 'function') return queued();
            return Promise.resolve(queued || []);
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
        failed: false,
        relaunchLimited: false,
        ...facts,
    });
    answers.set('runner/start', [
        [{ effect: 'open', found: found('a') }, told('willLaunch', 'launching', 'a'), { effect: 'loadPage', mod: 'a' }],
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
        'the core is asked to start as the runner starts, and the runner loads nothing itself',
        asked.map(({ method }) => method).join() === 'runner/start',
        asked
    );

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
    check(
        'a crash tells the core the mod, the run and why, and nothing more',
        JSON.stringify(Object.keys(methods('runner/crash')[0].params).sort()) === '["mod","problem","run"]',
        methods('runner/crash')[0]
    );

    // stop(): asked of the page, and the core told it stopped once the page answers, its time runs out, or at once
    // when the page is gone.
    const stopping = () => answers.get('runner/unload').push([{ effect: 'stop', mod: 'a', run: 1 }]);
    answers.set('runner/unload', []);
    stopping();
    RUNNER.unload(['a']).catch(() => {});
    await tick();
    const question = tells.at(-1)?.[1];
    check('stop() is asked of the run page', question?.channel === 'deckit-shell:mod-stop', question);
    check('the core is not told before the page answers', methods('runner/stopped').length === 0, asked);
    heard.told(page, { channel: question.channel, id: question.id, value: null });
    await tick();
    await tick();
    check('the core is told once the page answered', methods('runner/stopped').length === 1, asked);
    stopping();
    RUNNER.unload(['a']).catch(() => {});
    await later(2100);
    check('the core is told once stop() ran out of time', methods('runner/stopped').length === 2, asked);
    gone = true;
    stopping();
    RUNNER.unload(['a']).catch(() => {});
    await tick();
    await tick();
    check('the core is told at once when the page is gone', methods('runner/stopped').length === 3, asked);
    gone = false;

    // What the page read of the mod's class, and how many lifecycles its run stacks: each has its own time to end. The
    // run keeps what the page reports, and the core is told `exportedIn` and `awaits` alone.
    const fromPage = (channel, payload) => heard.told(page, { channel: `deckit-shell:${channel}`, payload });
    const describedFrom = asked.length;
    fromPage('mod-described', { run: 1, summary: { icon: 'i' }, lifecycles: 2 });
    await tick();
    check(
        'what the page read of the class is kept on the run, and not told the core',
        RUNNER.runOf('a').summary?.icon === 'i' && asked.length === describedFrom,
        { summary: RUNNER.runOf('a').summary, asked: asked.slice(describedFrom) }
    );
    stopping();
    RUNNER.unload(['a']).catch(() => {});
    await later(2100);
    check('a run of two lifecycles is not ended by one limit', methods('runner/stopped').length === 3, asked);
    await later(2000);
    check('a run of two lifecycles ends within two limits', methods('runner/stopped').length === 4, asked);
    const contributions = { exportedIn: { 'p/x': 0 }, awaits: { q: 1 }, commands: [{ name: 'go' }] };
    answers.set('runner/started', [[told('didLaunch', 'running', 'a', { contributions: { exportedIn: {} } })]]);
    let summaryAtLaunch = null;
    const offLaunch = RUNNER.observe('didLaunch', (run) => (summaryAtLaunch = run.summary));
    fromPage('mod-started', { run: 1, summary: { view: true }, contributions });
    await tick();
    offLaunch();
    const started = methods('runner/started').at(-1)?.params;
    check(
        'a run started tells the core exportedIn and awaits alone',
        JSON.stringify(started) ===
            JSON.stringify({ mod: 'a', run: 1, contributions: { exportedIn: { 'p/x': 0 }, awaits: { q: 1 } } }),
        started
    );
    check(
        'a run keeps what its page reported as it started, not what the core answers',
        RUNNER.runOf('a').summary?.view === true &&
            RUNNER.runOf('a').contributions?.commands?.[0]?.name === 'go' &&
            summaryAtLaunch?.view === true,
        { run: RUNNER.runOf('a'), summaryAtLaunch }
    );
    fromPage('mod-joined', { run: 1, summary: { view: false }, contributions: { ...contributions, awaits: {} } });
    await tick();
    const joined = methods('runner/joined').at(-1)?.params;
    check(
        'a lifecycle joined tells the core exportedIn and awaits alone, and the run keeps what the page reported',
        JSON.stringify(joined?.contributions) === '{"exportedIn":{"p/x":0},"awaits":{}}' &&
            !('summary' in joined) &&
            RUNNER.runOf('a').summary?.view === false,
        joined
    );
    fromPage('mod-joined', { run: 9, summary: { view: true }, contributions });
    await tick();
    check('what an older run reports is not kept on the latest', RUNNER.runOf('a').summary?.view === false, null);

    // A launch: asked of the core with the mod that asks, or none for the shell, once a run that terminates has ended;
    // resolved once it has launched, or failed to. One the core refuses rejects.
    catalog = [...catalog, { id: 'b', revision: '1' }];
    answers.set('runner/launch', [
        [{ effect: 'open', found: found('b') }, told('willLaunch', 'launching', 'b'), { effect: 'loadPage', mod: 'b' }],
    ]);
    let launched = false;
    const launching = RUNNER.launch('b').then(() => (launched = true));
    await tick();
    check(
        'a launch the shell asks names no mod that asks',
        JSON.stringify(methods('runner/launch').at(-1)?.params) === '{"mod":"b"}',
        methods('runner/launch')
    );
    check('a launch resolves once the mod has launched, not before', launched === false, null);
    answers.set('runner/started', [[told('didLaunch', 'running', 'b')]]);
    await RUNNER.ask('runner/started', { mod: 'b', run: 1 });
    await launching;
    check('a launch resolves once the mod has launched', launched === true, null);
    await RUNNER.launch('b', 'a');
    check(
        'a launch a mod asks names it',
        JSON.stringify(methods('runner/launch').at(-1)?.params) === '{"mod":"b","by":"a"}',
        methods('runner/launch')
    );
    answers.set('runner/launch', [() => Promise.reject(Object.assign(new Error('refused'), { kind: 'REFUSED' }))]);
    const refusal = await RUNNER.launch('b', 'c').catch((error) => error);
    check('a launch the core refuses rejects with why', refusal?.kind === 'REFUSED', refusal);
    answers.set('runner/unload', [[told('willTerminate', 'terminating', 'b')]]);
    await RUNNER.ask('runner/unload', { mods: ['b'] });
    const launchesBefore = methods('runner/launch').length;
    answers.set('runner/launch', [
        [told('willLaunch', 'launching', 'b', { run: 2 }), told('didLaunch', 'running', 'b', { run: 2 })],
    ]);
    const afterEnd = RUNNER.launch('b');
    await tick();
    check(
        'a launch waits for the run that terminates to end',
        methods('runner/launch').length === launchesBefore,
        methods('runner/launch')
    );
    answers.set('runner/stopped', [[told('didTerminate', 'notRunning', 'b')]]);
    await RUNNER.ask('runner/stopped', { mod: 'b', run: 1 });
    await afterEnd;
    check(
        'a launch is asked once the run that terminated has ended',
        methods('runner/launch').length === launchesBefore + 1 && RUNNER.runOf('b')?.number === 2,
        methods('runner/launch')
    );

    // A mod relaunched: it ends, then launches as asked, its run saying meanwhile that it loads again.
    let marked = null;
    answers.set('runner/unload', [
        () => {
            marked = RUNNER.runOf('b').relaunches;
            return Promise.resolve([told('didTerminate', 'notRunning', 'b', { run: 2 })]);
        },
    ]);
    let markedAgain = null;
    answers.set('runner/launch', [
        () => {
            markedAgain = RUNNER.runOf('b').relaunches;
            return Promise.resolve([
                told('willLaunch', 'launching', 'b', { run: 3 }),
                told('didLaunch', 'running', 'b', { run: 3 }),
            ]);
        },
    ]);
    const relaunchFrom = asked.length;
    await RUNNER.relaunch(['b'], 'a');
    const relaunched = asked.slice(relaunchFrom).map(({ method, params }) => `${method} ${JSON.stringify(params)}`);
    check(
        'a mod relaunched ends, then launches as the mod that asks asked',
        relaunched.join(' | ') === 'runner/unload {"mods":["b"]} | runner/launch {"mod":"b","by":"a"}',
        relaunched
    );
    check('a mod relaunched says meanwhile that it loads again', marked === true && markedAgain === true, {
        marked,
        markedAgain,
    });
    check('a relaunch ended says so no more', RUNNER.runOf('b').relaunches === false, RUNNER.runOf('b').relaunches);
    check(
        'nothing asks the core for a limit reset or tells it what a page described',
        !methods('runner/reset-limit').length && !methods('runner/described').length,
        asked.map(({ method }) => method)
    );

    // A mod found anew, which may own an interface now: the core says first what the owners come to, delivering the
    // owner change to the mods that listen, and it does not load, while what runs runs on.
    catalog = [...catalog, { id: 'c', revision: '1' }];
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

    // A changed mod that ran goes and loads again.
    catalog = catalog.map((mod) => (mod.id === 'b' ? { ...mod, revision: '2' } : mod));
    const beforeChange = asked.length;
    answers.set('runner/unload', [[told('didTerminate', 'notRunning', 'b', { run: 3 })]]);
    answers.set('runner/load', [
        [told('willLaunch', 'launching', 'b', { run: 4 }), told('didLaunch', 'running', 'b', { run: 4 })],
    ]);
    changed();
    await RUNNER.whenReconciled();
    const changing = asked.slice(beforeChange).map(({ method, params }) => `${method} ${JSON.stringify(params)}`);
    check(
        'a changed mod that ran goes and loads again',
        changing.join(' | ') === 'runner/reconnect {} | runner/unload {"mods":["b"]} | runner/load {"mods":["b"]}',
        changing
    );

    // A failed run the core launches again comes in what it answers, and the runner asks for no load of its own.
    const loadsNow = () => methods('runner/load').length + methods('runner/launch').length;
    const loadsBefore = loadsNow();
    answers.set('runner/crash', [
        [
            told('didTerminate', 'notRunning', 'b', { run: 4, failed: true }),
            told('willLaunch', 'launching', 'b', { run: 5 }),
            { effect: 'loadPage', mod: 'b' },
        ],
    ]);
    await RUNNER.ask('runner/crash', { mod: 'b', run: 4, problem: 'x' });
    await tick();
    check(
        'a run the core launches again as a run failed launches as told, and nothing more is asked',
        RUNNER.runOf('b').number === 5 && RUNNER.runOf('b').state === 'launching' && loadsNow() === loadsBefore,
        asked.slice(-2)
    );
    answers.set('runner/crash', [
        [told('didTerminate', 'notRunning', 'b', { run: 5, failed: true, relaunchLimited: true })],
    ]);
    await RUNNER.ask('runner/crash', { mod: 'b', run: 5, problem: 'x' });
    check('a run says it failed as the core told', RUNNER.runOf('b').failed === true, RUNNER.runOf('b'));
    check('a run says its mod reached the relaunch limit', RUNNER.runOf('b').relaunchLimited === true, null);

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
    answers.set('runner/launch', [[told('willLaunch', 'launching'), told('didLaunch', 'running')]]);
    await RUNNER.launch('a');

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
    answers.set('runner/launch', [
        [told('willLaunch', 'launching', 'b', { run: 6 }), told('didLaunch', 'running', 'b', { run: 6 })],
    ]);
    await RUNNER.launch('b');
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
