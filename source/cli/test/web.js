// The web engine in main (deckit-shell/web/engine) on a stand-in for what connect answers and for the environment's
// web: what loads in web pages, the mod's page a web page answers to, which sessions attach and are kept, a mod's
// windows closing with its document, what a mod's page opens by itself opened for the mod, what a web page's
// window.open gets, what a site may have and the question put to the mod showing it, the clipboard a site reaches only
// for a mod granted the clipboard permission, what a mod lets sites have and the
// certificates it trusts, each refused whole for an entry that does not fit, a fetch's refusals, a site's
// notifications, a mod's tabs held to the mod, its downloads told to its running run, and each web page told as it is
// adopted. Exits 1 with a line for each check that failed. The
// packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createWeb } = await import(url('deckit-shell', 'web', 'engine', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const ENVIRONMENT = await import(url('deckit-shell', 'environment', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    // The environment: what is told a mod's page is kept, and the test tells what a page tells main.
    const tells = []; // [page, message]
    let heard = null;
    const messages = {
        listen: (listeners) => (heard = listeners),
        tell: (page, message) => tells.push([page, message]),
    };
    // The router holds each channel to its guard by the mod a page runs, as `mods` below says.
    IPC.carry(
        { messages, pages: { isGone: () => false } },
        { report: () => {}, identify: (page) => mods.get(page) ?? null }
    );
    const toldOn = (channel) => tells.filter(([, message]) => message.channel === channel);

    const files = { id: 'files', granted: ['system.files', 'system.site-permissions', 'system.file-handlers'] };
    const plain = { id: 'plain', granted: [] };
    const filesPage = { name: 'files page' };
    const plainPage = { name: 'plain page' };
    const mods = new Map([
        [filesPage, files],
        [plainPage, plain],
    ]);
    // A download still under way as Deckit quit, kept from the run before.
    const state = {
        'web-downloads': {
            plain: [{ id: 'quit', url: 'https://a.com/q.zip', name: 'q.zip', path: '/D/q.zip', state: 'downloading' }],
        },
    };
    // Kept as text, as the core keeps it: each read is a copy of its own, and a write answers a turn later, once
    // kept.
    let unwritten = 0; // writes asked and not yet answered
    const STATE = {
        read: (key, fallback) => (key in state ? JSON.parse(JSON.stringify(state[key])) : fallback),
        write: (key, value) => {
            state[key] = JSON.parse(JSON.stringify(value));
            unwritten++;
            return tick().then(() => unwritten--);
        },
    };
    // Web pages by id: 7 is a tab of files' page, 8 one of plain's.
    const tab = { id: 7, embedder: filesPage };
    const other = { id: 8, embedder: plainPage };
    const webPages = new Map([
        [7, tab],
        [8, other],
    ]);
    const watching = new Map(); // page -> what watches it
    const done = []; // what the environment was asked to do
    let changes = 0; // how often what sites may have changed
    let listened = null;
    let clearing = () => {}; // what happens as a session is cleared
    const windowPage = { id: 9, embedder: filesPage };
    const web = {
        listen: (given) => (listened = given),
        embed: () => {},
        pageOf: (id) => webPages.get(id) || null,
        holderOf: (page) => ({ embedder: page.embedder, id: page.id, tab: page.id, inPage: true }),
        sessionOf: (page) => ({ mod: mods.get(page.embedder)?.id, name: 'main' }),
        permissionsChanged: () => changes++,
        openWindow: () => {
            webPages.set(9, windowPage);
            return 9;
        },
        close: (page) => done.push(['close', page.id]),
        load: (page, address) => done.push(['load', page.id, address]),
        clear: async (mod, session) => {
            done.push(['clear', mod, session]);
            await tick();
            clearing();
        },
        stateOf: () => null,
        cancelDownload: (id) => done.push(['cancelDownload', id]),
        fetch: async (mod, session, request) => {
            done.push(['fetch', mod, session, request.url]);
            if (fetchRefusal) throw fetchRefusal;
            return { url: request.url, status: 200, headers: [], body: '', redirected: false };
        },
        trust: (mod, session, entries) => {
            done.push(['trust', mod, session, entries]);
            trusted.add(mod);
        },
        trusts: (mod) => trusted.has(mod),
        distrust: (mod) => trusted.delete(mod),
    };
    const trusted = new Set(); // the mods that trust a certificate
    let fetchRefusal = null; // what the environment's fetch is refused with, while it is
    const inputs = new Map(); // page -> what hears the input to it
    const pages = {
        isGone: () => false,
        watch: (page, watchers) => {
            watching.set(page, watchers);
            return () => watching.delete(page);
        },
        watchInput: (page, listener) => inputs.set(page, listener),
    };
    // A key or mouse press in a web page, as the environment tells it.
    const press = (page, type = 'mousedown') => inputs.get(page)({ type });
    const opened = [];
    const open = {
        appFor: (address) => (address.startsWith('zoommtg:') ? 'zoom.us' : ''),
        url: (address) => opened.push(address),
    };
    let sandboxed = null; // what the web engine sets a mod's page up with
    const externals = []; // [mod id, address, options]: what was opened outside the app for a mod
    let refuseExternal = null; // why opening outside the app is refused, while it is
    const warned = [];
    // What connect answers, as the web engine reaches it: a run by mod id, its page the mod's page, after a run of
    // files that has ended, in a page of its own.
    const endedPage = { name: 'ended page' };
    const runs = () => [
        { run: { mod: { id: 'files' }, granted: files.granted, state: 'notRunning' }, page: endedPage },
        ...[...mods].map(([page, mod]) => ({
            run: { mod: { id: mod.id }, granted: mod.granted, state: 'running' },
            page,
        })),
    ];
    const deckit = {
        channels: IPC.layerChannels,
        log: { info: () => {}, warn: (...args) => warned.push(args) },
        mods: {
            modOf: (page) => mods.get(page)?.id ?? null,
            grantedOf: (id) => [...mods.values()].find((mod) => mod.id === id)?.granted ?? null,
            runs,
            openExternal: async (id, address, options) => {
                if (refuseExternal) throw refuseExternal;
                externals.push([id, address, options]);
            },
        },
        pages: { nameOf: () => null, onSandbox: (listener) => (sandboxed = listener) },
    };
    const WEB = createWeb({ deckit, state: STATE, web, pages, open });
    WEB.start();
    const eraser = WEB.keeps.erase; // what the web engine erases a mod removed with its data with
    check(
        'the web engine hands the web all it declares',
        ENVIRONMENT.missingIn(listened, ENVIRONMENT.WEB_DECK).length === 0,
        ''
    );
    const holderOf = web.holderOf;
    web.holderOf = (page) => ({ ...holderOf(page), inPage: false });
    check(
        "a web page answers to the mod's page showing it, in the page or in a window",
        WEB.pageFor(tab) === filesPage && WEB.pageFor(filesPage) === filesPage && WEB.pageFor({ id: 1 }) === null,
        ''
    );
    web.holderOf = holderOf;

    // What loads, and where.
    const load = (page, to, options) => listened.loading(page, null, to, options);
    check('the web loads anywhere', load(plainPage, 'https://example.com', { inPage: false }) === 'load', '');
    check(
        'a file loads in the page of a mod with system.files',
        load(filesPage, 'file:///tmp/a.txt', { inPage: true }) === 'load',
        ''
    );
    check('a file never loads in a window', load(filesPage, 'file:///tmp/a.txt', { inPage: false }) === 'refuse', '');
    check(
        'a file never loads without system.files',
        load(plainPage, 'file:///tmp/a.txt', { inPage: true }) === 'refuse',
        ''
    );
    check('no other scheme loads', load(filesPage, 'deckit://plain.mod/', { inPage: true }) === 'refuse', '');
    const leaves = listened.loading(filesPage, tab, 'https://a.com', { inPage: true, from: 'file:///tmp/a.html' });
    const leaving = toldOn('deckit-shell:web-leaving').at(-1)?.[1].payload;
    check(
        'a file page asking for the web leaves it, to whoever shows it',
        leaves === 'leave' && leaving?.id === 7 && leaving.url === 'https://a.com',
        [leaves, leaving]
    );
    check(
        'a web page following the web stays',
        listened.loading(filesPage, tab, 'https://b.com', { inPage: true, from: 'https://a.com' }) === 'load',
        ''
    );

    // Sessions.
    check('a mod attaches its own session', listened.attaching(filesPage, { mod: 'files', name: 'web' }), '');
    check('the session it used is kept', JSON.stringify(state['web-sessions']) === '{"files":["web"]}', state);
    check("a mod never attaches another's session", !listened.attaching(plainPage, { mod: 'files', name: 'web' }), '');
    check("a session that is no mod's never attaches", !listened.attaching(plainPage, null), '');
    check(
        'the web engine keeps something of a mod whose session it kept, and nothing of another',
        WEB.keeps.kept('files') && !WEB.keeps.kept('none'),
        state
    );
    const clearOf = (page, name) =>
        heard.asked(page, { channel: 'deckit-shell:web-clear', payload: { name } }).then((answer) => answer.value);
    const clearsBefore = done.length;
    await clearOf(plainPage, 'never');
    check(
        'a session never used is not recorded by a clear, and holds nothing to clear',
        JSON.stringify(state['web-sessions']) === '{"files":["web"]}' && done.length === clearsBefore,
        [state['web-sessions'], done.slice(clearsBefore)]
    );
    await clearOf(filesPage, 'web');
    check('a session used is cleared', JSON.stringify(done.at(-1)) === '["clear","files","web"]', done.at(-1));
    clearing = () => listened.attaching(plainPage, { mod: 'plain', name: 'web' });
    await eraser('files');
    check(
        "a mod's sessions are cleared and forgotten, and another's used meanwhile kept, once written",
        JSON.stringify(done.at(-1)) === '["clear","files","web"]' &&
            JSON.stringify(state['web-sessions']) === '{"plain":["web"]}' &&
            unwritten === 0,
        [done.at(-1), state, unwritten]
    );

    // A window a mod asked for closes with the document that asked.
    sandboxed(filesPage, 'files');
    heard.asked(filesPage, {
        channel: 'deckit-shell:web-window',
        payload: { name: 'web', url: 'https://a.com', title: '' },
    });
    await tick();
    watching.get(filesPage).ended();
    check(
        "a mod's window closes as its document ends",
        done.some(([what, id]) => what === 'close' && id === 9),
        done
    );

    // What a mod's page opens by itself, a window or an address its document leaves for, is opened outside the app for
    // the mod, as its own openExternal opens it, and what is refused is only logged.
    sandboxed(plainPage, 'plain');
    watching.get(plainPage).opens('https://example.org', { activates: false, target: 'x' });
    watching.get(plainPage).leaves('https://example.net');
    await tick();
    check(
        "what a mod's page opens by itself is opened outside the app for the mod, as asked to bring it forward",
        JSON.stringify(externals) ===
            '[["plain","https://example.org",{"activates":false}],["plain","https://example.net",{}]]',
        externals
    );
    refuseExternal = Object.assign(new Error('plain does not have system.file-handlers'), { kind: 'NOT_PERMITTED' });
    watching.get(plainPage).leaves('file:///Users/me/a.txt');
    await tick();
    refuseExternal = null;
    check(
        'what is refused opening is logged, and nothing more',
        externals.length === 2 && warned.length === 1 && String(warned[0][0]).includes('file:///Users/me/a.txt'),
        [externals, warned]
    );

    // A web page's window.open.
    const asked = (fields) => ({
        url: 'https://a.com',
        tab: 7,
        from: 'https://a.com',
        inPage: true,
        ownWindow: false,
        activates: true,
        ...fields,
    });
    const adoptedTold = []; // [page, whether its input was watched as it was told]
    WEB.onPage((page) => adoptedTold.push([page, inputs.has(page)]));
    listened.adopted(filesPage, tab);
    check(
        'a web page adopted is told to what listens, before its input is watched',
        adoptedTold.length === 1 && adoptedTold[0][0] === tab && adoptedTold[0][1] === false && inputs.has(tab),
        adoptedTold
    );
    check('without a press nothing opens', listened.windowOpen(filesPage, tab, asked({ inPage: false })) === '', '');
    press(tab, 'keyup');
    check('a key let go is no press', listened.windowOpen(filesPage, tab, asked({ inPage: false })) === '', '');
    press(tab);
    check(
        'a window page opens a window',
        listened.windowOpen(filesPage, tab, asked({ inPage: false })) === 'window',
        ''
    );
    check(
        'a press opens one window, used up by it',
        listened.windowOpen(filesPage, tab, asked({ inPage: false })) === '',
        ''
    );
    press(tab, 'keydown');
    check(
        'a tab asking for a window with features gets one',
        listened.windowOpen(filesPage, tab, asked({ ownWindow: true })) === 'window',
        ''
    );
    press(tab, 'keydown');
    check("a tab's window is handed to its mod's page", listened.windowOpen(filesPage, tab, asked({})) === 'page', '');
    listened.opened(filesPage, 7, 9, { url: 'https://a.com', activates: true });
    const handed = toldOn('deckit-shell:web-opening').at(-1)?.[1].payload;
    check(
        "a tab's window is told to the delegate as its page",
        handed?.id === 7 && handed.page === 9 && handed.url === 'https://a.com',
        handed
    );
    press(tab, 'keydown');
    const fileOpens = listened.windowOpen(filesPage, tab, asked({ from: 'file:///a.html', inPage: false }));
    const fileOpening = toldOn('deckit-shell:web-opening').at(-1)?.[1].payload;
    check(
        "a file page's window is no window, its address opened",
        fileOpens === '' && fileOpening?.page === undefined && fileOpening?.url === 'https://a.com',
        fileOpening
    );

    // The question put to the mod showing a site.
    press(tab, 'keydown');
    listened.windowOpen(filesPage, tab, asked({ url: 'zoommtg://join' }));
    await tick();
    const app = toldOn('deckit-shell:web-asking').at(-1)?.[1].payload;
    check(
        "an app's address is asked of the mod",
        app?.id === 7 &&
            app.origin === 'https://a.com' &&
            app.app === 'zoom.us' &&
            app.permissions[0] === 'open:zoommtg',
        app
    );
    heard.told(filesPage, { channel: 'deckit-shell:web-permit', payload: { ask: app.ask, allow: true } });
    await tick();
    check('an app allowed opens', opened.at(-1) === 'zoommtg://join', opened);
    const before = toldOn('deckit-shell:web-asking').length;
    press(tab, 'keydown');
    listened.windowOpen(filesPage, tab, asked({ url: 'javascript:alert(1)' }));
    await tick();
    check('a scheme that never leaves is never asked', toldOn('deckit-shell:web-asking').length === before, '');

    const first = listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera'] });
    const second = listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera'] });
    const questions = toldOn('deckit-shell:web-asking').slice(before);
    check('a page asking again joins the question up', questions.length === 1, questions.length);
    heard.told(plainPage, {
        channel: 'deckit-shell:web-permit',
        payload: { ask: questions[0][1].payload.ask, allow: true },
    });
    heard.told(filesPage, {
        channel: 'deckit-shell:web-permit',
        payload: { ask: questions[0][1].payload.ask, allow: true },
    });
    check('both are answered by the mod showing it', (await first) === true && (await second) === true, '');
    check(
        'a mod without system.site-permissions refuses',
        (await listened.request(plainPage, 8, { origin: 'https://a.com', permissions: ['camera'] })) === false,
        ''
    );
    const allowSite = (origin, permission) =>
        heard.asked(filesPage, {
            channel: 'deckit-shell:web-allow',
            payload: { name: 'main', entries: [{ origin, permission }] },
        });
    await allowSite('https://a.com', 'microphone');
    check('what a mod lets a site have is told the environment', changes === 1, changes);
    check(
        'what was allowed is not asked again',
        (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['microphone'] })) === true,
        ''
    );
    const pending = listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['geolocation'] });
    watching.get(tab).destroyed();
    check('a question whose page goes is refused', (await pending) === false, '');

    // What a site's notification shows.
    const shown = () => toldOn('deckit-shell:web-notified').length;
    const notice = { origin: 'https://a.com', notification: 1, title: 'Hi', body: 'There', silent: false };
    listened.notified(filesPage, 7, notice);
    check('a site not allowed notifications shows none', shown() === 0, shown());
    await allowSite('https://a.com', 'notifications');
    listened.notified(filesPage, 7, { ...notice, title: 'x'.repeat(300), body: '\u{1F600}'.repeat(300) });
    const shownNotice = toldOn('deckit-shell:web-notified').at(-1)?.[1].payload;
    check(
        'a site allowed notifications shows them, the title and the body whole',
        shown() === 1 &&
            shownNotice.title === 'x'.repeat(300) &&
            shownNotice.body === '\u{1F600}'.repeat(300) &&
            shownNotice.silent === false,
        shownNotice
    );
    for (const misfit of [{ title: 5 }, { body: null }, { silent: 'yes' }, { title: undefined }])
        listened.notified(filesPage, 7, { ...notice, ...misfit });
    check('a notification whose title or body is no string, or silent no boolean, is dropped', shown() === 1, shown());

    // What a site may have, as the environment checks it.
    const session = { mod: 'files', name: 'main' };
    check(
        'a site is let have what it is never asked for',
        listened.permits(null, 'https://b.com', 'fullscreen') === true,
        ''
    );
    check(
        'a site is refused what the web engine does not name',
        listened.permits(session, 'https://b.com', 'midi') === false,
        ''
    );
    check(
        'a site has what it is asked for once the mod lets it, in that session alone',
        listened.permits(session, 'https://a.com', 'notifications') === true &&
            listened.permits({ mod: 'files', name: 'other' }, 'https://a.com', 'notifications') === false &&
            listened.permits(session, 'https://b.com', 'notifications') === false,
        ''
    );
    check(
        'the sites that may have it are listed',
        JSON.stringify(listened.permitted(session, 'notifications')) === '["https://a.com"]',
        listened.permitted(session, 'notifications')
    );
    check(
        'a request for nothing the web engine names, or for what is never let, is refused without asking',
        (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: [] })) === false &&
            (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera', 'midi'] })) ===
                false,
        ''
    );
    check(
        'a request for what is let without asking is let',
        (await listened.request(plainPage, 8, { origin: 'https://a.com', permissions: ['fullscreen'] })) === true,
        ''
    );
    check(
        'what a site is only checked for is said yes to when checked and refused when asked for',
        listened.permits(session, 'https://a.com', 'local-network-access') === true &&
            (await listened.request(filesPage, 7, {
                origin: 'https://a.com',
                permissions: ['local-network-access'],
            })) === false,
        ''
    );

    // What a site reaches that the system guards with a permission of its own: the clipboard.
    const askedBefore = toldOn('deckit-shell:web-asking').length;
    check(
        'a site of a mod not granted the clipboard permissions is refused the clipboard, unasked',
        listened.permits(session, 'https://a.com', 'clipboard-write') === false &&
            listened.permits(null, 'https://a.com', 'clipboard-write') === false &&
            (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['clipboard-write'] })) ===
                false &&
            (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['clipboard-read'] })) ===
                false &&
            toldOn('deckit-shell:web-asking').length === askedBefore,
        ''
    );
    await allowSite('https://a.com', 'clipboard-read');
    check(
        'what a mod let a site have of the clipboard it reaches only while granted the clipboard permission',
        listened.permits(session, 'https://a.com', 'clipboard-read') === false &&
            listened.permitted(session, 'clipboard-read').length === 0,
        listened.permitted(session, 'clipboard-read')
    );
    mods.set(filesPage, { ...files, granted: [...files.granted, 'system.clipboard-read', 'system.clipboard-write'] });
    check(
        'a site of a mod granted system.clipboard-write writes what is copied, unasked',
        listened.permits(session, 'https://a.com', 'clipboard-write') === true &&
            (await listened.request(filesPage, 7, { origin: 'https://a.com', permissions: ['clipboard-write'] })) ===
                true,
        ''
    );
    check(
        'a site of a mod granted system.clipboard-read has what the mod let it have of it',
        listened.permits(session, 'https://a.com', 'clipboard-read') === true &&
            JSON.stringify(listened.permitted(session, 'clipboard-read')) === '["https://a.com"]',
        listened.permitted(session, 'clipboard-read')
    );
    const reading = listened.request(filesPage, 7, { origin: 'https://b.com', permissions: ['clipboard-read'] });
    await tick();
    const readQuestion = toldOn('deckit-shell:web-asking').at(-1)?.[1].payload;
    check(
        'a site of a mod granted system.clipboard-read is asked of the mod to read what is copied',
        toldOn('deckit-shell:web-asking').length === askedBefore + 1 &&
            JSON.stringify(readQuestion?.permissions) === '["clipboard-read"]',
        readQuestion
    );
    heard.told(filesPage, { channel: 'deckit-shell:web-permit', payload: { ask: readQuestion.ask, allow: true } });
    check('the mod answers it', (await reading) === true, '');
    mods.set(filesPage, files);
    await heard.asked(filesPage, {
        channel: 'deckit-shell:web-revoke',
        payload: { name: 'main', entries: [{ origin: 'https://a.com', permission: 'clipboard-read' }] },
    });
    await heard.asked(filesPage, {
        channel: 'deckit-shell:web-revoke',
        payload: { name: 'main', entries: [{ origin: 'https://a.com', permission: 'notifications' }] },
    });
    check(
        'what a mod revokes a site no longer has',
        listened.permits(session, 'https://a.com', 'notifications') === false,
        ''
    );
    const kindOf = (answer) => answer?.error?.kind ?? (answer && 'value' in answer ? 'answered' : null);
    const changesBefore = changes;
    const allowing = async (entries) =>
        kindOf(await heard.asked(filesPage, { channel: 'deckit-shell:web-allow', payload: { name: 'main', entries } }));
    const misfits = [
        [
            { origin: 'https://b.com', permission: 'camera' },
            { origin: 'https://b.com', permission: 'fullscreen' },
        ],
        [{ origin: 'https://b.com/page', permission: 'camera' }],
        [{ origin: 'https://b.com', permission: 'open:https' }],
        [{ origin: 'https://b.com', permission: 'open:' }],
        [{ origin: 'https://b.com' }],
        ['https://b.com'],
    ];
    const refusedAll = [];
    for (const entries of misfits) refusedAll.push(await allowing(entries));
    check(
        'an entry that does not fit refuses the whole allow INVALID_ARGUMENT, and nothing is let',
        refusedAll.every((kind) => kind === 'INVALID_ARGUMENT') &&
            changes === changesBefore &&
            listened.permits(session, 'https://b.com', 'camera') === false,
        refusedAll
    );
    const allowedApp = await allowing([{ origin: 'https://b.com', permission: 'open:zoommtg' }]);
    check(
        "a mod lets a site have the app of a scheme that is not the web's own, and allow answers nothing",
        allowedApp === 'answered' &&
            JSON.stringify(listened.permitted(session, 'open:zoommtg')) === '["https://b.com"]' &&
            (
                await heard.asked(filesPage, {
                    channel: 'deckit-shell:web-allow',
                    payload: { name: 'main', entries: [] },
                })
            ).value === undefined,
        allowedApp
    );
    check(
        'a session name that names no session is refused INVALID_ARGUMENT in main',
        (await allowing([])) === 'answered' &&
            kindOf(
                await heard.asked(filesPage, {
                    channel: 'deckit-shell:web-revoke',
                    payload: { name: 'A', entries: [] },
                })
            ) === 'INVALID_ARGUMENT',
        ''
    );

    // Certificates a mod trusts, each { host, fingerprint }.
    mods.set(filesPage, { ...files, granted: [...files.granted, 'system.certificates', 'system.network'] });
    const trusting = (entries) =>
        heard.asked(filesPage, { channel: 'deckit-shell:web-trust', payload: { name: 'main', entries } });
    const trustRefused = kindOf(await trusting([{ host: 'a.com', fingerprint: 'f' }, { host: 'b.com' }]));
    const trustedNone = !done.some(([what]) => what === 'trust');
    const trustAnswer = await trusting([{ host: 'a.com', fingerprint: 'f', more: 1 }]);
    check(
        'an entry that does not fit refuses the whole trust INVALID_ARGUMENT, and one that fits answers nothing',
        trustRefused === 'INVALID_ARGUMENT' &&
            trustedNone &&
            trustAnswer.value === undefined &&
            JSON.stringify(done.at(-1)) === '["trust","files","main",[{"host":"a.com","fingerprint":"f"}]]',
        [trustRefused, trustAnswer, done.at(-1)]
    );

    // A session's fetch, sent as the session sends it.
    const fetching = (url) =>
        heard.asked(filesPage, {
            channel: 'deckit-shell:web-fetch',
            payload: { name: 'main', url, method: 'GET', headers: [], redirect: 'follow' },
        });
    const notWeb = kindOf(await fetching('file:///etc/hosts'));
    const fetched = await fetching('https://a.com/');
    fetchRefusal = Object.assign(new Error('response too large'), { kind: 'QUOTA_EXCEEDED' });
    const tooLarge = kindOf(await fetching('https://a.com/large'));
    fetchRefusal = new Error('the network is down');
    const unanswered = await fetching('https://a.com/down');
    fetchRefusal = null;
    check(
        'a fetch of no web address is refused INVALID_ARGUMENT, one not answered with its kind, or REFUSED',
        notWeb === 'INVALID_ARGUMENT' &&
            fetched.value?.status === 200 &&
            tooLarge === 'QUOTA_EXCEEDED' &&
            unanswered.error?.kind === 'REFUSED' &&
            unanswered.error.stage === 'call',
        [notWeb, fetched, tooLarge, unanswered]
    );
    mods.set(filesPage, files);

    // A link the page follows goes where the web takes it; what is loaded into it is held to what it shows.
    check(
        'a link a web page follows loads',
        listened.loading(plainPage, other, 'zoommtg://x', { inPage: true, from: 'https://a.com', followed: true }) ===
            'load',
        ''
    );
    check(
        'an address loaded into a web page it may not show is refused',
        listened.loading(plainPage, other, 'zoommtg://x', { inPage: true, from: 'https://a.com' }) === 'refuse',
        ''
    );

    // A mod's tabs are its own.
    heard.told(plainPage, { channel: 'deckit-shell:web-load', payload: { id: 7, url: 'https://b.com' } });
    heard.told(filesPage, { channel: 'deckit-shell:web-load', payload: { id: 7, url: 'https://c.com' } });
    await tick();
    const loads = done.filter(([what]) => what === 'load');
    check("a mod never loads another's tab", loads.length === 1 && loads[0][2] === 'https://c.com', loads);

    // Downloads, kept for the mod showing the page that started each.
    check(
        'a download under way as Deckit quit failed',
        state['web-downloads'].plain[0].state === 'failed' && !!state['web-downloads'].plain[0].error,
        state['web-downloads']
    );
    const downloading = {
        id: 50,
        url: 'https://a.com/a.zip',
        name: 'a.zip',
        path: '/D/a.zip',
        state: 'downloading',
        received: 0,
        expected: 10,
        error: '',
    };
    listened.downloaded(filesPage, downloading);
    listened.downloaded(filesPage, { ...downloading, received: 4 });
    const toldDownloads = toldOn('deckit-shell:web-downloaded');
    const kept = state['web-downloads'].files;
    const id = kept?.[0]?.id;
    check(
        'a download is kept once, and its mod told of each change',
        kept?.length === 1 &&
            kept[0].state === 'downloading' &&
            toldDownloads.length === 2 &&
            toldDownloads.every(([page, message]) => page === filesPage && message.payload.id === id) &&
            toldDownloads[1][1].payload.received === 4,
        [kept, toldDownloads]
    );
    const listed = (await heard.asked(filesPage, { channel: 'deckit-shell:web-downloads', payload: {} })).value;
    const plainListed = (await heard.asked(plainPage, { channel: 'deckit-shell:web-downloads', payload: {} })).value;
    check(
        "a mod lists its own downloads, never another's",
        listed?.length === 1 && listed[0].id === id && plainListed?.length === 1 && plainListed[0].id === 'quit',
        [listed, plainListed]
    );
    const cancelled = [
        await heard.asked(plainPage, { channel: 'deckit-shell:web-download-cancel', payload: { id } }),
        await heard.asked(filesPage, { channel: 'deckit-shell:web-download-cancel', payload: { id } }),
    ];
    const cancels = done.filter(([what]) => what === 'cancelDownload');
    check(
        "a mod stops its own download, never another's, each answered nothing once main acted",
        cancels.length === 1 && cancels[0][1] === 50 && cancelled.every((answer) => answer.value === undefined),
        [cancels, cancelled]
    );
    const openIt = async () =>
        (await heard.asked(filesPage, { channel: 'deckit-shell:web-download-open', payload: { id } })).value;
    check('one under way does not open', (await openIt()) === false, '');
    listened.downloaded(filesPage, { ...downloading, received: 10, state: 'finished' });
    check(
        'a finished download is kept as finished',
        state['web-downloads'].files[0].state === 'finished' && state['web-downloads'].files[0].received === 10,
        state['web-downloads']
    );
    check(
        'a finished one opens through deckit, as the mod opens a file',
        (await openIt()) === true && JSON.stringify(externals.at(-1)?.slice(0, 2)) === '["files","file:///D/a.zip"]',
        externals
    );
    const openedBefore = opened.length;
    const externalsBefore = externals.length;
    const plainOpen = await heard.asked(plainPage, {
        channel: 'deckit-shell:web-download-open',
        payload: { id: 'quit' },
    });
    check(
        'a download opens only for a mod with system.file-handlers',
        !plainOpen?.value && opened.length === openedBefore && externals.length === externalsBefore,
        [plainOpen, opened, externals]
    );

    // One whose mod's page is gone as it ends is still the mod's.
    listened.downloaded(filesPage, { ...downloading, id: 60, path: '/D/c.zip', name: 'c.zip' });
    mods.delete(filesPage);
    listened.downloaded(filesPage, { ...downloading, id: 60, path: '/D/c.zip', name: 'c.zip', state: 'finished' });
    mods.set(filesPage, files);
    check(
        "a download ending after its mod's page is gone is kept as finished",
        state['web-downloads'].files[0].name === 'c.zip' && state['web-downloads'].files[0].state === 'finished',
        state['web-downloads'].files[0]
    );

    listened.downloaded(filesPage, { ...downloading, id: 51, path: '/D/b.zip', name: 'b.zip' });
    const forgotten = state['web-downloads'].files[0].id;
    const removed = (
        await heard.asked(filesPage, { channel: 'deckit-shell:web-download-remove', payload: { id: forgotten } })
    ).value;
    const removedWritten = unwritten === 0;
    listened.downloaded(filesPage, { ...downloading, id: 51, path: '/D/b.zip', name: 'b.zip', state: 'cancelled' });
    check(
        'one forgotten under way is stopped, and not kept again as it ends',
        removed === true &&
            removedWritten &&
            done.at(-1)[0] === 'cancelDownload' &&
            done.at(-1)[1] === 51 &&
            state['web-downloads'].files.length === 2,
        [done.at(-1), state['web-downloads']]
    );
    listened.downloaded(filesPage, { ...downloading, id: 70, path: '/D/d.zip', name: 'd.zip' });
    await eraser('files');
    listened.downloaded(filesPage, { ...downloading, id: 70, path: '/D/d.zip', name: 'd.zip', state: 'cancelled' });
    check(
        "a mod's downloads go with its data, one under way stopped",
        !('files' in state['web-downloads']) && done.some(([what, under]) => what === 'cancelDownload' && under === 70),
        [state['web-downloads'], done]
    );
    check(
        'what a mod let sites have and the certificates it trusted go with its data',
        !WEB.keeps.kept('files') &&
            !listened.permits(session, 'https://b.com', 'open:zoommtg') &&
            !trusted.has('files'),
        [state, [...trusted]]
    );
    const changesBeforeErase = changes;
    await allowSite('https://a.com', 'camera');
    const keptAllowed = WEB.keeps.kept('files');
    await eraser('files');
    check(
        'what a mod let a site have alone is kept of it, and erased, the environment told',
        keptAllowed &&
            !WEB.keeps.kept('files') &&
            !listened.permits(session, 'https://a.com', 'camera') &&
            changes === changesBeforeErase + 2,
        [keptAllowed, changes - changesBeforeErase]
    );
    mods.set(filesPage, { ...files, granted: [...files.granted, 'system.certificates'] });
    await trusting([{ host: 'a.com', fingerprint: 'f' }]);
    mods.set(filesPage, files);
    const keptTrusted = WEB.keeps.kept('files');
    await eraser('files');
    check(
        'a certificate a mod trusted alone is kept of it, and erased',
        keptTrusted && !WEB.keeps.kept('files') && !trusted.has('files'),
        keptTrusted
    );

    // The last 100 records are kept, and an older one still under way stays until it ends.
    const record = (id, state) =>
        listened.downloaded(plainPage, { ...downloading, id, path: `/D/${id}.zip`, name: `${id}.zip`, state });
    record(200, 'downloading');
    for (let id = 201; id <= 300; id++) {
        record(id, 'downloading');
        record(id, 'finished');
    }
    const longKept = state['web-downloads'].plain;
    record(200, 'finished');
    record(301, 'downloading');
    const trimmed = state['web-downloads'].plain;
    check(
        'a download under way past the last 100 is kept, not stopped, and goes once it ended',
        longKept.length === 101 &&
            longKept.at(-1).name === '200.zip' &&
            !done.some(([what, under]) => what === 'cancelDownload' && under === 200) &&
            trimmed.length === 100 &&
            !trimmed.some(({ name }) => name === '200.zip'),
        [longKept.length, longKept.at(-1)?.name, trimmed.length]
    );

    // A download is saved as the mod's page showing its tab answers.
    const file = { url: 'https://a.com/e.zip', name: 'e.zip', mimeType: 'application/zip', expected: 3 };
    const answerSave = (page, save) =>
        heard.told(page, {
            channel: 'deckit-shell:web-save',
            payload: { ask: toldOn('deckit-shell:web-saving').at(-1)[1].payload.ask, save },
        });
    const saved = listened.shouldDownload(filesPage, 7, file);
    answerSave(plainPage, false);
    answerSave(filesPage, true);
    const saving = toldOn('deckit-shell:web-saving');
    check(
        "the mod's page showing a download is asked whether it is saved, and only its answer counts",
        saving.length === 1 &&
            saving[0][0] === filesPage &&
            saving[0][1].payload.id === 7 &&
            saving[0][1].payload.name === 'e.zip' &&
            (await saved) === true,
        saving
    );
    const unsaved = listened.shouldDownload(filesPage, 7, file);
    answerSave(filesPage, false);
    check('a download the mod refuses is not saved', (await unsaved) === false, '');
    const orphaned = listened.shouldDownload(filesPage, 7, file);
    watching.get(tab).destroyed();
    check('a download whose tab goes before it is answered is not saved', (await orphaned) === false, '');
    check(
        'a download from a tab not there is not saved',
        (await listened.shouldDownload(filesPage, 99, file)) === false,
        ''
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} web checks`);
}

// A question left unanswered keeps nothing running, so the checks would end without a word.
let finished = false;
process.on('exit', (code) => {
    if (finished || code) return;
    console.error('FAIL the web checks did not finish: something asked was never answered');
    process.exitCode = 1;
});

main().then(
    () => (finished = true),
    (error) => {
        console.error(error);
        process.exit(1);
    }
);
