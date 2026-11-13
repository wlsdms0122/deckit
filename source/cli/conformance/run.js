// One run of a case: its bundles laid out afresh in a folder of the run's own, the host app started and quit as its
// steps say, each call and look asked of it, and what each step came to held to what it expects (spec/DECKIT-1).
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const TOML = require('./toml.js');

// How long the app is given to settle after an input.
const SETTLE = 10000;
// The keys of a manifest the system reads itself (spec/DECKIT-2).
const MANIFEST = ['id', 'name', 'version', 'api', 'main', 'background', 'interfaces', 'permissions', 'contributes'];
// The manifest fields each base defines itself, by the base: the shell's are those it reads of a mod, and `styles`,
// the styles a mod granted deckit.styles declares (deckit-shell/shell/style).
const BASE_FIELDS = {
    system: [],
    web: [],
    shell: [...require('../../deckit/deckit-sdk/shell/mods/field.js').KEYS, 'styles'],
};
// The statuses an answer has no body with, and no length.
const BODILESS = new Set([204, 304]);
// The permission whose mods the host app runs main process modules for, with the framework that defines it.
const MAIN_PROCESS = 'system.main-process';

// Runs `theCase` in `folder`, made afresh, on the host app in `hostApp` that Electron at `electron` runs. Comes to
// `{ outcome }`: 'passed'; 'failed', with `step`, `came` and `expected` for its first step that did not match; or
// 'not laid out', with `why`, and nothing of it runs.
async function run(theCase, { folder, hostApp, electron }) {
    const { host, bundles, sites } = theCase;
    fs.rmSync(folder, { recursive: true, force: true });
    const home = path.join(folder, 'home');
    const sources = path.join(folder, 'sources');
    for (const made of [home, path.join(folder, 'electron'), path.join(folder, 'downloads')])
        fs.mkdirSync(made, { recursive: true });
    // Each bundle's path: in the folder read in place, shipped, or on its own where only a step's folders names it.
    const paths = Object.fromEntries([
        ...Object.keys(bundles).map((name) => [name, path.join(folder, 'apart', name)]),
        ...host.ship.map((name) => [name, path.join(folder, 'ship', name)]),
        ...host.sources.map((name) => [name, path.join(sources, name)]),
    ]);
    for (const [name, to] of Object.entries(paths)) {
        const why = layOut(bundles[name], to);
        if (why) return { outcome: 'not laid out', why: `${name}: ${why}` };
    }
    // The owner of each standard interface `owners` names, as the implementation ships it, marked system, then the
    // case's own; the host adds each field an owner's manifest writes that the system does not read and the case does
    // not write, before the case's, and runs main process modules where an owner asks for system.main-process.
    const owners = [];
    const read = [];
    let mainProcess = false;
    for (const name of host.owners) {
        const owner = ownerOf(name, path.join(hostApp, 'deckit', 'mods'));
        if (!owner) return { outcome: 'not laid out', why: `the implementation ships no owner of ${name}` };
        owners.push({ folder: owner.folder, system: true });
        if (Object.hasOwn(owner.manifest.permissions ?? {}, MAIN_PROCESS)) mainProcess = true;
        for (const field of Object.keys(owner.manifest))
            if (!MANIFEST.includes(field) && !BASE_FIELDS[host.base].includes(field) && !read.includes(field))
                read.push(field);
    }
    const fields = [...read.filter((field) => !host.fields.includes(field)), ...host.fields];
    const ship = [
        ...owners,
        ...host.ship.map((name) => ({ folder: path.join(folder, 'ship', name), system: host.system.includes(name) })),
    ];

    const server = net.createServer();
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    // The pages' storage is kept by the host app's id, outside the folder: one for each case's folder, so no case
    // reads what another stored.
    const id = 'deckit-conformance-' + crypto.createHash('sha256').update(folder).digest('hex').slice(0, 16);
    const setupFile = path.join(folder, 'setup.json');
    fs.writeFileSync(
        setupFile,
        JSON.stringify(
            {
                port: server.address().port,
                id,
                base: host.base,
                api: host.api,
                preload: 'preload.js',
                home,
                electron: path.join(folder, 'electron'),
                downloads: path.join(folder, 'downloads'),
                // The clipboard the host keeps, a file of the run's: none as the case begins, kept as the app quits.
                clipboard: path.join(folder, 'clipboard.txt'),
                // The app the machine has for each scheme, as the case names it: none for any other.
                apps: host.apps,
                // The folders the person chooses in each dialog of folders: the paths of the bundles the case names.
                chosen: host.chosen.map((name) => paths[name]),
                // The mods the host keeps in the Dock at the first start, as the case names them, or null.
                dock: host.dock,
                // The chords the machine gives the host app outside it: every one but those the case names.
                unavailable: host.unavailable,
                // The host app's look, light or dark, as the case names it: dark where it names none.
                appearance: host.appearance,
                // The height of the bar the host window lays over the desktop's top: none where the case names none.
                bar: host.bar,
                fields,
                mainProcess,
                permissions: host.permissions,
                ship,
                sources: host.sources.length ? [sources] : [],
            },
            null,
            4
        )
    );
    const log = fs.openSync(path.join(folder, 'host.log'), 'a');
    const app = createApp({ server, electron, hostApp, setupFile, log });
    const served = await serve(sites);
    const downloads = folderOf(path.join(folder, 'downloads'));
    const answers = new Map(); // a call's place -> what it came to, before what it holds is read as a case writes it
    try {
        for (const step of theCase.steps) {
            const taken = await take(step, app, paths, served, host.delegate, answers, downloads);
            if (step.what === 'call') answers.set(step.number, taken);
            const came = bundled(paths, downloads.named(served.named(taken)));
            if (!matches(step.expect, came))
                return { outcome: 'failed', step, came: describe(came), expected: describe(step.expect) };
        }
        return { outcome: 'passed' };
    } finally {
        await app.end();
        served.close();
        server.close();
        fs.closeSync(log);
    }
}

