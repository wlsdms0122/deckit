// Deckit as a layer on the runner in a mod's page (deckit-shell/deckit/mod/renderer.js), with a layer over it stacking
// a lifecycle of its own on what deckit offers it: that lifecycle registers its own alone and is handed deckit's
// handle, which takes a chord only for a mod with deckit.app-keys or system.global-keys; a press of the chord runs what
// took it, and the chord is let go once the lifecycle that took it ends. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const { createMod } = await import(url('deckit-shell', 'deckit', 'mod', 'renderer.js'));
    const { createKeymap } = await import(url('deckit-shell', 'deckit', 'keymap', 'renderer.js'));
    const { makeScope } = await import(url('deckit-shell', 'deckit', 'runner', 'model', 'scope.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // What carries the page's channels: main answers what the page asks, and the test tells the page as main.
    const sent = []; // { channel, payload }, what the page told or asked main
    let tell = null;
    IPC.carry(
        {
            messages: {
                listen: ({ told }) => (tell = told),
                tell: (message) => sent.push(message),
                ask: async (message) => {
                    sent.push(message);
                    return { value: message.channel === 'deckit-shell:keymap-take' };
                },
                askSync: (message) => ({
                    value: message.channel === 'deckit-shell:runtime-about' ? { home: '/h' } : null,
                }),
            },
        },
        { report: () => {} }
    );

    const layerOf = (permissions) =>
        createMod({
            WEB: { forMod: () => ({}) },
            NOTIFICATION: { listen: () => {}, notificationsOf: () => ({}) },
            KEYMAP: createKeymap(),
        }).layer({ mod: { id: 'a', permissions: permissions.map((id) => ({ id })) }, deliver: () => {} });

    const deckit = layerOf(['deckit.app-keys']);
    check('deckit registers nothing of its own', Object.keys(deckit.lifecycles[0].registrations).length === 0, deckit);
    let handed = null;
    const lifecycle = deckit.over.lifecycle({
        method: 'attach',
        registrations: { view: { handle: 'shell', check: () => '' } },
        start: async (_instance, handles) => (handed = handles),
        end: async () => {},
        join: () => {},
    });
    check(
        'a lifecycle over deckit registers its own alone',
        Object.keys(lifecycle.registrations).join() === 'view',
        Object.keys(lifecycle.registrations)
    );

    const scope = makeScope();
    await lifecycle.start({}, { deckit: { exports: {} }, shell: {} }, scope);
    const handle = handed?.deckit;
    check("a lifecycle over deckit is handed deckit's handle", typeof handle?.urls?.open === 'function', handed);
    check(
        'the handle holds no commands or configuration',
        !handle.commands && !handle.configuration && !handle.modConfiguration,
        handle
    );
    check('a mod with deckit.app-keys takes a chord', typeof handle.keys?.take === 'function', handle.keys);

    let ran = 0;
    const chord = await handle.keys.take({ code: 'KeyK', alt: true }, () => ran++);
    const asked = sent.find(({ channel }) => channel === 'deckit-shell:keymap-take');
    check('a chord taken answers whether it is held', chord.held === true, chord);
    check(
        'a chord is asked of main with its keystroke and scope, in the app when none is named',
        asked?.payload.keystroke.code === 'KeyK' && asked.payload.keystroke.alt && asked.payload.scope === 'app',
        asked
    );
    tell({ channel: 'deckit-shell:keymap-key', payload: { id: asked.payload.id } });
    await tick();
    check('a press told to the page runs what took the chord', ran === 1, ran);
    tell({ channel: 'deckit-shell:keymap-key', payload: { id: asked.payload.id + 1 } });
    await tick();
    check('a press of a chord not taken here runs nothing', ran === 1, ran);

    scope.cut();
    const released = sent.find(({ channel }) => channel === 'deckit-shell:keymap-release');
    check('a chord is let go once its lifecycle ends', released?.payload.id === asked.payload.id, sent);
    tell({ channel: 'deckit-shell:keymap-key', payload: { id: asked.payload.id } });
    await tick();
    check('a chord let go runs nothing', ran === 1, ran);

    const plain = layerOf([]);
    let plainHanded = null;
    const instance = { start: (given) => (plainHanded = given) };
    await plain.lifecycles[0].start(instance, { deckit: { exports: {} } }, makeScope());
    check('a mod with neither key permission takes no chord', plainHanded && !plainHanded.keys, plainHanded);

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
