import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// What an environment gives deckit, as plain data, on main's side (`MAIN`) and on a page's (`PAGE`): what carries
// messages between main and a page and what it tells of a page, and in main how deckit reaches the core, the files and
// the log, the pages a mod runs in, the app starting and quitting, what deckit does through the system for a mod
// (opening, notifications, the clipboard), what it asks whoever is at the machine, and what only the environment knows:
// the person's home folder and what runs deckit. An environment gives at least this, and each is handed what it is checked against alone (`checked`). Each
// leaf says what a member is: `function`, `object`, `string`, or `array`, a list read.
// MARK: - Property
/**
 * A page: a token deckit keeps, compares, keys by and hands back, and never reads. The environment hands the same
 * token as the page's maker gets, as what sent a message, and to what watches it.
 * @typedef {object} Page
 *
 * What crosses, cloned as it crosses: deckit's router says what each message holds (deckit/ipc/model/envelope.js), and
 * tells a question and an answer from a tell by what they hold.
 * @typedef {object} Message
 */

const MAIN = Object.freeze({
    // configure({ id }), once, before anything else: `id` names what the environment keeps for deckit, apart from what
    // another host app embedding deckit keeps
    configure: 'function',
    messages: {
        // listen({ told(page, message), asked(page, message) -> Promise, askedSync(page, message) -> Promise }),
        // once: what a page tells, asks and asks sync. A page asking sync waits until the promise settles, and is
        // handed what it settles with: an environment gives deckit only if it can hold a page until main answers.
        listen: 'function',
        tell: 'function', // tell(page, message): dropped when the page is gone
    },
    pages: {
        // make({ modId }) -> page, made and not loaded, so deckit knows whose it is before it asks anything: the page
        // a mod runs in, at the mod's own origin, with deckit's policy for its document (only its origin's scripts in
        // its own world) and every permission of the web's refused, as what a mod reaches it reaches through deckit; it
        // shows web pages, runs at full speed off screen, and opens no window of its own
        make: 'function',
        load: 'function', // load(page): a page make() made, loaded at its address, again after its process ended
        close: 'function', // close(page): the page closed, unless it is gone already
        isGone: 'function', // isGone(page): whether the page can no longer receive messages
        // watch(page, { failed, ended, gone, destroyed, focused, consoleError, opens, leaves }), each optional:
        // `focused()` each time the page takes the keyboard; `failed(why)`
        // when the page's load did not complete, other than by another load replacing it; `ended()` each time the
        // page's document is replaced, by a main-frame navigation that commits, its first load's included; `gone(why)`
        // each time its process ends, the page living on; `destroyed()` once, as the page goes; `consoleError(message)`
        // for what its console says as an error; `opens(url, { activates, target })` when it asks for a window the
        // environment does not open for it, `activates` whether what opens comes forward and `target` the name it
        // targets; and, for a mod's page, `leaves(url)` when its main frame asks to go outside the mod's origin.
        // Answers `off()`, which stops this watch alone
        watch: 'function',
        // serve(folderOf), once the app is ready, before any page loads: deckit's pages served, a mod's page with the
        // files of the folder `folderOf(modId)` answers, or none where it answers null
        serve: 'function',
        // pin(page): the page stays on the address its first load commits; a navigation of its own elsewhere, or a
        // redirect, is refused, and only main loading or reloading it moves it
        pin: 'function',
        // clearStorage(modId) -> Promise: what the mod's pages stored, the web's storage, taken
        clearStorage: 'function',
        // countStorage(modId) -> Promise of an integer: how many items the mod's pages keep in the web's local storage
        countStorage: 'function',
        // dialogs(answer), once: what any page asks and waits on, `answer(page, { kind, message, value, origin }) ->
        // Promise of the reply`, `kind` `alert`, `confirm`, `prompt` or `leave`, `value` the prompt's starting text,
        // `origin` the asking frame's; a reply that is no boolean (confirm, leave) or string (prompt) is the refusal:
        // done, false, null, and leaves. A page's picker, which it does not wait on, is asked the same way as
        // `{ kind, options, rect, origin }`, `kind` `select`, `options` in order `{ label, group, disabled,
        // selected }`, `group` a group's label or null, `rect` the control's in its frame, replied an option's index
        // or the refusal. Until it is given, every page is refused
        dialogs: 'function',
    },
    // What is opened outside the app, by the system: `url(url, { activate }) -> Promise`, an address in the app that
    // opens its scheme, the browser for the web, brought forward unless `activate` is false; `file(path, { activate })
    // -> Promise of boolean`, a file at an absolute path in its app, brought forward as `url` brings it, false when
    // there is none there or it did not open
    open: { url: 'function', file: 'function' },
    notifications: {
        // show({ title, body, silent }, { onClick }) -> Promise: true once shown, false where the system has none;
        // rejects with why when the system says it did not show it. `onClick()` hears a click on it
        show: 'function',
    },
    admission: {
        // ask({ user: { id, name } }, { signal }) -> Promise of boolean: whoever is at the machine asked, as the machine
        // shows what is its own, whether `user` may sit; the ask is put away once `signal` is aborted. False where the
        // machine shows it nothing
        ask: 'function',
    },
    // The clipboard's text: readText() -> string, writeText(text)
    clipboard: { readText: 'function', writeText: 'function' },
    core: {
        // open({ onMessage(line), onLog(line), onEnd(why) }) -> { send(line) }: the core, started, a message a line
        // each way. `onLog` hears what it logs, and `onEnd` once that it ended, whether it ran or never started, after
        // the last line it sent; what is sent after is dropped
        open: 'function',
    },
    transport: {
        // listen({ path, limit }, { opened, failed }) -> { close() }: a local stream socket at `path`, a message a line
        // each way, which only the account that runs the app can open, gone as the app quits. Each transport connection
        // that arrives is handed to `opened({ send(line), close(), limit(bytes) })`, which answers `{ onMessage(line),
        // onEnd() }`: a line longer than its limit, `limit` at first, closes it, and `onEnd` hears once that it closed.
        // `failed(why)` hears that nothing listens
        listen: 'function',
    },
    folders: {
        user: 'string', // the person's home folder
    },
    // A file's text, and what changes a person's files without losing one, each refusal an error whose `kind` says what
    // a person can act on: `name(text)`, a typed name checked, refused with `NAME`; `fresh(folder, base, make,
    // extension) -> Promise of the path`, something new `make(path)` makes under the first free name; `rename(path,
    // name)` and `move(path, folder) -> Promise of the new path`, never over another entry (`EXISTS`, `GONE`,
    // `INTO_ITSELF`, `OTHER_DISK`); `trash(path) -> Promise`, put where the system keeps what a person throws away
    files: {
        readText: 'function', // readText(file) -> Promise of the file's text
        name: 'function',
        fresh: 'function',
        rename: 'function',
        move: 'function',
        trash: 'function',
    },
    // The file deckit's log is written to: open({ folder, name }) -> { file, write(where, level, parts) }, `file` its
    // path, in `folder` and named for `name`. Writing never throws
    log: { open: 'function' },
    // The host app, `{ name, version }`, and what runs it, outermost first, each `{ key, name, version }`: `key` is
    // the engine's name in lower case, and `name` as a person reads it
    about: { app: { name: 'string', version: 'string' }, engines: 'array' },
    reports: {
        // listen(listener(level, parts)), once: what the environment's own parts say, `level` one of `info`, `warn` and
        // `error`, and `parts` what is logged; what they said before is told as it starts listening
        listen: 'function',
    },
    app: {
        whenReady: 'function', // whenReady() -> Promise, settled once the app is ready to show pages
        // onQuit(hold): `hold()` is asked as the app is about to quit, once the quit is decided; answering true keeps
        // it from quitting, until it is asked to quit again
        onQuit: 'function',
        // quit(): the app asked to quit; asked while `hold` is asked, it is a quit asked once that one is decided
        quit: 'function',
    },
});

const PAGE = Object.freeze({
    messages: {
        // listen({ told(message) }), once, as the page's preload runs: what main tells before is not kept
        listen: 'function',
        tell: 'function', // tell(message): throws at once when the message cannot be cloned
        ask: 'function', // ask(message) -> Promise
        // askSync(message): what main's promise settled with, the page held until then
        askSync: 'function',
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