// Lays out the bundle at `from` as `to`, a folder, a file or a link, each file and folder as the case holds it and each
// link holding its target: why it is not laid out as written, or null. Each folder laid out lists the entries of the
// case's, each by the same Unicode scalar values, as a disk that folds case or normalization may not keep them.
function layOut(from, to) {
    try {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true });
    } catch (error) {
        return error.message;
    }
    const differs = (written, laid) => {
        if (!fs.lstatSync(written).isDirectory()) return null;
        const entries = fs.readdirSync(written, { withFileTypes: true });
        const names = entries.map(({ name }) => name).sort();
        const listed = fs.readdirSync(laid).sort();
        if (names.length !== listed.length || names.some((name, at) => name !== listed[at])) {
            const where = path.relative(from, written) || '.';
            return `${where} lists ${JSON.stringify(listed)}, and the case holds ${JSON.stringify(names)}`;
        }
        for (const entry of entries)
            if (entry.isDirectory()) {
                const why = differs(path.join(written, entry.name), path.join(laid, entry.name));
                if (why) return why;
            }
        return null;
    };
    return differs(from, to);
}

// The bundle in `mods`, the mods the implementation ships, that provides the interface `name`, `{ folder, manifest }`,
// or null.
function ownerOf(name, mods) {
    for (const entry of fs.existsSync(mods) ? fs.readdirSync(mods).sort() : []) {
        const file = path.join(mods, entry, 'manifest.toml');
        if (!fs.existsSync(file)) continue;
        const manifest = TOML.read(fs.readFileSync(file, 'utf8'));
        if (Object.hasOwn(manifest.interfaces?.provides ?? {}, name))
            return { folder: path.join(mods, entry), manifest };
    }
    return null;
}

