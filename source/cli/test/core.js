// Deck's client of the core (deckit-shell/deck/core), checked over a stand-in for how the environment reaches the
// core: what it sends first, how it waits for that, what an answer and a refusal come to, and that a core that ended
// refuses everything after. Exits 1 with a line for each check that failed. The packages are ES modules, so they are
// imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const outcome = (promise) =>
    promise.then(
        (value) => ({ value }),
        (error) => ({ error: error.message, kind: error.kind ?? null })
    );

async function main() {
    const { createCore } = await import(url('deckit-shell', 'deck', 'core', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The core as the environment gives it: what deck sends is kept, and the test answers for the core.
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
    const CONFIG = { name: 'Test', schemeHandlers: {} };
    const FOLDERS = { ship: ['/ship'], sources: [] };
    const CORE = createCore({ CONFIG, FOLDERS, LOG, core, home: '/home/deckit' });

    CORE.start({ permissions: [{ id: 'a.b' }] });
    const early = outcome(CORE.request('catalog/read', {}));
    await tick();
    check('initialize goes first, alone', sent.length === 1 && sent[0].method === 'initialize', sent);
    check(
        'initialize carries the home and the permissions',
        sent[0].params.home === '/home/deckit' && sent[0].params.permissions[0].id === 'a.b',
        sent[0].params
    );
    answer(sent[0].id, {});
    await tick();
    check('what was asked before initialize is sent once it is answered', sent[1]?.method === 'catalog/read', sent);
    answer(sent[1].id, [1, 2]);
    const read = await early;
    check('an answer settles its request with the result', JSON.stringify(read.value) === '[1,2]', read);

    const refused = outcome(CORE.request('state/write', {}));
    await tick();
    listeners.onMessage(
        JSON.stringify({ jsonrpc: '2.0', id: sent[2].id, error: { message: 'no', data: { kind: 'RESERVED' } } })
    );
    const refusal = await refused;
    check('a refusal rejects with its kind', refusal.error === 'no' && refusal.kind === 'RESERVED', refusal);

    listeners.onMessage('not json');
    listeners.onMessage(JSON.stringify({ jsonrpc: '2.0', id: 999, result: null }));
    check(
        'what is no message, and an answer to nothing asked, are logged',
        logged.filter(([level]) => level === 'error').length === 2,
        logged
    );
    listeners.onLog('hello');
    check(
        "the core's log goes to deck's",
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
    const after = await outcome(CORE.request('catalog/read', {}));
    const before = sent.length;
    check('a core that ended refuses what is asked after', after.kind === 'ENDED', after);
    check('nothing is sent to a core that ended', sent.length === before, sent.length);

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
