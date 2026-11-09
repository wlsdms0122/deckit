// Deckit as a layer on the runner in a mod's page (deckit-shell/deckit/mod/renderer.js), with a layer over it stacking
// a lifecycle of its own on what deckit offers it: that lifecycle registers its own alone and is handed deckit's handle
// and the frameworks as they came, and the handle opens an address outside the app with openExternal. Every member a
// permission guards is on the handle of a mod granted nothing, and refuses at call with NOT_PERMITTED; for a mod
// granted it, an argument of another type or left out is refused with INVALID_ARGUMENT, none turned into its type, and
// fileURL and filePath throw that refusal. Then the web engine's layer (deckit-shell/web/attach/renderer.js), which
// stacks no lifecycle: the members of the handle `web` a permission guards refuse a mod granted nothing at call with
// NOT_PERMITTED, and an argument of another type is refused INVALID_ARGUMENT; a web page that leaves, with no delegate
// to keep it, opens its address with the `open` the layer over it hands; and what the handle adds is cut with its
// lifecycle's scope. Then the runner (deckit-shell/deckit/runner/renderer.js) with deckit and layers over it: each
// layer is offered what those under it offer, by name; deckit's start is handed a frozen table of the frameworks of the
// layers that run, each made with its lifecycle's scope; the run is told started once, after the lifecycle over
// deckit's has ended as its start threw, none over it started, and a layer whose read threw left out with the one over
// it, with its frameworks; and the handle of a mod granted nothing: `mods` on it, each request refused at call with
// NOT_PERMITTED before its arguments are read, `quit()` a promise, and `openExternal` refused NOT_PERMITTED for a file,
// then INVALID_ARGUMENT for an argument of another type; with deckit.mods, a request refused INVALID_ARGUMENT for an
// argument of another type and asked of main otherwise. Exits 1 with a line for each check that failed. The packages
// are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'renderer.js'));
    const { createMod } = await import(url('deckit-shell', 'deckit', 'mod', 'renderer.js'));
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
                    return { value: false };
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
        createMod({ NOTIFICATION: createNotification() }).layer({ mod: { id: 'a' }, granted, deliver: () => {} });

    const deckit = layerOf([]);
    check('deckit registers nothing of its own', Object.keys(deckit.lifecycles[0].registrations).length === 0, deckit);
    let handed = null;
    let handedFrameworks = null;
    const lifecycle = deckit.over.lifecycle({
        method: 'attach',
        registrations: { view: { handle: 'shell', check: () => '' } },
        start: async (_instance, handles, _scope, frameworks) => {
            handed = handles;
            handedFrameworks = frameworks;
        },
        end: async () => {},
        join: () => {},
    });
    check(
        'a lifecycle over deckit registers its own alone',
        Object.keys(lifecycle.registrations).join() === 'view',
        Object.keys(lifecycle.registrations)
    );

    const scope = makeScope();
    const frameworks = Object.freeze({ probe: {} });
    await lifecycle.start({}, { deckit: { exports: {} }, shell: {} }, scope, frameworks);
    const handle = handed?.deckit;
    check('a lifecycle over deckit is handed the frameworks as they came', handedFrameworks === frameworks, '');
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
        reveal: () => on.reveal('/a'),
        'clipboard.readText': () => on.clipboard.readText(),
        'clipboard.writeText': () => on.clipboard.writeText('a'),
        'notifications.show': () => on.notifications.show({ title: 'a' }),
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

    const all = await handleOf([
        'system.file-handlers',
        'system.clipboard-read',
        'system.clipboard-write',
        'system.notifications',
    ]);
    sent.length = 0;
    const mistyped = {
        'reveal with a number': () => all.reveal(5),
        'clipboard.writeText with a number': () => all.clipboard.writeText(5),
        'clipboard.writeText with its text left out': () => all.clipboard.writeText(),
        'notifications.show with a title of another type': () => all.notifications.show({ title: 1 }),
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

    // The web engine's layer, which has no lifecycle of its own: it hands every lifecycle the handle `web`, made with
    // that lifecycle's scope, and offers a layer over it what shows the pages of the mod's web sessions.
    const { layersOf } = await import(url('deckit-shell', 'web', 'attach', 'renderer.js'));
    let views = 0;
    const WEB_LAYERS = layersOf({
        web: { view: () => ({ element: {}, id: Promise.resolve(70 + ++views), close: () => {} }) },
    });
    const webLayerOf = (granted) =>
        WEB_LAYERS.web({ setup: { sessions: 'sessions' }, channels: IPC.layerChannels })({ mod: { id: 'a' }, granted });
    const webGuarded = (on) => ({
        'web.session.fetch': () => on.session('a').fetch('https://example.com'),
        'web.session.trust': () => on.session('a').trust([]),
        'web.session.allow': () => on.session('a').allow([]),
        'web.session.revoke': () => on.session('a').revoke([]),
        'web.downloads.reveal': () => on.downloads.reveal('1'),
        'web.downloads.open': () => on.downloads.open('1'),
    });
    sent.length = 0;
    for (const [member, call] of Object.entries(webGuarded(webLayerOf([]).frameworks.web(makeScope()))))
        check(
            `${member} is on the handle web of a mod granted nothing, and refuses at call with NOT_PERMITTED`,
            (await refusalOf(call())) === 'call NOT_PERMITTED',
            member
        );
    check('a member of web refused for its permission asks nothing of main', !sent.length, sent);
    const allWeb = webLayerOf([
        'system.file-handlers',
        'system.network',
        'system.certificates',
        'system.site-permissions',
    ]).frameworks.web(makeScope());
    const webMistyped = {
        'web.session.trust with one entry': () => allWeb.session('a').trust({ host: 'a', fingerprint: 'b' }),
        'web.downloads.cancel with a number': () => allWeb.downloads.cancel(1),
        'web.downloads.remove with a number': () => allWeb.downloads.remove(1),
        'web.downloads.reveal with a number': () => allWeb.downloads.reveal(1),
        'web.downloads.open with a number': () => allWeb.downloads.open(1),
    };
    for (const [what, call] of Object.entries(webMistyped))
        check(
            `${what} is refused at call with INVALID_ARGUMENT`,
            (await refusalOf(call())) === 'call INVALID_ARGUMENT',
            what
        );
    check('a request of web refused for its arguments asks nothing of main', !sent.length, sent);

    const webLayer = webLayerOf([]);
    check(
        "the web engine's layer stacks no lifecycle, and offers a layer over it surfaces",
        !webLayer.lifecycles && Object.isFrozen(webLayer.over) && typeof webLayer.over.surfaces === 'function',
        webLayer
    );
    const webScope = makeScope();
    const web = webLayer.frameworks.web(webScope);
    const downloads = [];
    web.downloads.onChange((download) => downloads.push(download.id));
    tell({ channel: 'deckit-shell:web-downloaded', payload: { id: 'd1' } });
    const failures = [];
    const externals = [];
    const surfaces = webLayer.over.surfaces({
        owner: { deliver: () => {}, recordFailure: (why) => failures.push(why) },
        open: async (to, options) => externals.push([to, options ?? null]),
        scope: webScope,
    });
    surfaces.page({ session: web.session('main'), url: 'file:///a.html' });
    await tick();
    tell({ channel: 'deckit-shell:web-leaving', payload: { id: 70 + views, url: 'https://example.com' } });
    await tick();
    check(
        'a web page that leaves, with no delegate to keep it, opens its address with what the layer over it hands',
        JSON.stringify(externals) === '[["https://example.com",null]]' && !failures.length,
        { externals, failures }
    );
    webScope.cut();
    tell({ channel: 'deckit-shell:web-downloaded', payload: { id: 'd2' } });
    check(
        "what the handle web adds is cut with its lifecycle's scope",
        JSON.stringify(downloads) === '["d1"]',
        downloads
    );

    // The runner with deckit, a layer whose lifecycle throws as it starts, one over that, a layer whose read throws,
    // and one over that.
    const { createRun } = await import(url('deckit-shell', 'deckit', 'runner', 'run.js'));
    const { createRunner } = await import(url('deckit-shell', 'deckit', 'runner', 'renderer.js'));
    const { createMods } = await import(url('deckit-shell', 'deckit', 'mods', 'renderer.js'));
    console.warn = () => {};
    const order = [];
    let given = null;
    let givenFrameworks = null;
    class Mod {
        start(deckit, frameworks) {
            given = deckit;
            givenFrameworks = frameworks;
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
    let offered = null;
    const attaching = ({ under }) => ({
        frameworks: { probe: (scope) => ({ scope }) },
        lifecycles: [
            under.deckit.lifecycle(
                stacked(
                    'attach',
                    async (instance) => instance.attach(),
                    async (instance) => instance.detach()
                )
            ),
        ],
        over: Object.freeze({ attaching: true }),
    });
    const above = ({ under }) => ({
        lifecycles: [
            (offered = under).deckit.lifecycle(
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
    const reading = () => ({ read: () => ({ reading: true }), frameworks: { lost: () => ({}) } });
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
        NOTIFICATION: { listen: () => {}, notificationsOf: () => ({}) },
    }).layer;
    await runner.start({
        layers: [
            ['deckit', deckitLayer],
            ['attaching', attaching],
            ['above', above],
            ['unread', unread],
            ['reading', reading],
        ],
    });
    const channels = sent.map(({ channel }) => channel.replace('deckit-shell:', ''));
    check(
        'a layer is offered what each layer under it offers, by its name',
        Object.isFrozen(offered) &&
            Object.keys(offered).join() === 'deckit,attaching' &&
            offered.attaching.attaching === true &&
            typeof offered.deckit.lifecycle === 'function',
        Object.keys(offered ?? {})
    );
    check(
        "deckit's start is handed a frozen table of the frameworks of the layers that run, made with its scope",
        Object.isFrozen(givenFrameworks) &&
            Object.keys(givenFrameworks).join() === 'probe' &&
            typeof givenFrameworks.probe.scope?.add === 'function',
        Object.keys(givenFrameworks ?? {})
    );
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