// What a step comes to: `{ answers }`, `{ refuses, kind, message }`, `{ none }` with why there is no answer, or `{}`
// for an input answered with nothing. A call is handed the path of each bundle its folders name, the address of each
// site its sites name, what the call its `answered` names answered, each element of it where it is an array, then its
// args, then a listener where it writes one, names the handle its member is read from, `deckit` where it names none,
// and names its place so that a later call can reach what it answered.
async function take(step, app, paths, served, delegate, answers, downloads) {
    if (step.what === 'start') {
        served.requests.length = 0;
        return app.start();
    }
    if (step.what === 'quit') return app.quit();
    const { what, mod, part } = step;
    if (what === 'requested') return { answers: served.read(step.headers ?? []) };
    if (what === 'downloaded') return { answers: downloads.read() };
    if (what === 'call') {
        const given = step.answered ? answers.get(step.answered) : { answers: [] };
        if (!('answers' in given)) return { none: `step ${step.answered} answered nothing` };
        const args = [
            ...(step.folders ?? []).map((name) => paths[name]),
            ...(step.sites ?? []).map((address) => served.address(address)),
            ...(Array.isArray(given.answers) ? given.answers : [given.answers]),
            ...served.origins(step.args ?? [], step.origins ?? []),
        ];
        const { member, handle = 'deckit', of = null, listener = false, handed = false, delegated = null } = step;
        const asked = { input: what, mod, member, args, step: step.number, handle, of, listener, handed, delegated };
        return partOf(await app.ask(asked), part);
    }
    if (what === 'press') return app.ask({ input: what, notification: step.notification });
    if (what === 'activate') return app.ask({ input: what, mod, of: step.of });
    if (what === 'window') {
        const { name = null, action, edge = null, by = {} } = step;
        return app.ask({ input: what, mod, name, action, edge, by: { x: by.x ?? 0, y: by.y ?? 0 } });
    }
    if (what === 'key') return app.ask({ input: what, keystroke: step.keystroke, outside: !!step.outside });
    if (what === 'dock' && step.kind === 'input')
        return app.ask({ input: what, mod, action: step.action, to: step.to ?? null });
    if (what === 'show') {
        const url = step.site
            ? served.address(step.site)
            : step.file
              ? fileAddress(paths, step.file)
              : (step.url ?? '');
        const asked = { input: what, mod, step: step.number, session: step.session, url, apart: !!step.apart };
        return app.ask({ ...asked, delegate: delegate ?? {} });
    }
    if (what === 'appearance') return app.ask({ input: what, appearance: step.appearance });
    if (what === 'drop') {
        const { name, folders, at } = step;
        return app.ask({ input: what, mod, name, paths: folders.map((one) => paths[one]), at });
    }
    return partOf(await app.ask({ look: what, mod, properties: step.properties }), part);
}

// The folder the host app writes downloads in: `read()`, each file in it, `{ name, body }`, by its name's code points,
// `body` its bytes in base64, left out for none; and `named(came)`, what a step came to, each string in it that starts
// with the folder's path, or its file URL, then `/`, read as `downloads` or `file:downloads` and the rest.
function folderOf(folder) {
    const url = require('url').pathToFileURL(folder).href;
    const read = (value) => {
        if (typeof value === 'string') {
            if (value.startsWith(folder + '/')) return 'downloads' + value.slice(folder.length);
            if (value.startsWith(url + '/')) return 'file:downloads' + value.slice(url.length);
            return value;
        }
        if (Array.isArray(value)) return value.map(read);
        if (TOML.isTable(value)) return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, read(one)]));
        return value;
    };
    return {
        read: () =>
            fs
                .readdirSync(folder, { withFileTypes: true })
                .filter((entry) => entry.isFile())
                .map(({ name }) => name)
                .sort((a, b) => {
                    const [one, other] = [[...a], [...b]].map((chars) => chars.map((char) => char.codePointAt(0)));
                    const at = one.findIndex((point, index) => point !== other[index]);
                    return at === -1 ? one.length - other.length : (one[at] ?? -1) - (other[at] ?? -1);
                })
                .map((name) => {
                    const body = fs.readFileSync(path.join(folder, name));
                    return { name, ...(body.length ? { body: body.toString('base64') } : {}) };
                }),
        named: (came) => ('answers' in came ? { ...came, answers: read(came.answers) } : came),
    };
}

// What a step came to, each string in what it answers that is a bundle's path, or starts with it and then `/`, read
// with that path written as the bundle's name.
function bundled(paths, came) {
    const read = (value) => {
        if (typeof value === 'string') {
            const found = Object.entries(paths).find(([, at]) => value === at || value.startsWith(at + '/'));
            return found ? found[0] + value.slice(found[1].length) : value;
        }
        if (Array.isArray(value)) return value.map(read);
        if (TOML.isTable(value)) return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, read(one)]));
        return value;
    };
    return 'answers' in came ? { ...came, answers: read(came.answers) } : came;
}

// The file address of a file of a bundle, a bundle's name and a path in it, as the bundle is laid out.
function fileAddress(paths, written) {
    const [, name, at] = /^([^/]+)\/(.*)$/.exec(written);
    return require('url').pathToFileURL(path.join(paths[name], at)).href;
}

