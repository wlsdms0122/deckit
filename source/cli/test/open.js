// Opening an address (deckit-shell/deckit/open/main.js) over a stand-in for the core, the runner and the pages: the
// address is offered to the handlers the core routes it to in turn, each launched for the address, as the mod that
// asked, only as its turn comes; a handler that does not launch passes it on, and what none takes goes to what deckit
// opens it with by itself. Exits 1 with a line for each check that failed. The packages are ES modules, so they are
// imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createOpen } = await import(url('deckit-shell', 'deckit', 'open', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The asking mod's page, and a page for each handler once it runs. What main tells a page is kept, and the test
    // answers as the page.
    const asking = { name: 'page c' };
    const tells = [];
    let heard = null;
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    IPC.carry({ messages, pages: { isGone: () => false, watch: () => {} } }, { report: () => {} });

    const running = new Set();
    const failing = new Set();
    const activated = [];
    const RUNNER = {
        activate: async (id, origin) => {
            activated.push({ id, origin });
            if (failing.has(id))
                throw Object.assign(new Error(`${id} is not running: it did not launch`), { kind: 'NOT_RUNNING' });
            running.add(id);
            return { state: 'running' };
        },
    };
    const pages = new Map([['c', asking]]);
    const IDENTITY = {
        modOf: (page) => (page === asking ? { id: 'c', permissions: [] } : null),
        modFrom: (page) => (page === asking ? { id: 'c', permissions: [] } : null),
        pageOf: (id) => (running.has(id) ? (pages.get(id) ?? pages.set(id, { name: `page ${id}` }).get(id)) : null),
    };
    const CORE = {
        request: async (method, params) =>
            method === 'open/route' ? { url: params.url, handlers: ['a', 'b'], system: 'browser' } : true,
    };
    const opened = [];
    const SYSTEM = { url: async (address) => opened.push(address) };
    const OPEN = createOpen({ LOG: { warn: () => {} }, IDENTITY, RUNNER, CORE, open: SYSTEM });
    OPEN.start();

    const ask = (page, payload) =>
        heard.asked(page, {
            channel: 'deckit-shell:open',
            payload: { activates: true, usesDefaultApp: false, target: '', ...payload },
        });
    // The handler's page answers its latest offer with `value`.
    const answerAs = async (id, value) => {
        const offerOf = () =>
            tells.findLast(([to, message]) => to === pages.get(id) && message.channel === 'deckit-shell:open-offer');
        for (let turn = 0; turn < 20 && !offerOf(); turn++) await tick();
        const page = IDENTITY.pageOf(id);
        const offer = offerOf();
        tells.splice(tells.indexOf(offer), 1);
        heard.told(page, { channel: offer[1].channel, id: offer[1].id, value });
        return offer[1].payload;
    };

    const address = 'https://example.com';
    const first = ask(asking, { url: address });
    const offered = await answerAs('a', false);
    check(
        'the first handler is launched for the address, as the mod that asked, and offered it',
        activated.length === 1 &&
            activated[0].id === 'a' &&
            activated[0].origin.kind === 'work' &&
            activated[0].origin.work.url === address &&
            activated[0].origin.mod === 'c' &&
            offered.url === address,
        { activated, offered }
    );
    await answerAs('b', true);
    const taken = await first;
    check(
        'the next handler is launched only as its turn comes, and takes it',
        activated.length === 2 && activated[1].id === 'b' && taken.value === true && !opened.length,
        { activated, taken }
    );

    running.clear();
    activated.length = 0;
    failing.add('a');
    const second = ask(asking, { url: address });
    await answerAs('b', false);
    const passed = await second;
    check(
        'a handler that does not launch passes the address on, and what none takes goes to the browser',
        activated.map(({ id }) => id).join() === 'a,b' && passed.value === true && opened[0] === address,
        { activated, passed, opened }
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} open checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} open checks`);
}

main().catch((error) => {
    console.error('[open] ' + (error.stack || error.message));
    process.exit(1);
});
