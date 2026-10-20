import * as CHANNEL from '../deck/channel/index.js';

// What an environment gives deck, as plain data, on main's side (`MAIN`) and on a page's (`PAGE`): what carries
// messages between main and a page and what it tells of a page, and in main how deck reaches the core, the files and
// the log, the pages a mod runs in and the app quitting, what deckit does through the system for a mod (keys,
// opening, notifications, the clipboard, a folder chosen, main process modules), and what only the environment
// knows: the person's home folder and what runs deckit. An environment gives at least this, and deck is handed this
// alone (`checked`). Each leaf says what a member is: `function`, `object`, `string`, or `array`, a list read.
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
    keys: {
        // capture(page, handler(pressed) -> boolean): each key pressed in the page, `{ type, code, meta, control, alt,
        // shift }` with `type` as UI Events names it (`keydown`, `keyup`), told before the page has it and taken from
        // the page when `handler` answers true, at once. Told after what `pages.watchInput` told of it, when that
        // watch began first
        capture: 'function',
    },
    // What is opened outside the app, by the system: `url(url, { activate }) -> Promise`, an address in the browser,
    // brought forward unless `activate` is false; `file(path) -> Promise of boolean`, a file at an absolute path in
    // its app, false when there is none there or it did not open; `reveal(path) -> boolean`, an absolute path shown
    // where it lies, false when there is none there
    open: { url: 'function', file: 'function', reveal: 'function' },
    notifications: {
        // show({ title, body, silent }, { onClick }) -> Promise: true once shown, false where the system has none;
        // rejects with why when the system says it did not show it. `onClick()` hears a click on it
        show: 'function',
    },
    // The clipboard's text: readText() -> string, writeText(text)
    clipboard: { readText: 'function', writeText: 'function' },
    // chooseFolder({ title, buttonLabel, message }) -> Promise of the folder the person chose, or null
    dialogs: { chooseFolder: 'function' },
    // A mod's main process modules, which the environment runs, deck saying which mod starts what and when. A mod is
    // `{ id, folder, data, pageOf() }`: its folder, its data folder, and the page it runs in now, or null.
    mainProcess: {
        start: 'function', // start(mod, path) -> Promise of { path, methods }: the module, started once in a run
        call: 'function', // call(modId, path, method, args) -> Promise of what the method answered
        launching: 'function', // launching(mod): its run is about to launch
        // ended(mod, { within }): its run ended, and its modules end with it, each given `within` ms to finish
        // starting and to dispose
        ended: 'function',
        removed: 'function', // removed(modId, { running }): the mod was taken away, its run not ended when `running`
        // installed(modId) -> Promise of { restart }: the mod installed again, once what ran in its place has ended,
        // `restart` whether only a restart of the app brings its modules up to date
        installed: 'function',
        // stateOf(modId) -> { running, failure }: whether a module of its runs, and why those that did not start did
        // not, or null
        stateOf: 'function',
        onEvent: 'function', // onEvent(listener(modId, path, name, args)) -> off: what a module emits
        onChange: 'function', // onChange(listener()) -> off: what `stateOf` or `restartPending` answer may have changed
        // restartPending() -> [{ id, why }]: the mods whose modules only a restart of the app finishes, `why` one of
        // `updated` (its code changed while a module stayed), `removed`, `reinstalled` (removed, then installed again)
        // and `leftover` (a module with no dispose, or whose dispose failed or ran late, may have left what it made)
        restartPending: 'function',
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
    // The host app, `{ name, version }`, and what runs it, outermost first, each `{ key, name, version }`: `key` is
    // the engine's name in lower case, which a mod reads its version by in `about()` (MOD.md), and `name` as a person
    // reads it
    about: { app: { name: 'string', version: 'string' }, engines: 'array' },
    reports: {
        // listen(listener(level, parts)), once: what the environment's own parts say, `level` one of `info`, `warn` and
        // `error`, and `parts` what is logged; what they said before is told as it starts listening
        listen: 'function',
    },
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
