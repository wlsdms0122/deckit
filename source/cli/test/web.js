// The web pages a mod shows (deckit-shell/web) over a stand-in for the environment's web: what loads in them, which
// sessions attach and are kept, a mod's windows closing with its document, what a web page's window.open gets, what a
// site may have and the question put to the mod showing it, a site's notifications, and a mod's tabs held to the mod.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createWeb } = await import(url('deckit-shell', 'web', 'main.js'));
    const IPC = await import(url('deckit-shell', 'deck', 'ipc', 'main.js'));
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
        // Kept as text, as the core keeps it: each read is a copy of its own.
        state: {
            read: (key, fallback) => (key in state ? JSON.parse(JSON.stringify(state[key])) : fallback),
            write: (key, value) => (state[key] = JSON.parse(JSON.stringify(value))),
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
    let deck = null;
    let clearing = () => {}; // what happens as a session is cleared
    const windowPage = { id: 9, embedder: filesPage };
    const web = {
        listen: (given) => (deck = given),
        embed: () => {},
        pageOf: (id) => webPages.get(id) || null,
        holderOf: (page) => ({ embedder: page.embedder, id: page.id, tab: page.id, inPage: true }),
        sessionOf: (page) => ({ mod: owners.get(page.embedder)?.id, name: 'main' }),
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
    };
    const pages = {
        isGone: () => false,
        watch: (page, watchers) => {
            watching.set(page, watchers);
            return () => watching.delete(page);
        },
    };
    const opened = [];
    const open = {
        appFor: (address) => (address.startsWith('zoommtg:') ? 'zoom.us' : ''),
        url: (address) => opened.push(address),
    };
    const WEB = createWeb({ LOG: { info: () => {} }, IDENTITY, KEYMAP, STORAGE, web, pages, open });
    WEB.start();
    check('deck hands the web all it declares', ENVIRONMENT.missingIn(deck, ENVIRONMENT.WEB_DECK).length === 0, '');

    // What loads, and where.
    const load = (page, to, options) => deck.loading(page, null, to, options);
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
    const leaves = deck.loading(filesPage, tab, 'https://a.com', { inPage: true, from: 'file:///tmp/a.html' });
    const leaving = toldOn('deckit-shell:web-leaving').at(-1)?.[1].payload;
    check(
        'a file page asking for the web leaves it, to whoever shows it',
        leaves === 'leave' && leaving?.id === 7 && leaving.url === 'https://a.com',
        [leaves, leaving]
    );
    check(
        'a web page following the web stays',
        deck.loading(filesPage, tab, 'https://b.com', { inPage: true, from: 'https://a.com' }) === 'load',
        ''
    );

    // Sessions.
    check('a mod attaches its own session', deck.attaching(filesPage, { mod: 'files', name: 'web' }), '');
    check('the session it used is kept', JSON.stringify(state['web-sessions']) === '{"files":["web"]}', state);
    check("a mod never attaches another's session", !deck.attaching(plainPage, { mod: 'files', name: 'web' }), '');
    check("a session that is no mod's never attaches", !deck.attaching(plainPage, null), '');
    clearing = () => deck.attaching(plainPage, { mod: 'plain', name: 'web' });
    await WEB.clearSessions('files');
    check(
        "a mod's sessions are cleared and forgotten, and another's used meanwhile kept",
        JSON.stringify(done.at(-1)) === '["clear","files","web"]' &&
            JSON.stringify(state['web-sessions']) === '{"plain":["web"]}',
        [done.at(-1), state]
    );

    // A window a mod asked for closes with the document that asked.
    WEB.prepare(filesPage);
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
    const allowSite = (origin, permission) =>
        heard.asked(filesPage, {
            channel: 'deckit-shell:web-allow',
            payload: { name: 'main', entries: [{ origin, permission }] },
        });
    await allowSite('https://a.com', 'microphone');
    check('what a mod lets a site have is told the environment', changes === 1, changes);
    check(
        'what was allowed is not asked again',
        (await deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['microphone'] })) === true,
        ''
    );
    const pending = deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['geolocation'] });
    watching.get(tab).destroyed();
    check('a question whose page goes is refused', (await pending) === false, '');

    // What a site's notification shows.
    const shown = () => toldOn('deckit-shell:web-notified').length;
    const notice = { origin: 'https://a.com', notification: 1, title: 'Hi', body: 'There', silent: false };
    deck.notified(filesPage, 7, notice);
    check('a site not allowed notifications shows none', shown() === 0, shown());
    await allowSite('https://a.com', 'notifications');
    deck.notified(filesPage, 7, { ...notice, title: 'x'.repeat(300) });
    const shownNotice = toldOn('deckit-shell:web-notified').at(-1)?.[1].payload;
    check(
        'a site allowed notifications shows them, cut to length',
        shown() === 1 && shownNotice.title.length === 200,
        shownNotice
    );

    // What a site may have, as the environment checks it.
    const session = { mod: 'files', name: 'main' };
    check(
        'a site is let have what it is never asked for',
        deck.permits(null, 'https://b.com', 'fullscreen') === true,
        ''
    );
    check('a site is refused what deck does not name', deck.permits(session, 'https://b.com', 'midi') === false, '');
    check(
        'a site has what it is asked for once the mod lets it, in that session alone',
        deck.permits(session, 'https://a.com', 'notifications') === true &&
            deck.permits({ mod: 'files', name: 'other' }, 'https://a.com', 'notifications') === false &&
            deck.permits(session, 'https://b.com', 'notifications') === false,
        ''
    );
    check(
        'the sites that may have it are listed',
        JSON.stringify(deck.permitted(session, 'notifications')) === '["https://a.com"]',
        deck.permitted(session, 'notifications')
    );
    check(
        'a request for nothing deck names, or for what is never let, is refused without asking',
        (await deck.request(filesPage, 7, { origin: 'https://a.com', permissions: [] })) === false &&
            (await deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['camera', 'midi'] })) === false,
        ''
    );
    check(
        'a request for what is let without asking is let',
        (await deck.request(plainPage, 8, { origin: 'https://a.com', permissions: ['fullscreen'] })) === true,
        ''
    );
    check(
        'what a site is only checked for is said yes to when checked and refused when asked for',
        deck.permits(session, 'https://a.com', 'local-network-access') === true &&
            (await deck.request(filesPage, 7, { origin: 'https://a.com', permissions: ['local-network-access'] })) ===
                false,
        ''
    );
    await heard.asked(filesPage, {
        channel: 'deckit-shell:web-revoke',
        payload: { name: 'main', entries: [{ origin: 'https://a.com', permission: 'notifications' }] },
    });
    check(
        'what a mod revokes a site no longer has',
        deck.permits(session, 'https://a.com', 'notifications') === false,
        ''
    );

    // A link the page follows goes where the web takes it; what is loaded into it is held to what it shows.
    check(
        'a link a web page follows loads',
        deck.loading(plainPage, other, 'zoommtg://x', { inPage: true, from: 'https://a.com', followed: true }) ===
            'load',
        ''
    );
    check(
        'an address loaded into a web page it may not show is refused',
        deck.loading(plainPage, other, 'zoommtg://x', { inPage: true, from: 'https://a.com' }) === 'refuse',
        ''
    );

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