// Each site of the case served on the loopback address, at a port of its own chosen as the run begins: each path
// answered with what the site's file writes of it, its status (200 where it writes none and a file is at the path, 404
// where neither), its location and headers in order, then the length of its body and `connection: close`, and the body
// the file at the path holds, as it is. Keeps each request a site got, `{ site, method, path, headers, body }`. A site
// that refuses has a port of its own that nothing listens at, chosen as one is and let go, so a connection is refused.
async function serve(sites) {
    const requests = [];
    const servers = [];
    const ports = {};
    for (const [site, { refusing }] of Object.entries(sites)) {
        if (!refusing) continue;
        const held = net.createServer();
        await new Promise((resolve) => held.listen(0, '127.0.0.1', resolve));
        ports[site] = held.address().port;
        await new Promise((resolve) => held.close(resolve));
    }
    for (const [site, { folder, answers, refusing }] of Object.entries(sites)) {
        if (refusing) continue;
        const server = http.createServer((request, response) => {
            const chunks = [];
            request.on('data', (chunk) => chunks.push(chunk));
            request.on('end', () => {
                const body = Buffer.concat(chunks);
                const pairs = [];
                for (let at = 0; at < request.rawHeaders.length; at += 2)
                    pairs.push([request.rawHeaders[at].toLowerCase(), request.rawHeaders[at + 1]]);
                requests.push({
                    site,
                    method: request.method,
                    path: request.url,
                    headers: pairs,
                    ...(body.length ? { body: body.toString('base64') } : {}),
                });
                answer(request.url, folder, answers, response);
            });
        });
        server.keepAliveTimeout = 0;
        await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
        servers.push(server);
        ports[site] = server.address().port;
    }
    return {
        requests,
        // A site's address: the address of `site-name`, then the path the call writes after it, or `/`.
        address: (written) => {
            const [, site, at = '/'] = /^([^/]+)(\/.*)?$/.exec(written);
            return `http://127.0.0.1:${ports[site]}${at}`;
        },
        // `args`, each string in it, at any depth, that is a site's name of `names` the origin of that site.
        origins: (args, names) => {
            const put = (value) => {
                if (typeof value === 'string')
                    return names.includes(value) ? `http://127.0.0.1:${ports[value]}` : value;
                if (Array.isArray(value)) return value.map(put);
                if (TOML.isTable(value))
                    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, put(one)]));
                return value;
            };
            return args.map(put);
        },
        // What a step came to, each string in it that starts with a site's address, then `/` or nothing more, read as
        // the site's name and the rest, as a call writes a site's address.
        named: (came) => {
            const origins = Object.entries(ports).map(([site, port]) => [site, `http://127.0.0.1:${port}`]);
            const read = (value) => {
                if (typeof value === 'string') {
                    const found = origins.find(([, origin]) => value === origin || value.startsWith(origin + '/'));
                    return found ? found[0] + value.slice(found[1].length) : value;
                }
                if (Array.isArray(value)) return value.map(read);
                if (TOML.isTable(value))
                    return Object.fromEntries(Object.entries(value).map(([key, one]) => [key, read(one)]));
                return value;
            };
            return 'answers' in came ? { ...came, answers: read(came.answers) } : came;
        },
        // Each request since the app last started, its headers those of the names `names`, in that order.
        read: (names) =>
            requests.map((one) => ({
                ...one,
                headers: names.flatMap((name) => one.headers.filter(([held]) => held === name)),
            })),
        close: () => {
            for (const server of servers) {
                server.closeAllConnections();
                server.close();
            }
        },
    };
}

// What a site answers the request of `at`, its path and query.
function answer(at, folder, answers, response) {
    const written = Object.hasOwn(answers, at) ? answers[at] : null;
    const file = folder && fileAt(folder, at);
    const body = file ? fs.readFileSync(file) : Buffer.alloc(0);
    const status = written?.status ?? (file ? 200 : 404);
    response.sendDate = false;
    const headers = [
        ...(written?.location === undefined ? [] : [['location', written.location]]),
        ...(written?.headers ?? []),
        ...(BODILESS.has(status) ? [] : [['content-length', String(body.length)]]),
        ['connection', 'close'],
    ];
    response.writeHead(status, headers.flat());
    response.end(BODILESS.has(status) ? undefined : body);
}

// The file of `folder` at the path of `at`, its query left out and its segments decoded, or null.
function fileAt(folder, at) {
    let segments;
    try {
        segments = at.split('?')[0].split('/').slice(1).map(decodeURIComponent);
    } catch {
        return null;
    }
    if (segments.some((one) => one === '' || one === '.' || one === '..' || one.includes('/'))) return null;
    const file = path.join(folder, ...segments);
    return fs.statSync(file, { throwIfNoEntry: false })?.isFile() ? file : null;
}

// The value under the key `part` of an answer that is a table, or of each element that holds it of one that is an
// array of tables, in order; a key answered with null is not held.
function partOf(came, part) {
    if (part === undefined || !('answers' in came)) return came;
    const { answers } = came;
    const holds = (table) => TOML.isTable(table) && part in table && table[part] !== null;
    if (Array.isArray(answers) && answers.every(TOML.isTable))
        return { answers: answers.filter(holds).map((one) => one[part]) };
    return holds(answers) ? { answers: answers[part] } : { none: `the answer holds no ${part}` };
}

