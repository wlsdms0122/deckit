// The events of a mod's page (deckit-shell/deckit/event/renderer.js): a page listens only to names its manifest names,
// its own id and the interfaces it uses or provides, and is refused any other, and each refusal is thrown with its
// stage and kind. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as
// such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createEvent } = await import(url('deckit-shell', 'deckit', 'event', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const IPC = await import(url('deckit-sdk', 'deckit', 'ipc', 'renderer.js'));
    const tells = [];
    IPC.carry(
        {
            messages: {
                listen: () => {},
                tell: (message) => tells.push(message),
                ask: async () => ({ value: null }),
                askSync: (message) => {
                    tells.push(message);
                    return { value: true };
                },
            },
        },
        { report: () => {} }
    );
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const RUN = {
        number: 1,
        mod: { id: 'a', uses: { 'c/api': 1 }, provides: { 'a/api': [1] } },
        granted: [],
        deliver: () => {},
        fail: () => {},
    };
    const { events } = createEvent({ RUN }).forScope({ handle: 'deckit', scope: makeScope() });
    const reaching = createEvent({
        RUN: { ...RUN, granted: ['deckit.reach-mods'] },
    }).forScope({ handle: 'deckit', scope: makeScope() }).events;
    const thrown = (make) => {
        try {
            make();
            return null;
        } catch (error) {
            return error;
        }
    };
    const refused = (name) => thrown(() => events.on(name, () => {}))?.message ?? null;
    const kindOf = (make) => {
        const error = thrown(make);
        return error && `${error.stage} ${error.kind}`;
    };

    const named = ['a:status', 'c/api:changed', 'a/api:owner-changed'].map(refused);
    check(
        'a page hears names of its own id and the interfaces it uses or provides',
        named.every((why) => why === null),
        named
    );
    const other = refused('d:status');
    check(
        'a page is refused a name its manifest does not name',
        other === 'deckit.events.on() hears only the names it may hear, not "d:status"',
        other
    );
    const reached = [() => reaching.on('d:status', () => {}), () => reaching.on('d/api:changed', () => {})].map(kindOf);
    check(
        'a page that may reach mods hears any mod id, and no interface it neither uses nor provides',
        reached[0] === null && reached[1] === 'call NOT_PERMITTED',
        reached
    );
    check(
        'a name of another mod is refused NOT_PERMITTED',
        kindOf(() => events.on('d:status', () => {})) === 'call NOT_PERMITTED'
    );
    const invalid = [
        () => events.on('status', () => {}),
        () => events.on(1, () => {}),
        () => events.on({ toString: () => 'a:status' }, () => {}),
        () => events.on('a:status', 'no function'),
        () => events.on('d:status', 'no function'),
        () => events.emit(1),
        () => events.emit('status', null),
        () => events.emit('status', { at: new Date() }),
        () => events.emit('status', [() => {}]),
        () => events.emit('status', NaN),
        () => events.emit('status', [undefined]),
    ].map(kindOf);
    check(
        'a name that is no scoped string, a listener, an emitted name of another type or no value are refused INVALID_ARGUMENT',
        invalid.every((kind) => kind === 'call INVALID_ARGUMENT'),
        invalid
    );
    check('an event of values is sent', kindOf(() => events.emit('status', 1.5, 'two', { three: [3] })) === null);
    const sent = tells.at(-1);
    check(
        'an emit sends the run, the name as written and the values',
        sent.channel === 'deckit-shell:event-emit' &&
            JSON.stringify(sent.payload) ===
                JSON.stringify({ run: 1, name: 'status', args: [1.5, 'two', { three: [3] }] }),
        sent
    );
    check(
        'a key of a table that holds undefined is left out of what is sent',
        kindOf(() => events.emit('status', { one: 1, none: undefined })) === null &&
            !Object.hasOwn(tells.at(-1).payload.args[0], 'none'),
        tells.at(-1)
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} event checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} event checks`);
    process.exit(0);
}

main().catch((error) => {
    console.error('[event] ' + (error.stack || error.message));
    process.exit(1);
});
