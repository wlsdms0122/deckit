// What a layer on deckit and a driver agree on (deckit-shell/layer): how a given object is held to it, and that what
// deckit-electron's connect answers meets it. Exits 1 with a line for each check that failed. The packages are ES
// modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LAYER = await import(url('deckit-shell', 'layer', 'index.js'));
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
        LAYER.missingIn(whole, table).length === 0,
        LAYER.missingIn(whole, table)
    );
    const missing = LAYER.missingIn({ name: 1, list: {}, inner: {} }, table);
    check(
        'a member absent, or of the wrong kind, is missing, by its path',
        JSON.stringify(missing) === '["name","list","open","inner.read"]',
        missing
    );
    const carried = Object.assign(() => {}, { read() {} });
    check(
        'a function carrying the members meets a nested table',
        !LAYER.missingIn({ ...whole, inner: carried }, table).length,
        ''
    );
    const copy = LAYER.checked(whole, table, 'a test');
    check(
        'what is checked holds only what is declared, frozen',
        copy.extra === undefined &&
            copy.inner.write === undefined &&
            Object.isFrozen(copy.inner) &&
            copy.open === whole.open,
        Object.keys(copy)
    );
    const refused = thrown(() => LAYER.checked({ name: 'x' }, table, 'a test'));
    check('what lacks a member is refused, naming it', /a test lacks list, open, inner/.test(refused), refused);

    // What connect answers, made of stand-ins for what it reads: a member of the agreement it does not answer fails.
    process.type = 'browser';
    globalThis.require = () => ({ ipcMain: { on() {}, handle() {} } });
    const { createApi } = await import(url('deckit-electron', 'api', 'index.js'));
    const part = new Proxy(
        {},
        {
            get: (_target, name) =>
                name === 'TONES' ? [] : name === 'stateIn' ? () => ({ read() {}, write() {} }) : () => {},
        }
    );
    const parts = Object.fromEntries(
        ['STORAGE', 'LOG', 'WINDOW', 'IDENTITY', 'CATALOG', 'RUNNER', 'PERMISSION', 'WEB', 'KEYMAP', 'COMMAND']
            .concat(['MAIN_PROCESS', 'PAGE', 'SETUP', 'STAGE'])
            .map((name) => [name, part])
    );
    const made = thrown(() => createApi({ CONFIG: { id: 'test', name: 'Test' }, ...parts }).make({ onStart() {} }));
    check("connect's answer meets what a layer is given", made === '', made);
    const short = thrown(() => createApi({ CONFIG: { id: 'test' }, ...parts }).make({ onStart() {} }));
    check("connect's answer that lacks a member fails as it is made", /lacks config\.name/.test(short), short);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} layer checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} layer checks`);
}

main().catch((error) => {
    console.error('[layer] ' + (error.stack || error.message));
    process.exit(1);
});
