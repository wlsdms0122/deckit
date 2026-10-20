// Deck's runner (deckit-shell/deck/runner) over a stand-in for the environment's pages and app: a run's page made,
// known as the mod's and set up before it loads, what the core is told as the page fails, crashes or is replaced, and
// the quit held while a run has not ended. Exits 1 with a line for each check that failed. The packages are ES modules,
// so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createRunner } = await import(url('deckit-shell', 'deck', 'runner', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The environment's pages and app: what is done to a page is kept, and the test tells what happens to it.
    const done = [];
    const watching = new Map(); // page -> what watches it
    let hold = null;
    const pages = {
        make: ({ mod }) => {
            const page = { mod };
            done.push(['make', mod]);
            return page;
        },
        load: (page) => done.push(['load', page.mod]),
        close: (page) => done.push(['close', page.mod]),
        isGone: () => false,
        watch: (page, watchers) => {
            done.push(['watch', page.mod]);
            watching.set(page, watchers);
        },
    };
    const app = { onQuit: (given) => (hold = given), quit: () => done.push(['quit']) };
    const IDENTITY = { add: (page) => done.push(['add', page.mod]), modFrom: () => ({ id: 'a' }) };
    const CATALOG = { onChange: () => {} };
    const LOG = { warn: () => {}, error: () => {} };
    // The core answers each request with what the test queued for its method, and nothing otherwise.
    const asked = [];
    const answers = new Map();
    const CORE = {
        request: (method, params) => {
            asked.push({ method, params });
            return Promise.resolve(answers.get(method)?.shift() || []);
        },
    };
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
    RUNNER.start({ preparePage: (page) => done.push(['prepare', page.mod]) });
    await tick();
    const order = done.map(([what]) => what).join(' ');
    check(
        'a run page is made, watched, known and set up before it loads',
        order === 'make watch add prepare load',
        done
    );
    check('a run is kept with its page', RUNNER.runs()[0]?.page?.mod === 'a', RUNNER.runs());

    const page = RUNNER.runs()[0].page;
    const crashes = () => asked.filter(({ method }) => method === 'runner/crash').map(({ params }) => params.problem);
    watching.get(page).failed('ERR_NAME_NOT_RESOLVED');
    check(
        'a page that did not load crashes its run',
        crashes()[0] === 'its page did not load (ERR_NAME_NOT_RESOLVED)',
        crashes()
    );
    watching.get(page).ended('oom');
    check('a page whose process ended crashes its run, saying why', crashes()[1] === 'its page ended (oom)', crashes());
    watching.get(page).ended(null);
    check('a page whose document was replaced is told by what it set up, not here', crashes().length === 2, crashes());

    check('the quit is held while a run has not ended', hold() === true, null);
    check('the core is asked to stop the runs as the app quits', asked.at(-1)?.method === 'runner/quit', asked.at(-1));
    check('a quit asked again meanwhile waits too', hold() === true, null);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} runner checks`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
