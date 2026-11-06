// Deck's runner and connections in a mod's page (deckit-shell/deck/runner/renderer.js, deck/connection/renderer.js)
// over a stand-in for the messages main and the page carry, with a layer stacking two lifecycles: exports registered by
// interface, and for the mods that depend on it by id under its own id, each once for the run, refused with why for an
// interface the manifest does not provide, a second register, or one in the other lifecycle after one lifecycle opened
// it; what main is told each opened in; the `connect` handed the dependent's id and name; and the dependent's
// `dependencies`, by the id of the mod it requires, and `onConnect`, by the interface it uses. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported
// as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const { createRun } = await import(url('deckit-shell', 'deckit', 'runner', 'run.js'));
    const { createRunner } = await import(url('deckit-shell', 'deckit', 'runner', 'renderer.js'));
    const { createConnection } = await import(url('deckit-shell', 'deckit', 'connection', 'renderer.js'));
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
        uses: { 'q/optional': 1 },
        dependencies: { q: { version: '1.0.0', optional: false } },
        permissions: [],
    };
    const tells = [];
    let heard = null;
    const answers = {
        'deckit-shell:mod-load': () => ({ manifest: MANIFEST, source: '', run: 1 }),
        'deckit-shell:connection-begin': ({ lifecycle }) =>
            lifecycle === 0
                ? [
                      {
                          id: 10,
                          name: 'q',
                          required: true,
                          exportedIn: 0,
                          exports: { value: { answer: 42 }, references: [] },
                      },
                  ]
                : [],
    };
    IPC.carry(
        {
            messages: {
                listen: (listeners) => (heard = listeners),
                tell: (message) => tells.push(message),
                ask: async ({ channel, payload }) => ({ value: answers[channel]?.(payload) ?? null }),
                askSync: ({ channel, payload }) => ({ value: answers[channel]?.(payload) ?? null }),
            },
        },
        { report: () => {} }
    );
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

    // The mod: it provides p/one and p/two, opens its own exports for its id dependents, requires q and listens for
    // q/optional.
    const seen = { connected: [], heard: [] };
    class Mod {
        start(deckit) {
            seen.dependencies = Object.keys(deckit.dependencies);
            seen.required = deckit.dependencies.q.answer;
            deckit.exports.register('p/one', {
                connect: (connection) => {
                    seen.connected.push(connection);
                    return { who: () => connection.mod.id };
                },
            });
            deckit.exports.register({ connect: (connection) => ({ own: connection.mod.id }) });
            deckit.exports.register('p/one', { connect: () => ({}) });
            deckit.exports.register('q/other', { connect: () => ({}) });
        }

        attach(deckit) {
            deckit.exports.register('p/one', { connect: () => ({}) });
            deckit.exports.register({ connect: () => ({}) });
            deckit.exports.register('p/two', { connect: () => ({ two: true }) });
            deckit.dependencies.onConnect('q/optional', (exports) => seen.heard.push(exports));
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
        MODS: {},
        modules: { evaluate: () => Mod },
    });
    await RUNNER.start({ layers: [layer] });
    for (let at = 0; at < 5; at++) await tick();

    check(
        "a required mod's exports are the lifecycle's dependencies, by its id",
        seen.required === 42 && seen.dependencies.join() === 'q,onConnect',
        seen
    );
    const problems = payloads('mod-problem').map(({ problem }) => problem);
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
    const started = payloads('mod-started')[0];
    const joined = payloads('mod-joined').at(-1);
    check(
        "main is told the lifecycle each interface and the mod's own exports were opened in, these by its id",
        JSON.stringify(started?.contributions.exportedIn) === '{"p/one":0,"p":0}' &&
            JSON.stringify(joined?.contributions.exportedIn) === '{"p/one":0,"p":0,"p/two":1}',
        { started, joined }
    );
    check('the summary says exports were opened', joined?.summary.exports === true, joined?.summary);
    check(
        'main is told the interfaces the run listens for, by the lowest lifecycle',
        JSON.stringify(joined?.contributions.awaits) === '{"q/optional":1}',
        joined?.contributions
    );

    // The dependency's end: each connection asks the exports of its name, opened in that lifecycle.
    const one = await ask('connection-connect', {
        id: 1,
        name: 'p/one',
        mod: { id: 'd', name: 'D' },
        lifecycle: 0,
    });
    check(
        "an interface's exports are made for the dependent, handed its id and name",
        one?.value?.references?.[0]?.[0]?.[0] === 'who' &&
            seen.connected[0]?.mod.id === 'd' &&
            seen.connected[0]?.mod.name === 'D',
        { one, connected: seen.connected }
    );
    const two = await ask('connection-connect', {
        id: 2,
        name: 'p/two',
        mod: { id: 'd', name: 'D' },
        lifecycle: 1,
    });
    check("another interface's exports answer its own connections", two?.value?.value?.two === true, two);
    const wrong = await ask('connection-connect', {
        id: 3,
        name: 'p/two',
        mod: { id: 'd', name: 'D' },
        lifecycle: 0,
    });
    check('an interface is not answered for a lifecycle that did not open it', wrong?.value === null, wrong);
    const own = await ask('connection-connect', {
        id: 4,
        name: 'p',
        mod: { id: 'd', name: 'D' },
        lifecycle: 0,
    });
    check(
        "the mod's own exports answer a connection by its id, made for the dependent",
        own?.value?.value?.own === 'd',
        own
    );

    // The dependent's end: a connection that comes and goes is handed to what listens for its interface.
    heard.told({
        channel: 'deckit-shell:connection-connected',
        payload: {
            id: 20,
            name: 'q/optional',
            required: false,
            exportedIn: 1,
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
