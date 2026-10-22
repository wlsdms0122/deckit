// Deck's runner (deckit-shell/deck/runner) over a stand-in for the environment's pages, messages and app: a run's page
// made, known as the mod's and set up before it loads, what the core is told as the page fails, crashes or is
// replaced, a run's stop() asked of its page, a mod loaded once what it requires has launched, one restarted with the
// mods that require it, the page closed, and the quit held while a run has not ended. Exits 1 with a line for each
// check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const later = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
    const { createRunner } = await import(url('deckit-shell', 'deck', 'runner', 'main.js'));
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
    const IDENTITY = { add: (page) => done.push(['add', page.modId]), modFrom: () => ({ id: 'a' }) };
    let catalog = [{ id: 'a', requires: {}, revision: '1', dependents: [] }];
    const CATALOG = { onChange: () => {}, mods: () => catalog };
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
    const found = (id) => ({ id, manifest: { id, name: id.toUpperCase() } });
    const told = (notification, state, mod = 'a') => ({ effect: 'tell', mod, run: 1, notification, state });
    answers.set('runner/load', [
        [{ effect: 'open', found: found('a') }, told('willLaunch', 'launching'), { effect: 'loadPage', mod: 'a' }],
    ]);

    const RUNNER = createRunner({ LOG, IDENTITY, CATALOG, CORE, pages, app });
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
        'each mod that loads is loaded as the runner starts',
        methods('runner/load')[0]?.params.mods[0] === 'a',
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

    // A mod loads once what it requires has launched.
    catalog = [...catalog, { id: 'b', requires: { a: '1.0.0' }, revision: '1', dependents: [] }];
    answers.set('runner/load', [
        [{ effect: 'open', found: found('b') }, told('willLaunch', 'launching', 'b'), { effect: 'loadPage', mod: 'b' }],
    ]);
    const loading = RUNNER.load(['b']);
    await tick();
    check('a mod is not loaded while what it requires launches', methods('runner/load').length === 1, asked);
    answers.set('runner/started', [[told('didLaunch', 'running')]]);
    await RUNNER.ask('runner/started', { mod: 'a', run: 1 });
    await tick();
    check(
        'a mod is loaded once what it requires has launched',
        methods('runner/load')[1]?.params.mods.join() === 'b' && done.at(-1)?.join() === 'load,b',
        asked
    );
    answers.set('runner/started', [[told('didLaunch', 'running', 'b')]]);
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
    answers.set('runner/load', [[told('didLaunch', 'running')], [told('didLaunch', 'running', 'b')]]);
    await RUNNER.relaunch(['a']);
    const loads = methods('runner/load')
        .slice(-2)
        .map(({ params }) => params.mods.join());
    check('a mod restarted loads the mods that require it again, after it', loads.join(' ') === 'a b', loads);
    check('the mods that require a mod restarted say meanwhile that they load again', marked === true, marked);

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
