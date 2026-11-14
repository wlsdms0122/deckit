// What an environment gives deckit (deckit-shell/environment): how a given object is held to it, that connect, the web
// engine's attach and the UI's refuse an environment that lacks a member, that connect refuses a shipped folder with no
// system mark, what connect answers the UI, the web engine and the host app, that Deckit.app answers what connect and
// attach ask of a host app, and that each attach defines its permissions. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

// What the UI, the web engine and the main process modules on deckit use of what connect answers.
const USED = {
    config: { name: 'string' },
    onStart: 'function',
    stack: 'function',
    core: { onDown: 'function' },
    restart: 'function',
    channels: { bind: 'function' },
    permissions: { define: 'function' },
    fields: { define: 'function' },
    mods: {
        notifications: 'array',
        list: 'function',
        onChange: 'function',
        ownerOf: 'function',
        runs: 'function',
        runOf: 'function',
        observe: 'function',
        onInstalled: 'function',
        onRemoved: 'function',
        timeout: 'function',
        modOf: 'function',
        openExternal: 'function',
    },
    pages: { add: 'function', whenEnds: 'function', nameOf: 'function', onSandbox: 'function' },
    stateIn: 'function',
    log: { info: 'function', warn: 'function' },
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
    const webEnvironment = standIn(ENVIRONMENT.WEB);
    const shellEnvironment = standIn(ENVIRONMENT.SHELL);
    const host = { notificationClicked() {}, restart() {} };
    // What the build defines as it bundles.
    globalThis.DECKIT_VERSION = '0.0.0';
    globalThis.DECKIT_SOURCE = 'test';
    const SHELL = await import(url('deckit-shell', 'main.js'));
    const uiHost = Object.fromEntries(
        ['start', 'show', 'desktopTitled', 'showWindow', 'closeWindow'].map((name) => [name, () => {}])
    );
    const early = thrown(() => SHELL.attach({}, shellEnvironment, { host: uiHost }));
    check('attach before connect is refused, saying so', /attach comes after connect/.test(early), early);
    const { clipboard: _clipboard, ...clipboardless } = environment;
    const pageless = { ...clipboardless, pages: { ...environment.pages, serve: undefined } };
    const lacking = thrown(() => SHELL.connect(pageless, { host }));
    check(
        'connect refuses an environment that lacks a member, naming it',
        /the environment lacks pages\.serve, clipboard/.test(lacking),
        lacking
    );
    const unknown = thrown(() => SHELL.connect(environment, { host, config: { colour: 'red' } }));
    check('connect refuses a configuration it does not read', /config sets colour/.test(unknown), unknown);
    const unmarked = thrown(() => SHELL.connect(environment, { host, folders: { ship: ['/ship/a'] } }));
    check(
        'connect refuses a shipped folder with no system mark',
        /folders\.ship lists \{ folder, system \}/.test(unmarked),
        unmarked
    );
    // Deckit.app's own host app, over windows and a theme that are never asked for before it starts.
    const { createApp } = require(path.join(__dirname, '..', '..', 'deckit', 'deckit-app', 'app', 'app.js'));
    const deckitApp = createApp({ WINDOW: {}, THEME: {} }).make({ restart() {} });
    const answer = SHELL.connect(environment, { host: deckitApp, config: { id: 'test' } });
    check(
        'the environment is configured with what names what it keeps',
        configured.length === 1 && configured[0].id === 'test',
        configured
    );
    const lacks = ENVIRONMENT.missingIn(answer, USED);
    check("connect's answer has what the UI uses", !lacks.length, lacks);
    check(
        "connect's answer hands out nothing of the environment's for the host app alone",
        answer.pages.viewOf === undefined &&
            answer.pages.make === undefined &&
            answer.pages.stage === undefined &&
            answer.window === undefined,
        Object.keys(answer.pages)
    );
    check(
        "connect's answer tells the host app when deckit has started, not before the app is ready",
        answer.whenStarted() instanceof Promise && answer.whenStarted() === answer.whenStarted(),
        typeof answer.whenStarted
    );
    check('connect is called once', /once/.test(thrown(() => SHELL.connect(environment, { host }))), '');
    const { pages: _pages, ...webPageless } = webEnvironment;
    const unwebbed = thrown(() => SHELL.attachWeb(answer, webPageless));
    check(
        "the web engine's attach refuses an environment that lacks what the web engine is given, naming it",
        /the environment lacks pages/.test(unwebbed),
        unwebbed
    );
    let web = null;
    const webAttached = thrown(() => (web = SHELL.attachWeb(answer, webEnvironment)));
    check(
        "the web engine's attach answers what the UI reads of the web pages mods show",
        webAttached === '' &&
            typeof web?.pageFor === 'function' &&
            typeof web.holdsKeyboard === 'function' &&
            typeof web.onPage === 'function',
        webAttached
    );
    const network = { id: 'system.network', name: 'x', description: 'x' };
    const webTwice = thrown(() => answer.permissions.define(network));
    check("the web engine's attach defines the web's permissions", /defined twice/.test(webTwice), webTwice);
    const other = thrown(() => SHELL.attach({ ...answer }, shellEnvironment, { host: uiHost, web }));
    check('attach refuses what connect did not answer', /takes what connect answered/.test(other), other);
    const { stage: _stage, ...stageless } = shellEnvironment;
    const unstaged = thrown(() => SHELL.attach(answer, stageless, { host: uiHost }));
    check(
        'attach refuses an environment that lacks what the UI is given, naming it',
        /the environment lacks stage/.test(unstaged),
        unstaged
    );
    const unanswered = thrown(() => SHELL.attach(answer, shellEnvironment, { host: { start() {} } }));
    check(
        'attach refuses a host that does not answer the UI, naming what',
        /does not answer show, desktopTitled/.test(unanswered),
        unanswered
    );
    const attached = thrown(() => SHELL.attach(answer, shellEnvironment, { host: deckitApp, web }));
    check("attach refused can be called again, and takes Deckit.app's answers", attached === '', attached);
    const keys = ['deckit.app-keys', 'system.global-keys', 'deckit.shell-keys'];
    const twice = keys.map((id) => thrown(() => answer.permissions.define({ id, name: 'x', description: 'x' })));
    check(
        'attach defines the permissions of the UI, those of the keys included',
        twice.every((one) => /defined twice/.test(one)),
        twice
    );
    check(
        'attach is called once',
        /once/.test(thrown(() => SHELL.attach(answer, shellEnvironment, { host: uiHost }))),
        ''
    );

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
