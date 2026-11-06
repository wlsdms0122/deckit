// The events of a mod's page (deckit-shell/deckit/event/renderer.js): a page listens only to names its manifest names,
// its own id, the ids in [dependencies] and the interfaces it uses or provides, and is refused any other. Exits 1 with
// a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createEvent } = await import(url('deckit-shell', 'deckit', 'event', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const tells = [];
    IPC.carry(
        {
            messages: {
                listen: () => {},
                tell: (message) => tells.push(message),
                ask: async () => ({ value: null }),
                askSync: () => ({ value: null }),
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
        mod: { id: 'a', dependencies: { b: {} }, uses: { 'c/api': 1 }, provides: { 'a/api': [1] } },
        deliver: () => {},
        fail: () => {},
    };
    const { events } = createEvent({ RUN }).forScope({ handle: 'deckit', scope: makeScope() });
    const refused = (name) => {
        try {
            events.on(name, () => {});
            return null;
        } catch (error) {
            return error.message;
        }
    };

    const named = ['a:status', 'b:status', 'c/api:changed', 'a/api:owner-changed'].map(refused);
    check(
        'a page hears names of its own id, its dependencies and the interfaces it uses or provides',
        named.every((why) => why === null),
        named
    );
    const other = refused('d:status');
    check(
        'a page is refused a name its manifest does not name',
        other ===
            'deckit.events.on() hears the names of its own id, its [dependencies] and its interfaces, not "d:status"',
        other
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
