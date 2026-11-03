// The web pages a mod shows (deckit-shell/deckit/web) over a stand-in for the environment's web: what loads in them, which
// sessions attach and are kept, a mod's windows closing with its document, what a web page's window.open gets, what a
// site may have and the question put to the mod showing it, a site's notifications, and a mod's tabs held to the mod.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;
const tick = () => new Promise((resolve) => setImmediate(resolve));

async function main() {
    const { createWeb } = await import(url('deckit-shell', 'deckit', 'web', 'main.js'));
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

    const files = {
        id: 'files',
        permissions: [{ id: 'system.files' }, { id: 'system.site-permissions' }, { id: 'system.file-handlers' }],
    };
    const plain = { id: 'plain', permissions: [] };
    const filesPage = { name: 'files page' };
    const plainPage = { name: 'plain page' };
    const mods = new Map([
        [filesPage, files],
        [plainPage, plain],
    ]);
    const activated = new Set();
    const IDENTITY = {
        modOf: (page) => mods.get(page) || null,
        pageNameOf: () => null,
        modFrom: (page, permission = null) => {
            const mod = mods.get(page);
            if (permission && !mod.permissions.some(({ id }) => id === permission)) throw new Error('refused');
            return mod;
        },
        consumeUserActivation: (page) => activated.delete(page),
        watchPresses: () => {},
        pageOf: (modId) => [...mods].find(([, mod]) => mod.id === modId)?.[0] || null,
    };
    const KEYMAP = { listen: () => {} };
    // A download still under way as Deckit quit, kept from the run before.
    const state = {
        'web-downloads': {
            plain: [{ id: 'quit', url: 'https://a.com/q.zip', name: 'q.zip', path: '/D/q.zip', state: 'downloading' }],
        },
    };
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
        reveal: (file) => opened.push(['reveal', file]) > 0,
        file: async (file) => opened.push(['file', file]) > 0,
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
    await WEB.erase('files');
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
        ...fields,
    });
    check('without a press nothing opens', deck.windowOpen(filesPage, tab, asked({ inPage: false })) === '', '');
    activated.add(tab);
    check('a window page opens a window', deck.windowOpen(filesPage, tab, asked({ inPage: false })) === 'window', '');
    activated.add(tab);
    check(
        'a tab asking for a window with features gets one',
        deck.windowOpen(filesPage, tab, asked({ ownWindow: true })) === 'window',
        ''
    );
    activated.add(tab);
    check("a tab's window is handed to its mod's page", deck.windowOpen(filesPage, tab, asked({})) === 'page', '');
    deck.opened(filesPage, 7, 9, { url: 'https://a.com', activates: true });
    const handed = toldOn('deckit-shell:web-opening').at(-1)?.[1].payload;
    check(
        "a tab's window is told to the delegate as its page",
        handed?.id === 7 && handed.page === 9 && handed.url === 'https://a.com',
        handed
    );
    activated.add(tab);
    const fileOpens = deck.windowOpen(filesPage, tab, asked({ from: 'file:///a.html', inPage: false }));
    const fileOpening = toldOn('deckit-shell:web-opening').at(-1)?.[1].payload;
    check(
        "a file page's window is no window, its address opened",
        fileOpens === '' && fileOpening?.page === undefined && fileOpening?.url === 'https://a.com',
        fileOpening
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
    deck.downloaded(filesPage, downloading);
    deck.downloaded(filesPage, { ...downloading, received: 4 });
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
    heard.told(plainPage, { channel: 'deckit-shell:web-download-cancel', payload: { id } });
    heard.told(filesPage, { channel: 'deckit-shell:web-download-cancel', payload: { id } });
    await tick();
    const cancels = done.filter(([what]) => what === 'cancelDownload');
    check("a mod stops its own download, never another's", cancels.length === 1 && cancels[0][1] === 50, cancels);
    const openIt = async () =>
        (await heard.asked(filesPage, { channel: 'deckit-shell:web-download-open', payload: { id } })).value;
    check('one under way does not open', (await openIt()) === false, '');
    deck.downloaded(filesPage, { ...downloading, received: 10, state: 'finished' });
    check(
        'a finished download is kept as finished',
        state['web-downloads'].files[0].state === 'finished' && state['web-downloads'].files[0].received === 10,
        state['web-downloads']
    );
    check(
        'a finished one opens in its app',
        (await openIt()) === true && JSON.stringify(opened.at(-1)) === '["file","/D/a.zip"]',
        opened
    );
    const revealed = (await heard.asked(filesPage, { channel: 'deckit-shell:web-download-reveal', payload: { id } }))
        .value;
    check('a download is shown in Finder', revealed === true && opened.at(-1)[0] === 'reveal', opened);
    const openedBefore = opened.length;
    const plainOpen = await heard.asked(plainPage, {
        channel: 'deckit-shell:web-download-open',
        payload: { id: 'quit' },
    });
    const plainReveal = await heard.asked(plainPage, {
        channel: 'deckit-shell:web-download-reveal',
        payload: { id: 'quit' },
    });
    check(
        'a download opens and shows in Finder only for a mod with system.file-handlers',
        !plainOpen?.value && !plainReveal?.value && opened.length === openedBefore,
        [plainOpen, plainReveal, opened]
    );

    // One whose mod's page is gone as it ends is still the mod's.
    deck.downloaded(filesPage, { ...downloading, id: 60, path: '/D/c.zip', name: 'c.zip' });
    mods.delete(filesPage);
    deck.downloaded(filesPage, { ...downloading, id: 60, path: '/D/c.zip', name: 'c.zip', state: 'finished' });
    mods.set(filesPage, files);
    check(
        "a download ending after its mod's page is gone is kept as finished",
        state['web-downloads'].files[0].name === 'c.zip' && state['web-downloads'].files[0].state === 'finished',
        state['web-downloads'].files[0]
    );

    deck.downloaded(filesPage, { ...downloading, id: 51, path: '/D/b.zip', name: 'b.zip' });
    const forgotten = state['web-downloads'].files[0].id;
    const removed = (
        await heard.asked(filesPage, { channel: 'deckit-shell:web-download-remove', payload: { id: forgotten } })
    ).value;
    deck.downloaded(filesPage, { ...downloading, id: 51, path: '/D/b.zip', name: 'b.zip', state: 'cancelled' });
    check(
        'one forgotten under way is stopped, and not kept again as it ends',
        removed === true &&
            done.at(-1)[0] === 'cancelDownload' &&
            done.at(-1)[1] === 51 &&
            state['web-downloads'].files.length === 2,
        [done.at(-1), state['web-downloads']]
    );
    deck.downloaded(filesPage, { ...downloading, id: 70, path: '/D/d.zip', name: 'd.zip' });
    await WEB.erase('files');
    deck.downloaded(filesPage, { ...downloading, id: 70, path: '/D/d.zip', name: 'd.zip', state: 'cancelled' });
    check(
        "a mod's downloads go with its data, one under way stopped",
        !('files' in state['web-downloads']) && done.some(([what, under]) => what === 'cancelDownload' && under === 70),
        [state['web-downloads'], done]
    );

    // The last 100 records are kept, and an older one still under way stays until it ends.
    const record = (id, state) =>
        deck.downloaded(plainPage, { ...downloading, id, path: `/D/${id}.zip`, name: `${id}.zip`, state });
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
    const saved = deck.shouldDownload(filesPage, 7, file);
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
    const unsaved = deck.shouldDownload(filesPage, 7, file);
    answerSave(filesPage, false);
    check('a download the mod refuses is not saved', (await unsaved) === false, '');
    const orphaned = deck.shouldDownload(filesPage, 7, file);
    watching.get(tab).destroyed();
    check('a download whose tab goes before it is answered is not saved', (await orphaned) === false, '');
    check(
        'a download from a tab not there is not saved',
        (await deck.shouldDownload(filesPage, 99, file)) === false,
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
