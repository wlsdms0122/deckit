// The web pages a mod shows (deckit-shell/web) over a stand-in for the environment's web: what loads in them, which
// sessions attach, what a web page's window.open gets, the question put to the mod showing a site, and a mod's tabs
// held to the mod. Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as
// such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createWeb } = await import(url('deckit-shell', 'web', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
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
    IPC.carry({ messages, pages: { isGone: () => false } }, { report: () => {} });
    const toldOn = (channel) => tells.filter(([, message]) => message.channel === channel);

    const files = { id: 'files', permissions: [{ id: 'system.files' }, { id: 'system.site-permissions' }] };
    const plain = { id: 'plain', permissions: [] };
    const filesPage = { name: 'files page' };
    const plainPage = { name: 'plain page' };
    const owners = new Map([
        [filesPage, files],
        [plainPage, plain],
    ]);
    const activated = new Set();
    const IDENTITY = {
        modOf: (page) => owners.get(page) || null,
        pageNameOf: () => null,
        modFrom: (page) => owners.get(page),
        consumeUserActivation: (page) => activated.delete(page),
        watchPresses: () => {},
    };
    const KEYMAP = { listen: () => {} };
    const state = {};
    const STORAGE = {
        state: { read: (key, fallback) => state[key] ?? fallback, write: (key, value) => (state[key] = value) },
    };
    // Web pages by id: 7 is a tab of files' page, 8 one of plain's.
    const tab = { id: 7, embedder: filesPage };
    const other = { id: 8, embedder: plainPage };
    const webPages = new Map([
        [7, tab],
        [8, other],
    ]);
    const gone = new Map(); // page -> listener
    const done = []; // what the environment was asked to do
    const allowed = new Set(); // origin|permission
    let deck = null;
    const web = {
        listen: (given) => (deck = given),
        pageOf: (id) => webPages.get(id) || null,
        holderOf: (page) => ({ embedder: page.embedder, id: page.id, tab: page.id, inPage: true }),
        granted: (_page, origin, permission) => allowed.has(origin + '|' + permission),
        whenGone: (page, listener) => {
            gone.set(page, listener);
            return () => gone.delete(page);
        },
        load: (page, address) => done.push(['load', page.id, address]),
        clear: (mod, session) => done.push(['clear', mod, session]),
        stateOf: () => null,
    };
    const opened = [];
    const open = {
        appFor: (address) => (address.startsWith('zoommtg:') ? 'zoom.us.app' : ''),
        url: (address) => opened.push(address),
    };
    const WEB = createWeb({ LOG: { info: () => {} }, IDENTITY, KEYMAP, STORAGE, web, open });
    WEB.start();

    // What loads, and where.
    check('the web loads anywhere', deck.mayShow(plainPage, 'https://example.com', { inPage: false }), '');
    check(
        'a file loads in the page of a mod with system.files',
        deck.mayShow(filesPage, 'file:///tmp/a.txt', { inPage: true }),
        ''
    );
    check('a file never loads in a window', !deck.mayShow(filesPage, 'file:///tmp/a.txt', { inPage: false }), '');
    check(
        'a file never loads without system.files',
        !deck.mayShow(plainPage, 'file:///tmp/a.txt', { inPage: true }),
        ''
    );
    check('no other scheme loads', !deck.mayShow(filesPage, 'deckit://plain.mod/', { inPage: true }), '');
    check('a file page asking for the web leaves it', deck.leavesFile('file:///tmp/a.html', 'https://a.com'), '');
    check('a web page following the web stays', !deck.leavesFile('https://a.com', 'https://b.com'), '');

    // Sessions.
    check('a mod attaches its own session', deck.attaching(filesPage, [{ mod: 'files', name: 'web' }]), '');
    check('the session it used is kept', JSON.stringify(state['web-sessions']) === '{"files":["web"]}', state);
    check("a mod never attaches another's session", !deck.attaching(plainPage, [{ mod: 'files', name: 'web' }]), '');
    check("a session that is no mod's never attaches", !deck.attaching(plainPage, [null]), '');
    check('a page naming no session attaches nothing', !deck.attaching(plainPage, []), '');
    await WEB.clearSessions('files');
    check(
        "a mod's sessions are cleared and forgotten",
        JSON.stringify(done.at(-1)) === '["clear","files","web"]' && !('files' in state['web-sessions']),
        [done.at(-1), state]
    );

    // A web page's window.open.
    const asked = (fields) => ({
        url: 'https://a.com',
        tab: 7,
        from: 'https://a.com',
        inPage: true,
        ownWindow: false,
        activates: true,
        target: '',
        ...fields,
    });
    check('without a press nothing opens', !deck.windowOpen(filesPage, tab, asked({ inPage: false })), '');
    activated.add(tab);
    check('a window page opens a window', deck.windowOpen(filesPage, tab, asked({ inPage: false })), '');
    activated.add(tab);
    check(
        'a tab asking for a window with features gets one',
        deck.windowOpen(filesPage, tab, asked({ ownWindow: true })),
        ''
    );
    activated.add(tab);
    const tabOpens = !deck.windowOpen(filesPage, tab, asked({}));
    const opening = toldOn('deckit-shell:web-opening').at(-1)?.[1].payload;
    check(
        "a tab's new tab is the delegate's",
        tabOpens && opening?.id === 7 && opening?.url === 'https://a.com',
        opening
    );
    activated.add(tab);
    check(
        'a file page never gets a window',
        !deck.windowOpen(filesPage, tab, asked({ from: 'file:///a.html', inPage: false })),
        ''
    );

    // The question put to the mod showing a site.
    activated.add(tab);
    deck.windowOpen(filesPage, tab, asked({ url: 'zoommtg://join' }));
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
    activated.add(tab);
    deck.windowOpen(filesPage, tab, asked({ url: 'javascript:alert(1)' }));
    await tick();
    check('a scheme that never leaves is never asked', toldOn('deckit-shell:web-asking').length === before, '');

    const first = deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera'] });
    const second = deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera'] });
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
        (await deck.request(plainPage, 8, { origin: 'https://a.com', permissions: ['camera'] })) === false,
        ''
    );
    allowed.add('https://a.com|microphone');
    check(
        'what was allowed is not asked again',
        (await deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['microphone'] })) === true,
        ''
    );
    const pending = deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['geolocation'] });
    gone.get(tab)();
    check('a question whose page goes is refused', (await pending) === false, '');

    // A mod's tabs are its own.
    heard.told(plainPage, { channel: 'deckit-shell:web-load', payload: { id: 7, url: 'https://b.com' } });
    heard.told(filesPage, { channel: 'deckit-shell:web-load', payload: { id: 7, url: 'https://c.com' } });
    await tick();
    const loads = done.filter(([what]) => what === 'load');
    check("a mod never loads another's tab", loads.length === 1 && loads[0][2] === 'https://c.com', loads);

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
