// Deck's runner (deckit-shell/deck/runner) over a stand-in for the environment's pages, messages and app: a run's page
// made, known as the mod's and set up before it loads, what the core is told as the page fails, crashes or is
// replaced, a run's stop() asked of its page, what it waits for kept, the page closed, and the quit held while a run
// has not ended. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as
// such.
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
    const CATALOG = { onChange: () => {} };
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
    const found = { id: 'a', manifest: { id: 'a', name: 'A' } };
    const told = (notification, state) => ({
        effect: 'tell',
        mod: 'a',
        run: 1,
        notification,
        state,
        relaunches: false,
    });
    answers.set('runner/reconcile', [
        [{ effect: 'open', found }, told('willLaunch', 'launching'), { effect: 'load', mod: 'a' }],
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
    const stopping = () => answers.get('runner/relaunch').push([{ effect: 'stop', mod: 'a', run: 1 }]);
    answers.set('runner/relaunch', []);
    stopping();
    RUNNER.relaunch('a').catch(() => {});
    await tick();
    const question = tells.at(-1)?.[1];
    check('stop() is asked of the run page', question?.channel === 'deckit-shell:mod-stop', question);
    check('the core is not told before the page answers', methods('runner/stopped').length === 0, asked);
    heard.told(page, { channel: question.channel, id: question.id, value: null });
    await tick();
    await tick();
    check('the core is told once the page answered', methods('runner/stopped').length === 1, asked);
    stopping();
    RUNNER.relaunch('a').catch(() => {});
    await later(2100);
    check('the core is told once stop() ran out of time', methods('runner/stopped').length === 2, asked);
    gone = true;
    stopping();
    RUNNER.relaunch('a').catch(() => {});
    await tick();
    await tick();
    check('the core is told at once when the page is gone', methods('runner/stopped').length === 3, asked);
    gone = false;

    // What a mod waits for is kept as the core told it, with its sandbox.
    answers.set('runner/crash', [
        [{ effect: 'waitsForChanged', mod: 'a', requirements: ['b'] }],
        [{ effect: 'close', mod: 'a', reason: 'removed' }],
    ]);
    watching.get(page).gone('killed');
    await tick();
    check('what a mod waits for is kept as told', RUNNER.waitsForOf('a').join() === 'b', RUNNER.waitsForOf('a'));
    watching.get(page).gone('killed');
    await tick();
    check(
        'a closed sandbox closes its page',
        done.some(([what]) => what === 'close'),
        done
    );
    check('a closed sandbox is no run', RUNNER.runs().length === 0, RUNNER.runs());

    // A sandbox opened while what its mod requires is down: no run, no page loaded, what it waits for told.
    answers.set('runner/relaunch', [
        [
            { effect: 'open', found },
            { effect: 'waitsForChanged', mod: 'a', requirements: ['b'] },
        ],
        [{ effect: 'close', mod: 'a', reason: 'removed' }],
    ]);
    const waitsHeard = [];
    const offWaits = RUNNER.onWaitsForChange((modId) => waitsHeard.push(modId));
    const loads = done.filter(([what]) => what === 'load').length;
    const settled = await Promise.race([RUNNER.relaunch('a').then(() => true), later(50).then(() => false)]);
    check('a relaunch that launched nothing settles', settled, null);
    check('a sandbox with no run is in no runs', RUNNER.runs().length === 0, RUNNER.runs());
    check('a sandbox with no run is not running', RUNNER.stateOf('a') === 'notRunning', RUNNER.stateOf('a'));
    check('its page is not loaded', done.filter(([what]) => what === 'load').length === loads, done);
    check('what it waits for is heard', waitsHeard.join() === 'a' && RUNNER.waitsForOf('a').join() === 'b', waitsHeard);
    const crashesBefore = methods('runner/crash').length;
    [...watching.values()].at(-1).gone('killed');
    await tick();
    check('its page gone tells the core nothing', methods('runner/crash').length === crashesBefore, asked);
    offWaits();
    await RUNNER.relaunch('a').catch(() => {});
    check('a mod with no sandbox has no state', RUNNER.stateOf('a') === null, RUNNER.stateOf('a'));

    // The quit, held while a run has not ended: a page opened again, then a core that ended frees it.
    answers.set('runner/relaunch', [
        [{ effect: 'open', found }, told('willLaunch', 'launching'), { effect: 'load', mod: 'a' }],
    ]);
    RUNNER.relaunch('a').catch(() => {});
    await tick();
    check(
        'a sandbox opened anew waits for nothing until told',
        RUNNER.waitsForOf('a').length === 0,
        RUNNER.waitsForOf('a')
    );
    let end = null;
    answers.set('runner/quit', [
        () =>
            new Promise(
                (_resolve, reject) => (end = () => reject(Object.assign(new Error('ended'), { kind: 'ENDED' })))
            ),
    ]);
    check('the quit is held while a run has not ended', hold() === true, RUNNER.runs());
    check('the core is asked to stop the runs as the app quits', methods('runner/quit').length === 1, asked);
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
