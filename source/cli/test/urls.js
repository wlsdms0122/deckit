// The urls mod (mods/urls/src) over a stand-in for deckit: its address patterns, the handlers it reads from what mods
// declare to deckit/urls, an address offered to them in turn on the exports they open for their id and then opened
// outside the app, and what a client chooses to open a scheme, kept in its records. Exits 1 with a line for each check
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

    // The signals the router listens for, and one sent.
    const heard = new Map(); // name -> [listener]
    const signal = (name) => {
        for (const listener of heard.get(name) ?? []) listener();
    };

    // The core: `reach(id)` answers the exports a running mod opens for its id once its connection stands; `silent`
    // times out at launch and `refusing` is refused.
    const asked = [];
    const exportsOf = new Map(); // id -> exports a running mod opens for its id
    const refusal = (message, kind, stage) => Object.assign(new Error(message), { kind, stage });
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
            reach: async (id) => {
                asked.push(['reach', id]);
                await tick();
                if (id === 'refusing') throw refusal(`${id} is out of reach`, 'REFUSED', 'call');
                if (id === 'silent') throw refusal(`${id} did not start in time`, 'TIMED_OUT', 'launch');
                return exportsOf.get(id);
            },
            release: async (id) => {
                asked.push(['release', id]);
            },
        },
        exports: { contributions: async (name) => (name === 'deckit/urls' ? [...contributions] : []) },
        events: {
            on: (name, listener) => {
                if (!heard.has(name)) heard.set(name, []);
                heard.get(name).push(listener);
            },
        },
        storage: { records },
        openExternal: async (address, options) => {
            outside.push([address, options]);
            return outsideAnswers;
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

    const urls = router(deckit);
    const connection = (id, permissions) => ({ mod: mod(id), credential: { mod: id, permissions } });
    const settings = urls.exportsFor(connection('settings', ['deckit.system-services']));
    const plain = urls.exportsFor(connection('note', []));
    const opener = urls.exportsFor(connection('finder', ['system.file-handlers']));

    // The lists.
    const { schemes: lists, refused } = await settings.list();
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
    check(
        'refused as warned',
        refused.length === 9 &&
            refused.every(({ mod, problem }, index) => warnings[index] === `[urls] ${mod.id}: ${problem}`) &&
            json(refused[0]) ===
                json({
                    mod: mod('browser'),
                    entry: { scheme: 'https' },
                    problem: 'https is declared already, so a second entry is left out',
                }),
        refused
    );
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

    // One not reached passes it on and is not let go; one that never answers holds its address only.
    asked.length = 0;
    offers.length = 0;
    let held = false;
    plain.open('late:1').then(() => (held = true));
    await ticks(10);
    check(
        'refused, late',
        warnings.length === 2 && /Refusing.*out of reach/.test(warnings[0]) && /Silent.*in time/.test(warnings[1]),
        warnings
    );
    check(
        'the refused not let go',
        json(asked) ===
            json([
                ['reach', 'refusing'],
                ['reach', 'silent'],
                ['reach', 'stuck'],
            ]),
        asked
    );
    seen = await opened(plain, 'chain:1');
    check('another address meanwhile', !held && json(seen.offered) === json(['a-pass', 'd-take']), { held, seen });
    warnings.length = 0;

    // Choosing what opens a scheme.
    check('list refused', (await rejection(plain.list()))?.kind === 'REFUSED');
    check('choose refused', (await rejection(plain.choose('https', { mod: 'browser' })))?.kind === 'REFUSED');
    check('no such scheme', (await rejection(settings.choose('gopher', { mod: 'browser' })))?.kind === 'SCHEME');
    check('no such mod there', (await rejection(settings.choose('https', { mod: 'mail' })))?.kind === 'MOD');
    for (const choice of ['browser', 7, {}, { system: false }, { mod: 7 }, { mod: 'browser', system: true }, []])
        check(`${json(choice)} is no choice`, (await rejection(settings.choose('https', choice)))?.kind === 'CHOICE');
    check(
        'nothing outside for mailto',
        (await rejection(settings.choose('mailto', { system: true })))?.kind === 'SYSTEM'
    );
    check(
        'nothing outside for every scheme',
        (await rejection(settings.choose('*', { system: true })))?.kind === 'SYSTEM'
    );
    check('nothing kept', !store.has('chosen'));
    const https = await settings.choose('HTTPS', { mod: 'any' });
    check('chosen', json(https.chosen) === json({ mod: 'any' }) && https.mods[0].mod.id === 'any', https);
    check('kept', store.get('chosen') === json({ https: { mod: 'any' } }), store.get('chosen'));
    taking.add('any');
    seen = await opened(plain, 'https://github.com/deckit/issues/1');
    check('the chosen first', json(seen) === json({ answer: true, offered: ['any'], outside: [] }), seen);
    taking.delete('any');
    await settings.choose('https', { mod: 'github' });
    seen = await opened(plain, 'https://example.com');
    check('the chosen where it takes it', json(seen.offered) === json(['browser', 'any']), seen);
    seen = await opened(plain, 'https://github.com/deckit/issues/1');
    check('the chosen before a narrower', json(seen.offered) === json(['github', 'issues', 'browser', 'any']), seen);
    await settings.choose('*', { mod: 'any' });
    check(
        'every scheme chosen',
        (await settings.list()).schemes.find(({ scheme }) => scheme === '*').chosen?.mod === 'any'
    );

    // A scheme chosen outside the app: offered to no mod, opened outside at once.
    const system = await settings.choose('https', { system: true });
    check(
        'chosen outside',
        json(system.chosen) === json({ system: true }) && system.mods[0].mod.id === 'issues',
        system
    );
    check('kept outside', store.get('chosen') === json({ https: { system: true }, '*': { mod: 'any' } }));
    taking.add('github');
    seen = await opened(plain, 'https://github.com/deckit', { activates: false });
    check(
        'outside at once',
        json(seen) === json({ answer: true, offered: [], outside: ['https://github.com/deckit'] }),
        seen
    );
    check('outside as asked', json(outside[0]) === json(['https://github.com/deckit', { activates: false }]));
    taking.delete('github');
    seen = await opened(plain, 'http://example.com');
    check('only the scheme chosen', json(seen.offered) === json(['browser', 'any']), seen);
    await settings.choose('file', { system: true });
    seen = await opened(plain, 'file:///Users/me/a.txt');
    check('a file outside for a client that may not', json(seen) === json({ answer: false, offered: [], outside: [] }));
    seen = await opened(opener, 'file:///Users/me/a.txt');
    check(
        'a file outside for a client that may',
        json(seen) === json({ answer: true, offered: [], outside: ['file:///Users/me/a.txt'] }),
        seen
    );
    const unchosen = await settings.choose('file', null);
    check('outside no more', unchosen.chosen === null, unchosen);
    seen = await opened(opener, 'file:///Users/me/a.txt');
    check('a file to its mods again', json(seen.offered) === json(['files', 'any']), seen);

    // What was chosen holds across a restart, and an entry of another shape is left out.
    store.set(
        'chosen',
        json({
            https: { mod: 'github' },
            http: { system: true },
            file: 'files',
            mailto: { mod: 'gone' },
            chain: { mod: 'a-pass', system: true },
            late: 7,
        })
    );
    const restarted = router(deckit).exportsFor(connection('settings', ['deckit.system-services']));
    const again = (await restarted.list()).schemes;
    check('told again after a restart', warnings.length === 9, warnings);
    warnings.length = 0;
    const choices = again.map(({ scheme, chosen }) => `${scheme}:${json(chosen)}`);
    check(
        'kept across a restart',
        json(choices) ===
            json([
                'http:{"system":true}',
                'https:{"mod":"github"}',
                'file:null',
                'mailto:null',
                'chain:null',
                'late:null',
                '*:null',
            ]),
        choices
    );
    const cleared = await restarted.choose('https', null);
    check('none', cleared.chosen === null && cleared.mods[0].mod.id === 'issues', cleared);
    check(
        'a choice of a mod gone is kept',
        store.get('chosen') === json({ http: { system: true }, mailto: { mod: 'gone' } }),
        store.get('chosen')
    );
    refusingWrites = true;
    check(
        'a write refused',
        (await rejection(restarted.choose('https', { mod: 'browser' })))?.message === 'the disk is full'
    );
    check('not chosen', (await restarted.list()).schemes[1].chosen === null);
    refusingWrites = false;
    check('chosen after', (await restarted.choose('https', { mod: 'browser' })).chosen?.mod === 'browser');

    // What is declared is kept, and read again on the interface's signals.
    check(
        'signals heard',
        json([...heard.keys()]) === json(['deckit/urls:contributions-changed', 'deckit/urls:owner-changed']),
        [...heard.keys()]
    );
    const hasGopher = async () => (await restarted.list()).schemes.some(({ scheme }) => scheme === 'gopher');
    contributions.push(...of('mail', [{ scheme: 'gopher' }]));
    check('kept until a signal', !(await hasGopher()));
    signal('deckit/urls:contributions-changed');
    check('read again as declarations change', await hasGopher());
    contributions.pop();
    signal('deckit/urls:owner-changed');
    check('read again as the owner changes', !(await hasGopher()));
    warnings.length = 0;

    check('nothing logged', errors.length === 0 && warnings.length === 0, { errors, warnings });

    for (const line of failed) process.stdout.write(`${line}\n`);
    process.stdout.write(`${count - failed.length}/${count} passed\n`);
    process.exit(failed.length ? 1 : 0);
}

main();
