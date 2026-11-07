// The urls mod (mods/urls/src) over a stand-in for deckit: its address patterns, the handlers it reads from what mods
// declare to deckit/urls, an address offered to them in turn on the exports they open for their id and then opened
// outside the app, and the mod a client chooses for a scheme, kept in its records. Exits 1 with a line for each check
// that failed.
const path = require('path');

const MOD = path.join(__dirname, '..', '..', 'deckit', 'mods', 'urls', 'src');
const PATTERN = require(path.join(MOD, 'pattern', 'pattern.js'));
const { router } = require(path.join(MOD, 'router', 'router.js'));

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (count = 5) => {
    for (let index = 0; index < count; index++) await tick();
};
const json = (value) => JSON.stringify(value);

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${json(seen)}`);
    };
    const rejection = async (promise) => {
        try {
            await promise;
            return null;
        } catch (error) {
            return { message: error.message, kind: error.kind };
        }
    };

    const warnings = [];
    console.warn = (line) => warnings.push(line);
    const errors = [];
    console.error = (...line) => errors.push(line.join(' '));

    // Patterns.
    const read = (written) => {
        const pattern = PATTERN.patternOf(written);
        return pattern && [pattern.scheme, pattern.host, pattern.path, pattern.specificity];
    };
    check('every', json(read('*')) === json(['*', null, null, 0]), read('*'));
    check('a scheme, in any case', json(read('HTTPS:*')) === json(['https', null, null, 1]), read('HTTPS:*'));
    check(
        'a host and a path',
        json(read('https://GitHub.com/deckit*')) === json(['https', 'github.com', '/deckit', 9]),
        read('https://GitHub.com/deckit*')
    );
    const none = [
        'https://github.com',
        'https://*',
        'https:/x*',
        'https://github.com*',
        'ht tp:*',
        'https://a/*x*',
        '',
    ];
    check(
        'no pattern',
        none.every((written) => PATTERN.patternOf(written) === null),
        none.map(read)
    );
    const takes = (written, address) => PATTERN.matches(PATTERN.patternOf(written), address);
    check('host in any case', takes('https://github.com/*', 'https://GitHub.com/deckit'));
    check('host is the host', !takes('https://github.com/*', 'https://example.com/github.com/'));
    check('a path starts so', takes('https://github.com/deckit/issues*', 'https://github.com/deckit/issues/1'));
    check('a path is the path', !takes('https://github.com/deckit/issues*', 'https://github.com/deckit?issues'));
    check('a bare host is its root', takes('https://github.com/*', 'https://github.com'));
    check('before a query too', takes('https://github.com/*', 'https://github.com?tab=1'));
    check('another scheme', !takes('https://github.com/*', 'http://github.com/'));
    check('every takes any scheme', takes('*', 'mailto:me@example.com') && !takes('*', 'no address'));
    check('scheme of', PATTERN.schemeOf('HTTPS://x') === 'https' && PATTERN.schemeOf(':x') === '');

    // What mods declare.
    const mod = (id) => ({ id, name: id[0].toUpperCase() + id.slice(1) });
    const of = (id, entries) => entries.map((entry) => ({ mod: mod(id), entry }));
    const contributions = [
        ...of('browser', [{ scheme: 'https' }, { scheme: 'http' }, { scheme: 'https' }]),
        ...of('github', [{ scheme: 'https', patterns: ['https://github.com/*'] }]),
        ...of('issues', [
            { scheme: 'HTTPS', patterns: ['https://github.com/deckit/issues*', 'https://github.com/x*'] },
        ]),
        ...of('mail', [{ scheme: 'mailto' }]),
        ...of('any', [{ scheme: '*' }, { scheme: 'board' }]),
        ...of('files', [{ scheme: 'file' }]),
        ...of('bad', [
            { scheme: 'javascript' },
            { scheme: '1x' },
            { scheme: 'https', patterns: ['http://x.com/*'] },
            { scheme: '*', patterns: ['*'] },
            { scheme: 'https', patterns: [] },
            'https',
            {},
        ]),
        ...of('a-pass', [{ scheme: 'chain' }]),
        ...of('b-throw', [{ scheme: 'chain' }]),
        ...of('c-plain', [{ scheme: 'chain' }]),
        ...of('d-take', [{ scheme: 'chain' }]),
        ...of('e-after', [{ scheme: 'chain' }]),
        ...of('silent', [{ scheme: 'late' }]),
        ...of('stuck', [{ scheme: 'late' }]),
        ...of('refusing', [{ scheme: 'late' }]),
    ];

    // The core: `reach(id)` resolves, and the connection stands as `stand(id)` says.
    const listeners = new Map(); // id -> [listener]
    const cleanups = new Map(); // id -> [cleanup]
    const asked = [];
    const exportsOf = new Map(); // id -> exports a running mod opens for its id
    const silent = new Set(['silent']); // ids whose connection never stands
    const stand = async (id) => {
        const cuts = [];
        for (const listener of listeners.get(id) ?? []) {
            const cut = await listener(exportsOf.get(id));
            if (typeof cut === 'function') cuts.push(cut);
        }
        cleanups.set(id, cuts);
    };
    const store = new Map();
    let refusingWrites = false;
    const records = {
        get: (key, fallback) => (store.has(key) ? JSON.parse(store.get(key)) : fallback),
        set: async (key, value) => {
            if (refusingWrites) throw new Error('the disk is full');
            store.set(key, JSON.stringify(value));
        },
    };
    const outside = []; // [address, options], each opened outside the app
    let outsideAnswers = true;
    const deckit = {
        dependencies: {
            onConnect: (id, listener) => {
                if (!listeners.has(id)) listeners.set(id, []);
                listeners.get(id).push(listener);
            },
            reach: async (id) => {
                asked.push(['reach', id]);
                if (id === 'refusing') throw Object.assign(new Error(`${id} is out of reach`), { kind: 'REFUSED' });
                if (!silent.has(id)) setTimeout(() => stand(id), 5);
            },
            release: async (id) => {
                asked.push(['release', id]);
                for (const cut of cleanups.get(id) ?? []) cut();
                cleanups.delete(id);
            },
        },
        exports: { contributions: async (name) => (name === 'deckit/urls' ? contributions : []) },
        storage: { records },
        urls: {
            open: async (address, options) => {
                outside.push([address, options]);
                return outsideAnswers;
            },
        },
    };

    // The mods: each answers whether it took an address as `taking` says.
    const offers = []; // [id, address, options]
    const taking = new Set();
    const handler = (id) => ({
        openURL: async (address, options) => {
            offers.push([id, address, options]);
            return taking.has(id);
        },
    });
    for (const id of ['browser', 'github', 'issues', 'mail', 'any', 'files', 'a-pass', 'd-take', 'e-after'])
        exportsOf.set(id, handler(id));
    taking.add('d-take');
    exportsOf.set('b-throw', {
        openURL: async () => {
            throw new Error('it broke');
        },
    });
    exportsOf.set('c-plain', {});
    exportsOf.set('stuck', { openURL: () => new Promise(() => {}) });

    const urls = router(deckit, { within: 60, answerWithin: 40 });
    const connection = (id, permissions) => ({ mod: mod(id), credential: { mod: id, permissions } });
    const settings = urls.exportsFor(connection('settings', ['deckit.system-services']));
    const plain = urls.exportsFor(connection('note', []));
    const opener = urls.exportsFor(connection('finder', ['system.file-handlers']));

    // The lists.
    const lists = await settings.list();
    const shown = (list) => list.map(({ scheme, mods }) => `${scheme}: ${mods.map(({ mod }) => mod.id).join(' ')}`);
    check(
        'lists',
        json(shown(lists)) ===
            json([
                'http: browser any',
                'https: issues github browser any',
                'file: files any',
                'mailto: mail any',
                'chain: a-pass b-throw c-plain d-take e-after any',
                'late: refusing silent stuck any',
                '*: any',
            ]),
        shown(lists)
    );
    check(
        'a list',
        json(lists[1]) ===
            json({
                scheme: 'https',
                system: 'browser',
                chosen: null,
                mods: [
                    { mod: mod('issues'), patterns: ['https://github.com/deckit/issues*', 'https://github.com/x*'] },
                    { mod: mod('github'), patterns: ['https://github.com/*'] },
                    { mod: mod('browser'), patterns: ['https:*'] },
                    { mod: mod('any'), patterns: ['*'] },
                ],
            }),
        lists[1]
    );
    check('no system', lists[3].system === null && lists[2].system === 'file', lists.slice(2, 4));
    check('warned', warnings.length === 9, warnings);
    await settings.list();
    check('warned once', warnings.length === 9, warnings);
    warnings.length = 0;

    // An address offered in turn, the narrowest first, then opened outside the app.
    const opened = async (client, address, options) => {
        offers.length = 0;
        outside.length = 0;
        const answer = await client.open(address, options);
        await ticks();
        return { answer, offered: offers.map(([id]) => id), outside: outside.map(([address]) => address) };
    };
    let seen = await opened(plain, ' https://github.com/deckit/issues/1 ');
    check(
        'offered in turn, then outside',
        json(seen) ===
            json({
                answer: true,
                offered: ['issues', 'github', 'browser', 'any'],
                outside: ['https://github.com/deckit/issues/1'],
            }),
        seen
    );
    check(
        'offered as asked',
        json(offers[0]) === json(['issues', 'https://github.com/deckit/issues/1', { activates: true }]),
        offers[0]
    );
    outsideAnswers = false;
    seen = await opened(plain, 'https://example.com', { activates: false });
    check(
        'what the hole answers',
        json(seen) === json({ answer: false, offered: ['browser', 'any'], outside: ['https://example.com'] }),
        seen
    );
    check(
        'left where it is',
        offers.every(([, , options]) => options.activates === false) && outside.length === 1,
        offers
    );
    outsideAnswers = true;
    taking.add('github');
    seen = await opened(plain, 'https://GitHub.com/deckit');
    check(
        'the first to take it ends it',
        json(seen) === json({ answer: true, offered: ['github'], outside: [] }),
        seen
    );
    taking.delete('github');
    seen = await opened(plain, 'mailto:me@example.com');
    check('no outside', json(seen) === json({ answer: false, offered: ['mail', 'any'], outside: [] }), seen);
    seen = await opened(plain, 'board:7');
    check('every scheme for one with no list', json(seen) === json({ answer: false, offered: ['any'], outside: [] }));
    for (const address of ['javascript:alert(1)', 'data:text/plain,a', 'no address', ''])
        check(
            `${address || 'nothing'} goes nowhere`,
            json(await opened(plain, address)) === json({ answer: false, offered: [], outside: [] })
        );

    // A file only for a client that may open files.
    seen = await opened(plain, 'file:///Users/me/a.txt');
    check('a file for a client that may not', json(seen) === json({ answer: false, offered: [], outside: [] }), seen);
    seen = await opened(opener, 'file:///Users/me/a.txt');
    check(
        'a file for a client that may',
        json(seen) === json({ answer: true, offered: ['files', 'any'], outside: ['file:///Users/me/a.txt'] }),
        seen
    );

    // Each reached by its id and let go; one that passes, throws or has no openURL passes it on.
    asked.length = 0;
    seen = await opened(plain, 'chain:1');
    check('passed on', json(seen) === json({ answer: true, offered: ['a-pass', 'd-take'], outside: [] }), seen);
    check(
        'reached and let go in turn',
        json(asked) ===
            json(
                ['a-pass', 'b-throw', 'c-plain', 'd-take'].flatMap((id) => [
                    ['reach', id],
                    ['release', id],
                ])
            ),
        asked
    );
    check(
        'what passed is logged',
        warnings.length === 2 && /B-throw.*it broke/.test(warnings[0]) && /C-plain.*no openURL/.test(warnings[1]),
        warnings
    );
    warnings.length = 0;
    asked.length = 0;
    seen = await opened(plain, 'late:1');
    check('passed on to the next', json(seen) === json({ answer: false, offered: ['any'], outside: [] }), seen);
    check(
        'refused, late, stuck',
        warnings.length === 3 &&
            /Refusing.*out of reach/.test(warnings[0]) &&
            /Silent.*in time/.test(warnings[1]) &&
            /Stuck.*answer within/.test(warnings[2]),
        warnings
    );
    check(
        'the late let go',
        json(asked.filter(([what]) => what === 'release').map(([, id]) => id)) === json(['silent', 'stuck', 'any']),
        asked
    );
    warnings.length = 0;

    // Choosing the mod for a scheme.
    check('list refused', (await rejection(plain.list()))?.kind === 'REFUSED');
    check('choose refused', (await rejection(plain.choose('https', 'browser')))?.kind === 'REFUSED');
    check('no such scheme', (await rejection(settings.choose('gopher', 'browser')))?.kind === 'SCHEME');
    check('no such mod there', (await rejection(settings.choose('https', 'mail')))?.kind === 'MOD');
    check('nothing kept', !store.has('chosen'));
    const https = await settings.choose('HTTPS', 'any');
    check('chosen', https.chosen === 'any' && https.mods[0].mod.id === 'any', https);
    check('kept', store.get('chosen') === json({ https: 'any' }), store.get('chosen'));
    taking.add('any');
    seen = await opened(plain, 'https://github.com/deckit/issues/1');
    check('the chosen first', json(seen) === json({ answer: true, offered: ['any'], outside: [] }), seen);
    taking.delete('any');
    await settings.choose('https', 'github');
    seen = await opened(plain, 'https://example.com');
    check('the chosen where it takes it', json(seen.offered) === json(['browser', 'any']), seen);
    seen = await opened(plain, 'https://github.com/deckit/issues/1');
    check('the chosen before a narrower', json(seen.offered) === json(['github', 'issues', 'browser', 'any']), seen);
    await settings.choose('*', 'any');
    check('every scheme chosen', (await settings.list()).find(({ scheme }) => scheme === '*').chosen === 'any');

    // What was chosen holds across a restart, and an entry of another shape is left out.
    store.set('chosen', json({ https: 'github', http: 7, mailto: 'gone' }));
    const restarted = router(deckit, { within: 60, answerWithin: 40 }).exportsFor(
        connection('settings', ['deckit.system-services'])
    );
    const again = await restarted.list();
    check('told again after a restart', warnings.length === 9, warnings);
    warnings.length = 0;
    const choices = again.map(({ scheme, chosen }) => `${scheme}:${chosen}`);
    check(
        'kept across a restart',
        json(choices) ===
            json(['http:null', 'https:github', 'file:null', 'mailto:null', 'chain:null', 'late:null', '*:null']),
        choices
    );
    const cleared = await restarted.choose('https', null);
    check('none', cleared.chosen === null && cleared.mods[0].mod.id === 'issues', cleared);
    check('a choice of a mod gone is kept', store.get('chosen') === json({ mailto: 'gone' }), store.get('chosen'));
    refusingWrites = true;
    check('a write refused', (await rejection(restarted.choose('https', 'browser')))?.message === 'the disk is full');
    check('not chosen', (await restarted.list())[1].chosen === null);
    refusingWrites = false;
    check('chosen after', (await restarted.choose('https', 'browser')).chosen === 'browser');

    check('nothing logged', errors.length === 0 && warnings.length === 0, { errors, warnings });

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
