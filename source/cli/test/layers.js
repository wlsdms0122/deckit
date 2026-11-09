// Deckit as a layer on the runner in a mod's page (deckit-shell/deckit/mod/renderer.js), with a layer over it stacking
// a lifecycle of its own on what deckit offers it: that lifecycle registers its own alone and is handed deckit's
// handle, which opens an address outside the app with openExternal and takes a chord for a mod with
// deckit.app-keys; a press of the chord runs what took it, and the chord is let go once the lifecycle that took it
// ends. Every member a permission guards is on the handle of a mod granted nothing, and refuses at call with
// NOT_PERMITTED; for a mod granted it, an argument of another type or left out is refused with INVALID_ARGUMENT, none
// turned into its type, and fileURL and filePath throw that refusal. Then the runner (deckit-shell/deckit/runner/renderer.js) with deckit and layers over it:
// the run is told started once, after the lifecycle over deckit's has ended as its start threw, none over it started,
// and a layer whose read threw left out with the one over it; and the handle of a mod granted nothing: `mods` on it,
// each request refused at call with NOT_PERMITTED before its arguments are read, `quit()` a promise, and `openExternal`
// refused NOT_PERMITTED for a file, then INVALID_ARGUMENT for an argument of another type; with deckit.mods, a request
// refused INVALID_ARGUMENT for an argument of another type and asked of main otherwise. Exits 1 with a line for each
// check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const { createMod } = await import(url('deckit-shell', 'deckit', 'mod', 'renderer.js'));
    const { createKeymap } = await import(url('deckit-shell', 'deckit', 'keymap', 'renderer.js'));
    const { createWeb } = await import(url('deckit-shell', 'deckit', 'web', 'renderer.js'));
    const { createNotification } = await import(url('deckit-shell', 'deckit', 'notification', 'renderer.js'));
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
                    value:
                        message.channel === 'deckit-shell:runtime-about'
                            ? { home: '/h' }
                            : message.channel === 'deckit-shell:mod-load'
                              ? {
                                    manifest: { id: 'm', name: 'M', main: 'main.js', permissions: [] },
                                    granted: [],
                                    end: 5000,
                                    source: '',
                                    run: 1,
                                }
                              : null,
                }),
            },
        },
        { report: () => {} }
    );

    const layerOf = (granted) =>
        createMod({
            WEB: createWeb({ sessions: {}, web: {} }),
            NOTIFICATION: createNotification(),
            KEYMAP: createKeymap(),
        }).layer({ mod: { id: 'a' }, granted, deliver: () => {} });

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
    check(
        "a lifecycle over deckit is handed deckit's handle, which opens outside the app with openExternal",
        typeof handle?.openExternal === 'function' && !('urls' in handle),
        handed
    );
    await handle.openExternal('https://example.com', { activates: false });
    const opened = sent.find(({ channel }) => channel === 'deckit-shell:open');
    check(
        'openExternal asks main to open the address with the system',
        JSON.stringify(opened?.payload) === '{"url":"https://example.com","activates":false}',
        opened
    );
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

    const refusalOf = (promise) =>
        promise.then(
            () => 'fulfilled',
            (error) => `${error.stage} ${error.kind}`
        );
    const thrownOf = (call) => {
        try {
            call();
            return 'answered';
        } catch (error) {
            return `${error.stage} ${error.kind}`;
        }
    };
    const handleOf = async (permissions) => {
        let given = null;
        await layerOf(permissions).lifecycles[0].start(
            { start: (handed) => (given = handed) },
            { deckit: { exports: {} } },
            makeScope()
        );
        return given;
    };
    const guarded = (on) => ({
        'keys.take': () => on.keys.take({ code: 'KeyK' }, () => {}),
        'keys.take in global': () => on.keys.take({ code: 'KeyK' }, () => {}, { scope: 'global' }),
        reveal: () => on.reveal('/a'),
        'clipboard.readText': () => on.clipboard.readText(),
        'clipboard.writeText': () => on.clipboard.writeText('a'),
        'notifications.show': () => on.notifications.show({ title: 'a' }),
        mainProcess: () => on.mainProcess('main.js'),
        'web.session.fetch': () => on.web.session('a').fetch('https://example.com'),
        'web.session.trust': () => on.web.session('a').trust([]),
        'web.session.allow': () => on.web.session('a').allow([]),
        'web.session.revoke': () => on.web.session('a').revoke([]),
        'web.downloads.reveal': () => on.web.downloads.reveal('1'),
        'web.downloads.open': () => on.web.downloads.open('1'),
    });
    const plain = await handleOf([]);
    sent.length = 0;
    for (const [member, call] of Object.entries(guarded(plain)))
        check(
            `${member} is on the handle of a mod granted nothing, and refuses at call with NOT_PERMITTED`,
            (await refusalOf(call())) === 'call NOT_PERMITTED',
            member
        );
    check('a member refused for its permission asks nothing of main', !sent.length, sent);
    check(
        'a mod with deckit.app-keys alone is refused a chord in global, before its arguments',
        (await refusalOf(handle.keys.take(5, 5, { scope: 'global' }))) === 'call NOT_PERMITTED',
        ''
    );

    const all = await handleOf([
        'deckit.app-keys',
        'system.file-handlers',
        'system.clipboard-read',
        'system.clipboard-write',
        'system.notifications',
        'system.main-process',
        'system.network',
        'system.certificates',
        'system.site-permissions',
    ]);
    sent.length = 0;
    const mistyped = {
        'keys.take with a keystroke of no code': () => all.keys.take({ meta: true }, () => {}),
        'keys.take with a key of another type': () => all.keys.take({ code: 'KeyK', alt: 1 }, () => {}),
        'keys.take with no function to run': () => all.keys.take({ code: 'KeyK' }, 'run'),
        'keys.take with a scope of another type': () => all.keys.take({ code: 'KeyK' }, () => {}, { scope: 1 }),
        'reveal with a number': () => all.reveal(5),
        'clipboard.writeText with a number': () => all.clipboard.writeText(5),
        'clipboard.writeText with its text left out': () => all.clipboard.writeText(),
        'notifications.show with a title of another type': () => all.notifications.show({ title: 1 }),
        'mainProcess with a number': () => all.mainProcess(5),
        'web.session.trust with one entry': () => all.web.session('a').trust({ host: 'a', fingerprint: 'b' }),
        'web.downloads.cancel with a number': () => all.web.downloads.cancel(1),
        'web.downloads.remove with a number': () => all.web.downloads.remove(1),
        'web.downloads.reveal with a number': () => all.web.downloads.reveal(1),
        'web.downloads.open with a number': () => all.web.downloads.open(1),
    };
    for (const [what, call] of Object.entries(mistyped))
        check(
            `${what} is refused at call with INVALID_ARGUMENT`,
            (await refusalOf(call())) === 'call INVALID_ARGUMENT',
            what
        );
    check(
        'fileURL and filePath of another type throw the refusal INVALID_ARGUMENT',
        thrownOf(() => all.fileURL(5)) === 'call INVALID_ARGUMENT' &&
            thrownOf(() => all.filePath(5)) === 'call INVALID_ARGUMENT' &&
            all.fileURL('/a b') === 'file:///a%20b' &&
            all.filePath('file:///a%20b') === '/a b',
        ''
    );
    check('a request refused for its arguments asks nothing of main', !sent.length, sent);
    await all.clipboard.writeText('a');
    await all.notifications.show({ title: 'a' });
    check(
        'a request asked of main is asked with its arguments as given, and what is left out as nothing',
        JSON.stringify(sent.map(({ payload }) => payload)) ===
            '[{"text":"a"},{"id":"notification-1","title":"a","body":"","silent":false}]',
        sent
    );

    // The runner with deckit, a layer whose lifecycle throws as it starts, one over that, a layer whose read throws,
    // and one over that.
    const { createRun } = await import(url('deckit-shell', 'deckit', 'runner', 'run.js'));
    const { createRunner } = await import(url('deckit-shell', 'deckit', 'runner', 'renderer.js'));
    const { createMods } = await import(url('deckit-shell', 'deckit', 'mods', 'renderer.js'));
    console.warn = () => {};
    const order = [];
    let given = null;
    class Mod {
        start(deckit) {
            given = deckit;
            order.push('start');
        }

        attach() {
            order.push('attach');
            throw new Error('no screen');
        }

        detach() {
            order.push('detach');
        }
    }
    const stacked = (method, start, end) => ({
        method,
        registrations: {},
        start,
        end,
        join: () => {},
    });
    const attaching = ({ under }) => ({
        lifecycles: [
            under.lifecycle(
                stacked(
                    'attach',
                    async (instance) => instance.attach(),
                    async (instance) => instance.detach()
                )
            ),
        ],
        over: under,
    });
    const above = ({ under }) => ({
        lifecycles: [
            under.lifecycle(
                stacked(
                    'above',
                    async () => order.push('above'),
                    async () => {}
                )
            ),
        ],
    });
    const unread = () => ({
        read: () => {
            throw new Error('no reading');
        },
        lifecycles: [
            stacked(
                'unread',
                async () => order.push('unread'),
                async () => {}
            ),
        ],
    });
    const reading = () => ({ read: () => ({ reading: true }) });
    const RUN = createRun();
    const runner = createRunner({
        RUN,
        STORAGE: { values: () => ({}), records: () => ({}) },
        CONNECTION: { begin: async () => ({}), give: () => {}, leave: () => {}, awaited: () => ({}) },
        EVENT: { forScope: () => ({}) },
        MODS: createMods({ RUN }),
        modules: { evaluate: () => Mod },
    });
    sent.length = 0;
    const deckitLayer = createMod({
        WEB: { forMod: () => ({}) },
        NOTIFICATION: { listen: () => {}, notificationsOf: () => ({}) },
        KEYMAP: createKeymap(),
    }).layer;
    await runner.start({ layers: [deckitLayer, attaching, above, unread, reading] });
    const channels = sent.map(({ channel }) => channel.replace('deckit-shell:', ''));
    check(
        'a lifecycle over deckit that throws as it starts ends alone, and none over it starts',
        order.join() === 'start,attach,detach',
        order
    );
    check(
        'the run is told started once, after the lifecycle that threw has ended, and not as not started',
        channels.filter((channel) => channel === 'mod-started').length === 1 &&
            channels.indexOf('mod-started') > channels.lastIndexOf('mod-problem') &&
            !channels.includes('mod-not-started'),
        channels
    );
    const told = (channel) => sent.filter((one) => one.channel === `deckit-shell:${channel}`).map((one) => one.payload);
    check(
        'a layer whose read throws is left out of the run with the one over it, its problem recorded',
        JSON.stringify(told('mod-described')) === '[{"run":1,"summary":{},"lifecycles":3}]' &&
            told('mod-problem').some(({ problem }) => problem === 'no reading'),
        sent
    );

    check(
        'mods is on the handle of a mod granted nothing, and refuses at call with NOT_PERMITTED',
        typeof given?.mods?.list === 'function' && (await refusalOf(given.mods.list())) === 'call NOT_PERMITTED',
        Object.keys(given?.mods ?? {})
    );
    check(
        'the permission is refused before the arguments are read',
        (await refusalOf(given.mods.launch(5))) === 'call NOT_PERMITTED',
        ''
    );
    sent.length = 0;
    const quitting = given.quit();
    check(
        'quit() answers a promise fulfilled once the end is asked',
        quitting instanceof Promise &&
            (await quitting) === undefined &&
            sent.some(({ channel }) => channel === 'deckit-shell:mod-quit'),
        sent
    );
    check(
        'openExternal of a file is refused NOT_PERMITTED to a mod without system.file-handlers, before its arguments',
        (await refusalOf(given.openExternal('file:///a.txt', 5))) === 'call NOT_PERMITTED',
        ''
    );
    check(
        'openExternal is refused INVALID_ARGUMENT for an argument of another type',
        (await refusalOf(given.openExternal(5))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(given.openExternal('https://example.com', { activates: 'no' }))) ===
                'call INVALID_ARGUMENT',
        ''
    );

    const granted = createMods({ RUN: { mod: { id: 'g' }, granted: ['deckit.mods'] } }).tool(deckit.mods, makeScope());
    sent.length = 0;
    check(
        'a request with an argument of another type is refused INVALID_ARGUMENT, and none read as a string',
        (await refusalOf(granted.launch(5))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(granted.remove('x'))) === 'call INVALID_ARGUMENT' &&
            !sent.length,
        sent
    );
    check(
        'a request deckit adds to mods is refused INVALID_ARGUMENT for an argument of another type',
        (await refusalOf(granted.pick({ multiple: 'yes' }))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(granted.reveal(5))) === 'call INVALID_ARGUMENT' &&
            !sent.length,
        sent
    );
    await granted.launch('x', 'past the signature');
    check(
        'a request is asked of main with its arguments, none past the signature',
        JSON.stringify(sent.at(-1)) === '{"channel":"deckit-shell:mods-launch","payload":{"id":"x"}}',
        sent
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} layer checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} layer checks`);
    // A notification shown keeps a timer for its press.
    process.exit(0);
}

main().catch((error) => {
    console.error('[layers] ' + (error.stack || error.message));
    process.exit(1);
});
