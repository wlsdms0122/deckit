// The runner and connections in a mod's page (deckit-shell/deckit/runner/renderer.js, deckit/connection/renderer.js)
// over a stand-in for the messages main and the page carry, with a layer stacking two lifecycles: exports registered by
// interface, and for the mods that reach it by id under its own id, each once for the run, refused with why for an
// interface the manifest does not provide, a second register, or one in the other lifecycle after one lifecycle opened
// it; what main is told each opened in; the `connect` handed the client's id, name and credential; and the client's
// `dependencies.onConnect`, by the interface it uses or the mod id it reaches, handed a connection that stands as its
// lifecycle begins or comes later; `dependencies.onRefuse` handed a connection refused as a lifecycle begins, no
// problem against the run, and a mod an interface reaches that does not launch; and `dependencies.reach` and `release`:
// a mod by its id asked of main once while reached, answered with its exports once its connection stands, let go by as
// many releases, in the order asked, rejected with the core's kind, with what a mod that does not launch is refused
// with, with NOT_EXPORTED for one that runs with no exports for it, or with the kind its page refused the connection
// with, each of which lets the ask go, a reach after it a new connection; and what is declared to an interface handed
// with the declaring mod's credential, frozen. Exits 1 with a line for each check that failed. The packages are ES
// modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const { createRun } = await import(url('deckit-shell', 'deckit', 'runner', 'run.js'));
    const { createRunner } = await import(url('deckit-shell', 'deckit', 'runner', 'renderer.js'));
    const { createConnection } = await import(url('deckit-shell', 'deckit', 'connection', 'renderer.js'));
    const CONTRIBUTION = await import(url('deckit-shell', 'deckit', 'contribution', 'renderer.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    console.warn = () => {};

    // Main as the page reaches it: what the page tells is kept, what it asks is answered by channel, and the test asks
    // and tells the page as main.
    const MANIFEST = {
        id: 'p',
        name: 'P',
        main: 'main.js',
        provides: { 'p/one': [1], 'p/two': [1] },
        uses: { 'q/used': 1, 'q/optional': 1 },
        permissions: [{ id: 'deckit.reach-mods', reason: 'Reaches the mods.', usable: true }],
    };
    const tells = [];
    const asks = [];
    let heard = null;
    const answers = {
        'deckit-shell:mod-load': () => ({ manifest: MANIFEST, source: '', run: 1 }),
        'deckit-shell:contributions': () => [
            { mod: { id: 'a', name: 'A' }, credential: { mod: 'a', permissions: ['p/read'] }, entry: { key: 1 } },
        ],
        'deckit-shell:connection-begin': ({ lifecycle }) =>
            lifecycle === 0
                ? [{ id: 10, name: 'q/used', exports: { value: { answer: 42 }, references: [] } }]
                : [
                      {
                          id: 11,
                          name: 'r',
                          refusal: { stage: 'call', kind: 'REFUSED', message: 'r did not connect: refused' },
                      },
                  ],
    };
    // The core refuses to reach x, which the mod may not reach.
    const refusals = {
        'deckit-shell:connection-reach': ({ target }) =>
            target === 'x' && { message: 'x is out of reach of p', kind: 'NOT_PERMITTED' },
    };
    const answer = ({ channel, payload }) => {
        asks.push({ channel, payload });
        const error = refusals[channel]?.(payload);
        return error ? { error } : { value: answers[channel]?.(payload) ?? null };
    };
    IPC.carry(
        {
            messages: {
                listen: (listeners) => (heard = listeners),
                tell: (message) => tells.push(message),
                ask: async (message) => answer(message),
                askSync: (message) => answer(message),
            },
        },
        { report: () => {} }
    );
    const asked = (channel) =>
        asks.filter((message) => message.channel === `deckit-shell:${channel}`).map(({ payload }) => payload);
    const told = (channel) => tells.filter((message) => message.channel === `deckit-shell:${channel}`);
    const payloads = (channel) => told(channel).map(({ payload }) => payload.payload ?? payload);
    let asking = 0;
    const ask = async (channel, payload) => {
        const id = ++asking;
        heard.told({ channel: `deckit-shell:${channel}`, id, payload });
        await tick();
        await tick();
        return tells.find((message) => message.id === id && message.channel === `deckit-shell:${channel}`);
    };

    // The mod: it provides p/one and p/two, opens its own exports for the mods that reach it by id, listens for q/used
    // and q/optional, interfaces it uses, and reaches q by its id, and x, which it may not.
    const seen = { connected: [], heard: [], reached: [], cut: [], refusals: [] };
    const refusalOf = (error) => ({ message: error.message, kind: error.kind, stage: error.stage });
    class Mod {
        start(deckit) {
            seen.dependencies = deckit.dependencies;
            deckit.dependencies.onConnect('q/used', (exports) => (seen.atBegin = exports.answer));
            deckit.dependencies.onConnect('q', (exports) => {
                seen.reached.push(exports);
                return () => seen.cut.push('q');
            });
            seen.reach = deckit.dependencies.reach('q');
            seen.again = deckit.dependencies.reach('q');
            seen.refused = deckit.dependencies.reach('x').catch(refusalOf);
            seen.unreached = deckit.dependencies.reach('g').catch(refusalOf);
            seen.mistyped = deckit.dependencies.reach(5).catch(refusalOf);
            deckit.exports.register('p/one', {
                connect: (connection) => {
                    seen.connected.push(connection);
                    return { who: () => connection.credential.mod };
                },
            });
            deckit.exports.register({ connect: (connection) => ({ own: connection.credential.mod }) });
            deckit.exports.register('p/one', { connect: () => ({}) });
            deckit.exports.register('q/other', { connect: () => ({}) });
        }

        attach(deckit) {
            deckit.exports.register('p/one', { connect: () => ({}) });
            deckit.exports.register({ connect: () => ({}) });
            deckit.exports.register('p/two', { connect: () => ({ two: true }) });
            deckit.dependencies.onConnect('q/optional', (exports) => seen.heard.push(exports));
            deckit.dependencies.onRefuse('r', (error) => seen.refusals.push(['r', refusalOf(error)]));
            deckit.dependencies.onRefuse('q/optional', (error) => seen.refusals.push(['q/optional', refusalOf(error)]));
        }
    }
    const lifecycleOf = (method) => ({
        method,
        registrations: {},
        start: (instance, handles) => instance[method](handles.deckit),
        end: () => {},
        join: () => {},
    });
    const layer = () => ({ handle: 'deckit', lifecycles: [lifecycleOf('start'), lifecycleOf('attach')] });
    const RUN = createRun();
    const RUNNER = createRunner({
        RUN,
        STORAGE: { values: () => ({}), records: () => ({}) },
        CONNECTION: createConnection({ RUN }),
        EVENT: { forScope: () => ({}) },
        MODS: { tool: () => ({}) },
        modules: { evaluate: () => Mod },
    });
    await RUNNER.start({ layers: [layer] });
    for (let at = 0; at < 5; at++) await tick();

    check(
        'a connection standing as its lifecycle begins reaches what listens for its name, beside onConnect alone',
        seen.atBegin === 42 && Object.keys(seen.dependencies).join() === 'onConnect,onRefuse,reach,release',
        seen
    );
    const problems = payloads('mod-problem').map(({ problem }) => problem);
    check(
        'a connection refused as a lifecycle begins is heard by onRefuse added after, and the lifecycle goes on',
        !problems.some((problem) => /did not connect/.test(problem)) &&
            JSON.stringify(seen.refusals) ===
                '[["r",{"message":"r did not connect: refused","kind":"REFUSED","stage":"call"}]]' &&
            JSON.stringify(seen.heard) === '[]' &&
            !payloads('mod-not-started').length,
        { problems, refusals: seen.refusals }
    );
    check(
        'a second register of an interface is refused on the row',
        problems.some((problem) =>
            /deckit\.exports\.register\(\) is called once for each name, and p\/one/.test(problem)
        ),
        problems
    );
    check(
        'a register of an interface the manifest does not provide is refused on the row',
        problems.some((problem) => /takes an interface the manifest provides, and q\/other is not one/.test(problem)),
        problems
    );
    check(
        'a register in the other lifecycle after one lifecycle opened the interface is refused on the row',
        problems.some((problem) => /a lifecycle under it opened p\/one/.test(problem)),
        problems
    );
    check(
        'a register of its own exports in the other lifecycle after one lifecycle opened them is refused on the row',
        problems.some((problem) => /a lifecycle under it opened its own id/.test(problem)),
        problems
    );
    const started = payloads('mod-started');
    check(
        "main is told the run started once, after each lifecycle, with the lifecycle each interface and the mod's own " +
            'exports were opened in, these by its id',
        started.length === 1 && JSON.stringify(started[0].contributions.exportedIn) === '{"p/one":0,"p":0,"p/two":1}',
        started
    );
    check('the summary says exports were opened', started[0]?.summary.exports === true, started[0]?.summary);
    check(
        'main is told the interfaces the run listens for, by the lowest lifecycle',
        JSON.stringify(started[0]?.contributions.awaits) === '{"q/used":0,"q":0,"q/optional":1}',
        started[0]?.contributions
    );

    // The dependency's end: each connection asks the exports of its name, opened in that lifecycle.
    const one = await ask('connection-connect', {
        id: 1,
        name: 'p/one',
        mod: { name: 'D' },
        credential: { mod: 'd', permissions: ['p/read'] },
        lifecycle: 0,
    });
    check(
        "an interface's exports are made for the dependent, handed its name",
        one?.value?.references?.[0]?.[0]?.[0] === 'who' && JSON.stringify(seen.connected[0]?.mod) === '{"name":"D"}',
        { one, connected: seen.connected }
    );
    const credential = seen.connected[0]?.credential;
    check(
        "the service reads the dependent's credential, frozen",
        JSON.stringify(credential) === '{"mod":"d","permissions":["p/read"]}' &&
            Object.isFrozen(credential) &&
            Object.isFrozen(credential.permissions),
        credential
    );
    const two = await ask('connection-connect', {
        id: 2,
        name: 'p/two',
        mod: { name: 'D' },
        credential: { mod: 'd', permissions: ['p/read'] },
        lifecycle: 1,
    });
    check("another interface's exports answer its own connections", two?.value?.value?.two === true, two);
    const wrong = await ask('connection-connect', {
        id: 3,
        name: 'p/two',
        mod: { name: 'D' },
        credential: { mod: 'd', permissions: ['p/read'] },
        lifecycle: 0,
    });
    check('an interface is not answered for a lifecycle that did not open it', wrong?.value === null, wrong);
    const own = await ask('connection-connect', {
        id: 4,
        name: 'p',
        mod: { name: 'D' },
        credential: { mod: 'd', permissions: ['p/read'] },
        lifecycle: 0,
    });
    check(
        "the mod's own exports answer a connection by its id, made for the dependent",
        own?.value?.value?.own === 'd',
        own
    );

    // The dependent's end: a mod an interface reaches that does not launch is heard by what listens for its refusals.
    heard.told({
        channel: 'deckit-shell:connection-unreached',
        payload: {
            lifecycle: 1,
            name: 'q/optional',
            refusal: { stage: 'launch', kind: 'RELAUNCH_LIMIT', message: 'q is at the relaunch limit' },
        },
    });
    for (let at = 0; at < 3; at++) await tick();
    check(
        'onRefuse hears a mod an interface reaches that does not launch, with its kind and stage',
        JSON.stringify(seen.refusals[1]) ===
            '["q/optional",{"message":"q is at the relaunch limit","kind":"RELAUNCH_LIMIT","stage":"launch"}]',
        seen.refusals
    );

    // A connection that comes and goes is handed to what listens for its interface.
    heard.told({
        channel: 'deckit-shell:connection-connected',
        payload: {
            id: 20,
            name: 'q/optional',
            exports: { value: { optional: true }, references: [] },
            lifecycle: 1,
        },
    });
    for (let at = 0; at < 3; at++) await tick();
    check(
        'onConnect hears a connection of the interface it names, handed its exports alone',
        seen.heard.length === 1 && JSON.stringify(seen.heard[0]) === '{"optional":true}',
        seen.heard
    );

    // A mod reached by its id: asked of main for the lifecycle, handed to what listens for its id once it stands, and
    // let go.
    const targets = (channel) => asked(channel).map(({ target }) => target);
    check(
        'a reach by id is asked of main for the lifecycle that asks, once while it is reached',
        JSON.stringify(asked('connection-reach')[0]) === '{"run":1,"lifecycle":0,"target":"q"}' &&
            targets('connection-reach').filter((target) => target === 'q').length === 1,
        asked('connection-reach')
    );
    const refused = await seen.refused;
    check(
        'a reach the core refuses rejects with its kind, at call',
        refused?.kind === 'NOT_PERMITTED' && refused.stage === 'call' && /out of reach/.test(refused.message),
        refused
    );
    const mistyped = await seen.mistyped;
    check(
        'a reach of an id that is no string is refused for its argument, and not asked of main',
        mistyped?.kind === 'INVALID_ARGUMENT' &&
            mistyped.stage === 'call' &&
            !targets('connection-reach').includes('5'),
        mistyped
    );
    let settled = false;
    seen.reach.then(() => (settled = true));
    for (let at = 0; at < 3; at++) await tick();
    check('a reach does not answer before its connection stands', !settled, settled);
    heard.told({
        channel: 'deckit-shell:connection-connected',
        payload: { id: 30, name: 'q', exports: { value: { byId: true }, references: [] }, lifecycle: 0 },
    });
    for (let at = 0; at < 3; at++) await tick();
    const [first, second] = await Promise.all([seen.reach, seen.again]);
    check(
        'each reach of a mod by its id answers the exports of its connection once it stands',
        JSON.stringify([first, second]) === '[{"byId":true},{"byId":true}]',
        [first, second]
    );
    check(
        'a mod reached by its id is handed to what listens for its id',
        JSON.stringify(seen.reached) === '[{"byId":true}]',
        seen.reached
    );
    const third = await seen.dependencies.reach('q');
    check(
        'a reach of a mod whose connection stands answers at once, asking main nothing',
        third?.byId === true && targets('connection-reach').filter((target) => target === 'q').length === 1,
        { third, asked: asked('connection-reach') }
    );
    await seen.dependencies.release('q');
    await seen.dependencies.release('q');
    check(
        'a reach is let go by as many releases: main is asked nothing while one is left',
        !asked('connection-release-reach').length,
        asked('connection-release-reach')
    );
    await seen.dependencies.release('q');
    check(
        'a release is asked of main for the lifecycle and the id',
        JSON.stringify(asked('connection-release-reach')) === '[{"run":1,"lifecycle":0,"target":"q"}]',
        asked('connection-release-reach')
    );

    // A mod reached by its id that does not launch: the reach rejects with its refusal, and the ask goes.
    heard.told({
        channel: 'deckit-shell:connection-unreached',
        payload: {
            lifecycle: 0,
            name: 'g',
            refusal: { stage: 'launch', kind: 'NOT_INSTALLED', message: 'no mod is listed under g' },
        },
    });
    for (let at = 0; at < 3; at++) await tick();
    check(
        'a reach of a mod that does not launch rejects with its kind and stage',
        JSON.stringify(await seen.unreached) ===
            '{"message":"no mod is listed under g","kind":"NOT_INSTALLED","stage":"launch"}',
        await seen.unreached
    );
    check(
        'a reach refused lets the ask go',
        targets('connection-release-reach').join() === 'q,g',
        asked('connection-release-reach')
    );
    const again = seen.dependencies.reach('g');
    again.catch(() => {});
    for (let at = 0; at < 3; at++) await tick();
    check(
        'a reach after a refusal asks main again',
        targets('connection-reach').filter((target) => target === 'g').length === 2,
        asked('connection-reach')
    );
    const cancelled = seen.dependencies.reach('h').catch(refusalOf);
    seen.dependencies.release('h');
    seen.dependencies.reach('h').catch(() => {});
    for (let at = 0; at < 5; at++) await tick();
    const order = asks
        .filter(({ channel, payload }) => /connection-(release-)?reach$/.test(channel) && payload.target === 'h')
        .map(({ channel }) => channel.replace('deckit-shell:connection-', ''));
    check('a release is asked before a reach asked after it', order.join() === 'reach,release-reach,reach', order);
    check(
        'a reach let go before it connected rejects at call, CANCELLED',
        JSON.stringify(await cancelled) ===
            '{"message":"h was let go before it connected","kind":"CANCELLED","stage":"call"}',
        await cancelled
    );
    heard.told({ channel: 'deckit-shell:connection-disconnected', payload: { id: 30 } });
    for (let at = 0; at < 3; at++) await tick();
    check('the connection let go ends what its onConnect answered', seen.cut.join() === 'q', seen.cut);

    // A mod reached by its id that runs with no exports for it, then one whose page refuses the connection: each reach
    // rejects, the ask goes, and a reach after it connects anew.
    const reachedAgain = async (id, refusal, connection) => {
        const rejected = seen.dependencies.reach(id).catch(refusalOf);
        for (let at = 0; at < 3; at++) await tick();
        if (refusal.kind === 'NOT_EXPORTED')
            heard.told({ channel: 'deckit-shell:connection-unreached', payload: { lifecycle: 0, name: id, refusal } });
        else
            heard.told({
                channel: 'deckit-shell:connection-connected',
                payload: { id: connection, name: id, refusal, lifecycle: 0 },
            });
        for (let at = 0; at < 3; at++) await tick();
        const refused = await rejected;
        const anew = seen.dependencies.reach(id);
        for (let at = 0; at < 3; at++) await tick();
        heard.told({
            channel: 'deckit-shell:connection-connected',
            payload: { id: connection + 1, name: id, exports: { value: { id }, references: [] }, lifecycle: 0 },
        });
        for (let at = 0; at < 3; at++) await tick();
        return {
            refused,
            connected: (await anew).id,
            reaches: targets('connection-reach').filter((target) => target === id).length,
            releases: targets('connection-release-reach').filter((target) => target === id).length,
        };
    };
    const notExported = { message: 'u runs with no exports for u', kind: 'NOT_EXPORTED', stage: 'call' };
    const unexported = await reachedAgain('u', notExported, 40);
    check(
        'a reach of a mod that runs with no exports for it rejects at call, and a reach after it connects anew',
        JSON.stringify(unexported) ===
            JSON.stringify({ refused: notExported, connected: 'u', reaches: 2, releases: 1 }),
        unexported
    );
    const busy = { message: 's did not connect: busy', kind: 'REFUSED', stage: 'call' };
    const turnedDown = await reachedAgain('s', busy, 50);
    check(
        'a reach whose connection its page refused rejects with that kind, and a reach after it connects anew',
        JSON.stringify(turnedDown) === JSON.stringify({ refused: busy, connected: 's', reaches: 2, releases: 1 }),
        turnedDown
    );

    // What is declared to an interface: each entry with the declaring mod's credential, frozen.
    const [declared] = await CONTRIBUTION.contributions('p/one');
    check(
        "an entry declared to an interface is handed with the declaring mod's credential, frozen",
        JSON.stringify(declared) ===
            '{"mod":{"id":"a","name":"A"},"credential":{"mod":"a","permissions":["p/read"]},"entry":{"key":1}}' &&
            Object.isFrozen(declared.credential) &&
            Object.isFrozen(declared.credential.permissions),
        declared
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} exports checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} exports checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error('[exports] ' + (error.stack || error.message));
    process.exit(1);
});
