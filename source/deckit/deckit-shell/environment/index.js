import * as CHANNEL from '../deck/channel/index.js';

// What an environment gives deck, as plain data, on main's side (`MAIN`) and on a page's (`PAGE`): what carries
// messages between main and a page and what it tells of a page, and in main how deck reaches the core, the files and
// the log, the pages a mod runs in and the app quitting, and what only the environment knows: the person's home folder
// and what runs deckit. An environment gives at least this, and deck is handed this alone (`checked`). Each leaf says
// what a member is: `function`, `object`, `string`, or `array`, a list read.
// MARK: - Property
/**
 * A page: a token deck keeps, compares, keys by and hands back, and never reads. The environment hands the same
 * token as the page's maker gets, as what sent a message, and to what watches it.
 * @typedef {object} Page
 *
 * What crosses, cloned as it crosses: deck's router says what each message holds (deck/ipc/model/envelope.js), and
 * tells a question and an answer from a tell by what they hold.
 * @typedef {object} Message
 */

const MAIN = Object.freeze({
    messages: {
        // listen({ told(page, message), asked(page, message) -> Promise, askedSync(page, message) -> Promise }),
        // once: what a page tells, asks and asks sync. A page asking sync waits until the promise settles, and is
        // handed what it settles with.
        listen: 'function',
        tell: 'function', // tell(page, message): dropped when the page is gone
    },
    pages: {
        // make({ modId }) -> page: the page the mod runs in, at the mod's own origin, made and not loaded, so deck
        // knows it as the mod's before it asks anything. It opens no window of its own, and runs at full speed off
        // screen
        make: 'function',
        load: 'function', // load(page): a page make() made, loaded at its address
        close: 'function', // close(page): the page closed, unless it is gone already
        isGone: 'function', // isGone(page): whether the page can no longer receive messages
        // watch(page, { failed, ended, gone, destroyed, consoleError }), each optional: `failed(why)` when the page's
        // load did not complete, other than by another load replacing it; `ended()` each time the page's document is
        // replaced, by a main-frame navigation that commits, its first load's included; `gone(why)` each time its
        // process ends, the page living on; `destroyed()` once, as the page goes; `consoleError(message)` for what its
        // console says as an error
        watch: 'function',
        // pin(page): the page stays on the address its first load commits; a navigation of its own elsewhere, or a
        // redirect, is refused, and only main loading or reloading it moves it
        pin: 'function',
        // watchInput(page, listener({ type })): `keydown` before anything watching after it may take the key, and
        // `mousedown`, `mouseup`, as UI Events name them
        watchInput: 'function',
        // clearStorage(modId) -> Promise: what the mod's pages stored, the web's storage, taken
        clearStorage: 'function',
    },
    core: {
        // open({ onMessage(line), onLog(line), onEnd(why) }) -> { send(line) }: the core, started, a message a line
        // each way. `onLog` hears what it logs, and `onEnd` once that it ended, whether it ran or never started, after
        // the last line it sent; what is sent after is dropped
        open: 'function',
    },
    folders: {
        user: 'string', // the person's home folder
    },
    files: {
        readText: 'function', // readText(file) -> Promise of the file's text
    },
    // The file deck's log is written to: open({ folder, name }) -> { file, write(where, level, parts) }, `file` its
    // path, in `folder` and named for `name`. Writing never throws
    log: { open: 'function' },
    // The host app, and what runs it, outermost first, each { name, version }
    about: { app: { name: 'string', version: 'string' }, engines: 'array' },
    app: {
        // onQuit(hold): `hold()` is asked as the app is about to quit, once the quit is decided; answering true keeps
        // it from quitting, until it is asked to quit again
        onQuit: 'function',
        quit: 'function', // quit(): the app asked to quit
    },
});

const PAGE = Object.freeze({
    messages: {
        // listen({ told(message) }), once, as the page's preload runs: what main tells before is not kept
        listen: 'function',
        tell: 'function', // tell(message): throws at once when the message cannot be cloned
        ask: 'function', // ask(message) -> Promise
        askSync: 'function', // askSync(message): what main's promise settled with
    },
    modules: {
        // evaluate(source, { mod, file }) -> its exports: `source` run as a CommonJS module with only `module` and
        // `exports` in reach, as the mod's `file`; throws what it throws
        evaluate: 'function',
    },
});

// MARK: - Initializer
// MARK: - Public
// The members `table` names that `given` does not have as it says, each by its path: none when it has them all. A
// member of the wrong kind is missing. A nested table is met by an object, or a function, carrying its members.
function missingIn(given, table, at = '') {
    return Object.entries(table).flatMap(([name, kind]) => {
        const path = at + name;
        const value = given?.[name];
        if (typeof kind !== 'object') return CHANNEL.kindOf(value) === kind ? [] : [path];
        const carries = value && (typeof value === 'object' || typeof value === 'function');
        return carries ? missingIn(value, kind, path + '.') : [path];
    });
}

// What `given` holds of `table`, and nothing else, frozen: a throw naming what `what` lacks when it lacks any. So
// what is handed this reaches only what it is given.
function checked(given, table, what) {
    const missing = missingIn(given, table);
    if (missing.length) throw new Error(`[deckit] ${what} lacks ${missing.join(', ')}`);
    return copyOf(given, table);
}

// MARK: - Private
function copyOf(given, table) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(table).map(([name, kind]) => [
                name,
                typeof kind === 'object' ? copyOf(given[name], kind) : given[name],
            ])
        )
    );
}

export { MAIN, PAGE, missingIn, checked };
