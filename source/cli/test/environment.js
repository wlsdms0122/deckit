// What an environment gives deckit (deckit-shell/environment): how a given object is held to it, that connect refuses an
// environment that lacks a member, and what connect answers the UI and the host app. Exits 1 with a line for each check
// that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

// What the UI on deckit uses of what connect answers.
const USED = {
    config: { name: 'string' },
    onStart: 'function',
    attach: 'function',
    core: { onDown: 'function' },
    restart: 'function',
    channels: { bind: 'function' },
    permissions: { define: 'function' },
    mods: {
        notifications: 'array',
        list: 'function',
        onChange: 'function',
        arrange: 'function',
        runs: 'function',
        runOf: 'function',
        listingOf: 'function',
        observe: 'function',
        modOf: 'function',
        managerFrom: 'function',
    },
    pages: {
        open: 'function',
        close: 'function',
        focus: 'function',
        isAlive: 'function',
        whenFocused: 'function',
        whenEnds: 'function',
        nameOf: 'function',
        stage: 'function',
    },
    keymap: { register: 'function', chordOf: 'function', listen: 'function', delegate: 'function' },
    commands: { define: 'function' },
    state: { read: 'function', write: 'function' },
    web: { pageFor: 'function', holdsKeyboard: 'function' },
    log: { warn: 'function' },
};

async function main() {
    const ENVIRONMENT = await import(url('deckit-shell', 'environment', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const thrown = (work) => {
        try {
            work();
            return '';
        } catch (error) {
            return error.message;
        }
    };

    const table = { name: 'string', list: 'array', open: 'function', inner: { read: 'function' } };
    const whole = { name: 'x', list: [], open() {}, inner: { read() {}, write() {} }, extra: 1 };
    check(
        'what has every member misses none',
        ENVIRONMENT.missingIn(whole, table).length === 0,
        ENVIRONMENT.missingIn(whole, table)
    );
    const missing = ENVIRONMENT.missingIn({ name: 1, list: {}, inner: {} }, table);
    check(
        'a member absent, or of the wrong kind, is missing, by its path',
        JSON.stringify(missing) === '["name","list","open","inner.read"]',
        missing
    );
    const carried = Object.assign(() => {}, { read() {} });
    check(
        'a function carrying the members meets a nested table',
        !ENVIRONMENT.missingIn({ ...whole, inner: carried }, table).length,
        ''
    );
    const copy = ENVIRONMENT.checked(whole, table, 'a test');
    check(
        'what is checked holds only what is declared, frozen',
        copy.extra === undefined &&
            copy.inner.write === undefined &&
            Object.isFrozen(copy.inner) &&
            copy.open === whole.open,
        Object.keys(copy)
    );
    const refused = thrown(() => ENVIRONMENT.checked({ name: 'x' }, table, 'a test'));
    check('what lacks a member is refused, naming it', /a test lacks list, open, inner/.test(refused), refused);

    // An environment of stand-ins, made from what an environment gives: each function does nothing, but the app is
    // never ready, so nothing starts.
    const configured = [];
    const standIn = (given, at = '') =>
        Object.fromEntries(
            Object.entries(given).map(([name, kind]) => {
                const path = at + name;
                if (typeof kind === 'object') return [name, standIn(kind, path + '.')];
                if (kind === 'string') return [name, 'x'];
                if (kind === 'array') return [name, []];
                if (path === 'app.whenReady') return [name, () => new Promise(() => {})];
                if (path === 'configure') return [name, (config) => configured.push(config)];
                if (path === 'log.open') return [name, () => ({ file: '', write() {} })];
                return [name, () => () => {}];
            })
        );
    const environment = standIn(ENVIRONMENT.MAIN);
    const host = { notificationClicked() {}, restart() {}, showWindow() {}, hideWindow() {} };
    // What the build defines as it bundles.
    globalThis.DECKIT_VERSION = '0.0.0';
    globalThis.DECKIT_SOURCE = 'test';
    const SHELL = await import(url('deckit-shell', 'main.js'));
    const uiHost = Object.fromEntries(
        ['start', 'showsPanel', 'show', 'dismiss', 'panelTitled'].map((name) => [name, () => {}])
    );
    const early = thrown(() => SHELL.attach({}, { host: uiHost }));
    check('attach before connect is refused, saying so', /attach comes after connect/.test(early), early);
    const { stage: _stage, ...stageless } = environment;
    const pageless = { ...stageless, pages: { ...environment.pages, serve: undefined } };
    const lacking = thrown(() => SHELL.connect(pageless, { host }));
    check(
        'connect refuses an environment that lacks a member, naming it',
        /the environment lacks pages\.serve, stage/.test(lacking),
        lacking
    );
    const unknown = thrown(() => SHELL.connect(environment, { host, config: { colour: 'red' } }));
    check('connect refuses a configuration it does not read', /config sets colour/.test(unknown), unknown);
    const answer = SHELL.connect(environment, { host, config: { id: 'test', agent: ['Test'] } });
    check(
        'the environment is configured with what names what it keeps',
        configured.length === 1 && configured[0].id === 'test' && configured[0].agent[0] === 'Test',
        configured
    );
    const lacks = ENVIRONMENT.missingIn(answer, USED);
    check("connect's answer has what the UI uses", !lacks.length, lacks);
    check(
        "connect's answer hands out nothing of the environment's for the host app alone",
        answer.pages.viewOf === undefined && answer.pages.make === undefined && answer.window === undefined,
        Object.keys(answer.pages)
    );
    check('connect is called once', /once/.test(thrown(() => SHELL.connect(environment, { host }))), '');
    const other = thrown(() => SHELL.attach({ ...answer }, { host: uiHost }));
    check('attach refuses what connect did not answer', /takes what connect answered/.test(other), other);
    const unanswered = thrown(() => SHELL.attach(answer, { host: { start() {} } }));
    check(
        'attach refuses a host that does not answer the UI, naming what',
        /does not answer showsPanel/.test(unanswered),
        unanswered
    );
    const attached = thrown(() => SHELL.attach(answer, { host: uiHost }));
    check('attach refused can be called again', attached === '', attached);
    check('attach is called once', /once/.test(thrown(() => SHELL.attach(answer, { host: uiHost }))), '');

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} environment checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} environment checks`);
}

main().catch((error) => {
    console.error('[environment] ' + (error.stack || error.message));
    process.exit(1);
});