// The host app, started and quit as the steps say: each start a process of its own, on the run's folders.
function createApp({ server, electron, hostApp, setupFile, log }) {
    let child = null;
    let socket = null;
    let asked = 0;
    const waiting = new Map(); // what is asked of the app -> its resolve
    server.on('connection', (connected) => {
        socket = connected;
        let buffered = '';
        connected.on('data', (chunk) => {
            buffered += chunk;
            for (let end; (end = buffered.indexOf('\n')) >= 0;) {
                const message = JSON.parse(buffered.slice(0, end));
                buffered = buffered.slice(end + 1);
                const key = 'settled' in message ? 'settled' : message.id;
                waiting.get(key)?.('settled' in message ? message.settled : message.came);
                waiting.delete(key);
            }
        });
    });

    // Resolves to what the app answers under `key`, or to `{ none }` once it ends or has not settled in time.
    const answer = (key) =>
        new Promise((resolve) => {
            const running = child;
            const ended = (code, signal) => done({ none: `the host app ended (${signal || code})` });
            const timer = setTimeout(() => done({ none: `the app did not settle within ${SETTLE / 1000} s` }), SETTLE);
            function done(came) {
                clearTimeout(timer);
                running?.off('exit', ended);
                waiting.delete(key);
                resolve(came);
            }
            waiting.set(key, done);
            running?.once('exit', ended);
        });

    function start() {
        const env = { ...process.env, DECKIT_CONFORMANCE_SETUP: setupFile };
        delete env.ELECTRON_RUN_AS_NODE;
        // A run the runner ended leaves no window state for the next launch to restore.
        child = spawn(electron, [hostApp, '-ApplePersistenceIgnoreState', 'YES'], { env, stdio: ['ignore', log, log] });
        child.once('exit', () => {
            child = null;
            socket = null;
        });
        return answer('settled');
    }

    async function quit() {
        if (!child) return { none: 'the app is not running' };
        const exited = new Promise((resolve) => child.once('exit', resolve));
        socket?.write(JSON.stringify({ quit: true }) + '\n');
        const timer = new Promise((resolve) => setTimeout(() => resolve('late'), SETTLE));
        return (await Promise.race([exited, timer])) === 'late'
            ? { none: `the app did not quit within ${SETTLE / 1000} s` }
            : {};
    }

    function ask(look) {
        if (!socket) return Promise.resolve({ none: 'the app is not running' });
        const id = ++asked;
        const answered = answer(id);
        socket.write(JSON.stringify({ id, ...look }) + '\n');
        return answered;
    }

    // The app ended, as asked and then killed, once the case is done.
    async function end() {
        if (!child) return;
        const running = child;
        const exited = new Promise((resolve) => running.once('exit', resolve));
        running.kill('SIGTERM');
        const killed = setTimeout(() => running.kill('SIGKILL'), 3000);
        await exited;
        clearTimeout(killed);
    }

    return { start, quit, ask, end };
}

// Whether a step came to what it expects: an input that expects nothing is not refused and answers.
function matches(expect, came) {
    if (!expect) return !came.refuses && !came.none;
    if ('answers' in expect) return 'answers' in came && same(expect.answers, came.answers);
    return came.refuses === expect.refuses && came.kind === expect.kind;
}

// Values matched strictly; a key answered with null is a key not answered.
function same(expected, actual) {
    if (Array.isArray(expected))
        return (
            Array.isArray(actual) &&
            actual.length === expected.length &&
            expected.every((one, at) => same(one, actual[at]))
        );
    if (TOML.isTable(expected)) {
        if (!TOML.isTable(actual)) return false;
        const answered = Object.keys(actual).filter((key) => actual[key] !== null);
        const keys = Object.keys(expected);
        return (
            answered.length === keys.length &&
            keys.every((key) => answered.includes(key) && same(expected[key], actual[key]))
        );
    }
    return expected === actual;
}

function describe(came) {
    if (!came) return 'not to be refused';
    if ('answers' in came) return `answers ${JSON.stringify(came.answers)}`;
    if (came.refuses)
        return `a refusal at ${came.refuses}, ${came.kind ? `kind ${came.kind}` : 'with no kind'}${came.message ? ` ("${came.message}")` : ''}`;
    if (came.none) return `nothing: ${came.none}`;
    return 'nothing';
}

module.exports = { run };
