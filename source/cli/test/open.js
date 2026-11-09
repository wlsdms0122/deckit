// Opening outside the app (deckit-shell/deckit/open/main.js) over a stand-in for the system and the pages: an address
// of the web is handed the browser as the URL Standard serializes it, and a file its app, either brought forward unless
// asked not to; a file opens only for a mod with system.file-handlers, refused NOT_PERMITTED otherwise, and only one on
// this host whose path decodes; what is no URL, or a URL of any other scheme, is refused UNSUPPORTED_URL. Revealing a
// file takes system.file-handlers. What the host app opens for a mod (deckit/api/index.js: mods.openExternal) opens
// the same way, a file only for a mod whose run holds system.file-handlers.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const { createOpen } = await import(url('deckit-shell', 'deckit', 'open', 'main.js'));
    const { createApi } = await import(url('deckit-shell', 'deckit', 'api', 'index.js'));
    const IPC = await import(url('deckit-shell', 'deckit', 'ipc', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let heard = null;
    const messages = { listen: (listeners) => (heard = listeners), tell: () => {} };
    IPC.carry({ messages, pages: { isGone: () => false, watch: () => {} } }, { report: () => {} });

    // Mod c holds nothing; mod f holds system.file-handlers.
    const plain = { name: 'page c' };
    const files = { name: 'page f' };
    const mods = new Map([
        [plain, { id: 'c', granted: [] }],
        [files, { id: 'f', granted: ['system.file-handlers'] }],
    ]);
    const IDENTITY = {
        modOf: (page) => mods.get(page) || null,
        modFrom: (page, permission) => {
            const mod = mods.get(page);
            if (!mod) throw Object.assign(new Error('only a mod asks this'), { kind: 'REFUSED' });
            if (permission && !mod.granted.includes(permission))
                throw Object.assign(new Error(`${mod.id} does not have ${permission}`), { kind: 'NOT_PERMITTED' });
            return mod;
        },
    };
    const opened = []; // [what, address, options]
    const SYSTEM = {
        url: async (address, options) => opened.push(['url', address, options]),
        file: async (file, options) => opened.push(['file', file, options]) > 0,
        reveal: async (file) => opened.push(['reveal', file]) > 0,
    };
    const OPEN = createOpen({ IDENTITY, open: SYSTEM });
    OPEN.start();

    const ask = async (page, channel, payload) => {
        const answer = await heard.asked(page, { channel, payload });
        return answer.error ? { error: answer.error } : { value: answer.value };
    };
    const open = (page, address, activates = true) => ask(page, 'deckit-shell:open', { url: address, activates });

    const refusalOf = ({ error }) => error && `${error.stage} ${error.kind}`;
    const web = await open(plain, 'https://example.com');
    check(
        'the web is handed the browser as the URL Standard serializes it, brought forward, answering nothing',
        web.value === undefined &&
            !web.error &&
            opened[0]?.[0] === 'url' &&
            opened[0][1] === 'https://example.com/' &&
            opened[0][2].activate === true,
        { web, opened }
    );
    opened.length = 0;
    await open(plain, 'HTTP://example.com', false);
    check(
        'a scheme is read in any case, and the browser is left behind when asked',
        opened[0]?.[0] === 'url' && opened[0][1] === 'http://example.com/' && opened[0][2].activate === false,
        opened
    );
    opened.length = 0;
    const other = await open(plain, 'test-open:probe');
    check(
        'an address of another scheme is refused at call, UNSUPPORTED_URL',
        refusalOf(other) === 'call UNSUPPORTED_URL' && !opened.length,
        {
            other,
            opened,
        }
    );
    const nothing = await open(plain, 'no address');
    check(
        'what is no URL is refused at call, UNSUPPORTED_URL',
        refusalOf(nothing) === 'call UNSUPPORTED_URL' && !opened.length,
        {
            nothing,
            opened,
        }
    );

    const refused = await open(plain, 'file:///Users/me/a%20b.txt');
    check(
        'a file is refused at call, NOT_PERMITTED, for a mod without system.file-handlers',
        refusalOf(refused) === 'call NOT_PERMITTED' && !opened.length,
        { refused, opened }
    );
    const file = await open(files, 'file:///Users/me/a%20b.txt');
    check(
        'a file opens in its app for a mod with system.file-handlers, by its path, brought forward',
        !file.error &&
            opened[0]?.[0] === 'file' &&
            opened[0][1] === '/Users/me/a b.txt' &&
            opened[0][2].activate === true,
        { file, opened }
    );
    opened.length = 0;
    await open(files, 'file:///Users/me/a.txt', false);
    check(
        'a file is handed with activates as asked',
        opened[0]?.[0] === 'file' && opened[0][2].activate === false,
        opened
    );
    opened.length = 0;
    const remote = await open(files, 'file://elsewhere/a.txt');
    check(
        'a file on another host is refused, UNSUPPORTED_URL',
        refusalOf(remote) === 'call UNSUPPORTED_URL' && !opened.length,
        {
            remote,
            opened,
        }
    );
    await open(files, 'file://localhost/Users/me/a.txt');
    check(
        'a file whose host is localhost is a file, as the URL Standard reads it',
        opened[0]?.[0] === 'file' && opened[0][1] === '/Users/me/a.txt',
        opened
    );
    opened.length = 0;
    const undecoded = [await open(files, 'file:///Users/me/a%zz'), await open(files, 'file:///Users/me/a%ff')];
    check(
        'a file whose path does not decode is refused, UNSUPPORTED_URL',
        undecoded.every((answer) => refusalOf(answer) === 'call UNSUPPORTED_URL') && !opened.length,
        { undecoded, opened }
    );
    const undecodedPlain = await open(plain, 'file:///Users/me/a%zz');
    check(
        'a file whose path does not decode is refused for the permission first',
        refusalOf(undecodedPlain) === 'call NOT_PERMITTED',
        undecodedPlain
    );

    const hidden = await ask(plain, 'deckit-shell:open-reveal', { file: '/Users/me/a.txt' });
    check('revealing takes system.file-handlers', !!hidden.error && !opened.length, { hidden, opened });
    const shown = await ask(files, 'deckit-shell:open-reveal', { file: '/Users/me/a.txt' });
    check('a mod with system.file-handlers reveals a file', shown.value === true && opened[0]?.[0] === 'reveal', {
        shown,
        opened,
    });

    // The host app opens for a mod by its id, as the mod's run is granted.
    const runs = new Map([...mods.values()].map((mod) => [mod.id, { mod }]));
    const api = createApi({
        CONFIG: {},
        CORE: {},
        STORAGE: { stateIn: () => ({}) },
        LOG: {},
        IDENTITY: {},
        CATALOG: {},
        RUNNER: { runOf: (id) => runs.get(id) ?? null },
        MODS: {},
        OPEN,
        REQUEST: {},
        PERMISSION: {},
        MANIFEST_FIELD: {},
        KEYMAP: {},
        MAIN_PROCESS: {},
        SETUP: {},
    }).make({});
    const thrown = (opening) =>
        opening.then(
            () => '',
            (error) => `${error.stage} ${error.kind}`
        );
    opened.length = 0;
    const forPlain = await thrown(api.mods.openExternal('c', 'file:///Users/me/a.txt'));
    const forNone = await thrown(api.mods.openExternal('x', 'file:///Users/me/a.txt'));
    check(
        'the host app opens no file for a mod without system.file-handlers, or with no run, refused NOT_PERMITTED',
        forPlain === 'call NOT_PERMITTED' && forNone === 'call NOT_PERMITTED' && !opened.length,
        { forPlain, forNone, opened }
    );
    await api.mods.openExternal('f', 'file:///Users/me/a.txt', { activates: false });
    await api.mods.openExternal('c', 'https://example.com');
    check(
        'the host app opens a file for a mod with system.file-handlers, and the web for any, as asked to bring forward',
        JSON.stringify(opened) ===
            '[["file","/Users/me/a.txt",{"activate":false}],["url","https://example.com/",{"activate":true}]]',
        opened
    );
    const scheme = await thrown(api.mods.openExternal('f', 'deckit://finder.mod/'));
    check(
        'the host app opens no address of another scheme, refused UNSUPPORTED_URL',
        scheme === 'call UNSUPPORTED_URL',
        scheme
    );

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} open checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} open checks`);
}

main().catch((error) => {
    console.error('[open] ' + (error.stack || error.message));
    process.exit(1);
});
