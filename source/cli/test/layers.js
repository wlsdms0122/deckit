// Deckit as a layer on deck in a mod's page (deckit-shell/deckit/mod/renderer.js), with a layer over it stacking a
// lifecycle of its own on what deckit offers it: a key registered under that lifecycle that would never run once it
// has joined is withdrawn while it lasts, and back once it has ended. Exits 1 with a line for each check that failed.
// The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createMod } = await import(url('deckit-shell', 'deckit', 'mod', 'renderer.js'));
    const { createKeymap } = await import(url('deckit-shell', 'deckit', 'keymap', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deck', 'runner', 'model', 'scope.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The page's key map as deckit keeps it, heard by no page.
    const KEYMAP = { ...createKeymap(), hear: () => {} };
    const MOD = createMod({
        WEB: { forMod: () => ({}) },
        NOTIFICATION: { listen: () => {} },
        KEYMAP,
        COMMAND: { declare: () => ({ declared: [], off: () => {} }) },
        CONFIGURATION: { declare: () => {}, ready: Promise.resolve() },
    });
    const problems = [];
    const deckit = MOD.layer({
        mod: { permissions: [], urls: [] },
        deliver: () => {},
        fail: (why) => problems.push(why),
    });
    const keysOf = () => deckit.report().contributions.keys.map(({ name }) => name);

    const under = makeScope();
    deckit.lifecycles[0].join(
        { keys: { front: { run: () => {}, scope: 'local' }, wide: { run: () => {}, scope: 'app' } } },
        under
    );
    check('the keys start registers are reported', keysOf().join() === 'front,wide', keysOf());

    const over = makeScope();
    const keyProblem = (key) => (key.scope === 'local' ? 'it is never in front' : '');
    deckit.over.join({ keys: { late: { run: () => {}, scope: 'local' } } }, over, { keyProblem });
    check('a key registered over it that would never run is left out', !keysOf().includes('late'), keysOf());
    check('a key registered under it that would never run is withdrawn', keysOf().join() === 'wide', keysOf());
    check(
        'what is withdrawn is told to the mod',
        problems.some((why) => /key "front" never runs: it is never in front/.test(why)),
        problems
    );
    const again = KEYMAP.declare({ front: { run: () => {} } }, { invalid: () => {}, problemOf: () => '' });
    check('a key withdrawn no longer runs in the page', again.declared.length === 1, again.declared);
    again.off();

    over.cut();
    check('a key withdrawn is back once the lifecycle over it has ended', keysOf().join() === 'wide,front', keysOf());
    const taken = [];
    KEYMAP.declare({ front: { run: () => {} } }, { invalid: (why) => taken.push(why), problemOf: () => '' });
    check('a key back runs in the page again', /declared under it/.test(taken[0] || ''), taken);

    under.cut();
    check('the keys of a lifecycle that ended are gone', keysOf().length === 0, keysOf());

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} layer checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} layer checks`);
}

main().catch((error) => {
    console.error('[layers] ' + (error.stack || error.message));
    process.exit(1);
});
