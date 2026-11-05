// The Settings mod's Activity section (mods/settings/src/sections/activity): the mods it lists as running, why each
// runs in words, how long, and what is wrong with it; and the startup approval as deck's catalog asks the core for it
// (deckit-shell/deck/catalog) over a stand-in for the core. Exits 1 with a line for each check that failed.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const ACTIVITY = require(
        path.join(
            __dirname,
            '..',
            '..',
            'deckit',
            'mods',
            'settings',
            'src',
            'sections',
            'activity',
            'activity-section.js'
        )
    );
    const { createCatalog } = await import(url('deckit-shell', 'deck', 'catalog', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const found = [
        { id: 'a', name: 'A', run: { state: 'running', origin: { kind: 'person' } } },
        { id: 'b', name: 'B', run: { state: 'notRunning', origin: { kind: 'startup' } } },
        { id: 'c', name: 'C', run: null },
        { id: 'd', name: 'D', run: { state: 'launching', origin: { kind: 'required', by: 'a' } } },
        { id: 'e', name: 'E', run: { state: 'terminating', origin: { kind: 'startup' } } },
    ];
    const running = ACTIVITY.runningOf(found)
        .map(({ id }) => id)
        .join();
    check('a mod launching, running or terminating is listed, in the mods order', running === 'a,d,e', running);

    const nameOf = (id) => found.find((mod) => mod.id === id)?.name || id;
    const texts = [
        { kind: 'person' },
        { kind: 'startup' },
        { kind: 'required', by: 'a' },
        { kind: 'work', work: { connection: 'x/api' }, mod: 'd' },
        { kind: 'work', work: { command: 'show' }, mod: 'gone' },
        { kind: 'work', work: { token: 't' }, mod: 'a' },
        { kind: 'work', work: { key: 'toggle' } },
        { kind: 'work', work: { url: 'mailto:x' }, mod: 'a' },
    ].map((origin) => ACTIVITY.originText(origin, nameOf));
    const expected = [
        'Opened by you',
        'Started with the app',
        'Required by A',
        'For a connection to x/api from D',
        'For its command show from gone',
        'For a command it handed out from A',
        'For its key toggle',
        'To open mailto:x from A',
    ];
    check('why a run launched reads as the origin says', JSON.stringify(texts) === JSON.stringify(expected), texts);

    const elapsed = [20000, 5 * 60000, 125 * 60000, (50 * 60 + 3) * 60000].map(ACTIVITY.elapsedText);
    const told = ['less than a minute', '5 min', '2 h 5 min', '2 d 2 h'];
    check('how long a mod ran, in the largest unit', JSON.stringify(elapsed) === JSON.stringify(told), elapsed);

    const problems = ACTIVITY.problemsOf(
        { run: { problem: 'crashed' }, declarationProblems: ['configuration "x": bad'] },
        'refused'
    );
    check(
        "a run's problem, what it declares wrong and a refusal are all told",
        problems.join('|') === 'crashed|configuration "x": bad|refused',
        problems
    );

    const asked = [];
    let approved = false;
    const CORE = {
        request: async (method, params) => {
            asked.push({ method, params });
            if (method === 'catalog/approve-startup') approved = params.approved;
            if (method === 'catalog/read')
                return [{ manifest: { id: 'a', startup: 'why' }, id: 'a', startupApproved: approved }];
            if (method === 'catalog/interfaces') return [];
            return null;
        },
    };
    const CATALOG = createCatalog({ CORE, LOG: { info() {}, warn() {}, error() {} }, files: {} });
    let heard = 0;
    CATALOG.onChange(() => heard++);
    await CATALOG.approveStartup('a', true);
    check(
        'approving a startup asks the core, then reads the mods again',
        asked[0].method === 'catalog/approve-startup' &&
            JSON.stringify(asked[0].params) === JSON.stringify({ mod: 'a', approved: true }) &&
            asked[1].method === 'catalog/read',
        asked
    );
    check('the approval is read back and told', CATALOG.found()[0].startupApproved === true && heard === 1, heard);

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} activity checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
