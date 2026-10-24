import * as CHANNEL from '../deck/channel/index.js';

// What an environment gives deck, as plain data, on main's side (`MAIN`) and on a page's (`PAGE`): what carries
// messages between main and a page and what it tells of a page, and in main how deck reaches the core, the files and
// the log, the pages deck makes and a stage to lay them on, the app starting and quitting, what deckit does through the
// system for a mod (keys, opening, notifications, the clipboard, a folder chosen, main process modules, the web pages a
// mod shows), and what only the environment knows: the person's home folder and what runs deckit. An environment gives
// at least this, and deck is handed this alone (`checked`). Each leaf says what a member is: `function`, `object`,
// `string`, or `array`, a list read.
// MARK: - Property
/**
 * A page: a token deck keeps, compares, keys by and hands back, and never reads. The environment hands the same
 * token as the page's maker gets, as what sent a message, and to what watches it.
 * @typedef {object} Page
 *
 * What crosses, cloned as it crosses: deck's router says what each message holds (deck/ipc/model/envelope.js), and
 * tells a question and an answer from a tell by what they hold.
 * @typedef {object} Message
 *
 * A page as a stage lays it, bottom to top: at `rect`, or hidden in the place it has.
 * @typedef {{ page: Page, rect: { x: number, y: number, width: number, height: number } } | { page: Page, hidden: true }} Laid
 */

const MAIN = Object.freeze({
    // configure({ id, agent }), once, before anything else: `id` names what the environment keeps for deckit, apart
    // from what another host app embedding deckit keeps, and `agent` the names the host app adds to its user agent,
    // taken out of a web page's
    configure: 'function',
    messages: {
        // listen({ told(page, message), asked(page, message) -> Promise, askedSync(page, message) -> Promise }),
        // once: what a page tells, asks and asks sync. A page asking sync waits until the promise settles, and is
        // handed what it settles with: an environment gives deck only if it can hold a page until main answers.
        listen: 'function',
        tell: 'function', // tell(page, message): dropped when the page is gone
    },
    pages: {
        // make({ modId }) or make({ name, keepsDrawing }) -> page, made and not loaded, so deck knows whose it is
        // before it asks anything. The page a mod runs in is at the mod's own origin, with deck's policy for its
        // document (only its origin's scripts in its own world) and every permission of the web's refused, as what a
        // mod reaches it reaches through deck; it shows web pages, and runs at full speed off screen. One that runs no
        // mod, `name` a lower case letter then letters, digits and `-`, is at an origin of its own that is never a
        // mod's, laid out while hidden too when `keepsDrawing`. Neither opens a window of its own
        make: 'function',
        load: 'function', // load(page): a page make() made, loaded at its address, again after its process ended
        close: 'function', // close(page): the page closed, unless it is gone already
        focus: 'function', // focus(page): the page takes the keyboard
        isGone: 'function', // isGone(page): whether the page can no longer receive messages
        isClosed: 'function', // isClosed(page): whether the page is gone for good, closed or destroyed
        // watch(page, { failed, ended, gone, destroyed, focused, consoleError, opens, leaves }), each optional:
        // `focused()` each time the page takes the keyboard; `failed(why)`
        // when the page's load did not complete, other than by another load replacing it; `ended()` each time the
        // page's document is replaced, by a main-frame navigation that commits, its first load's included; `gone(why)`
        // each time its process ends, the page living on; `destroyed()` once, as the page goes; `consoleError(message)`
        // for what its console says as an error; `opens(url, { activates, target })` when it asks for a window, which
        // it is not given, but for a surface `surfaces` lets it open, `activates` whether what opens comes forward and
        // `target` the name it targets; and, for a mod's page, `leaves(url)` when its main frame asks to go outside the
        // mod's origin. Answers `off()`, which stops this watch alone
        watch: 'function',
        // surfaces(page, { allow(name) -> boolean, opened(name, surface) }): the documents a page that runs no mod may
        // open with `window.open('', name)`, those `allow` answers true for, each a page of its own (`surface`), laid
        // as any page is, which runs no code and goes nowhere. What else it asks for is no window, told to what watches
        // its `opens`
        surfaces: 'function',
        // serve(folderOf), once the app is ready, before any page loads: deck's pages served, a mod's page with the
        // files of the folder `folderOf(modId)` answers, or none where it answers null
        serve: 'function',
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
        // hotkey(keystroke, handler()) -> off, or null when the system does not give it: a key, `{ code, meta,
        // control, alt, shift }`, heard wherever the keyboard is, in any app, once the app is ready, `handler()` told
        // each time it is pressed and the key taken from wherever it was pressed
        hotkey: 'function',
    },
    // What is opened outside the app, by the system: `url(url, { activate }) -> Promise`, an address in the app that
    // opens its scheme, the browser for the web, brought forward unless `activate` is false; `file(path) -> Promise of
    // boolean`, a file at an absolute path in its app, false when there is none there or it did not open;
    // `reveal(path) -> boolean`, an absolute path shown where it lies, false when there is none there;
    // `appFor(url) -> string`, the name of the app that opens an address of its scheme as a person reads it, or ''
    // where none does, as for the environment's own schemes
    open: { url: 'function', file: 'function', reveal: 'function', appFor: 'function' },
    notifications: {
        // show({ title, body, silent }, { onClick }) -> Promise: true once shown, false where the system has none;
        // rejects with why when the system says it did not show it. `onClick()` hears a click on it
        show: 'function',
    },
    // The clipboard's text: readText() -> string, writeText(text)
    clipboard: { readText: 'function', writeText: 'function' },
    // chooseFolder({ title, buttonLabel, message }) -> Promise of the folder the person chose, or null
    dialogs: { chooseFolder: 'function' },
    // stage() -> a stage (`STAGE`): where pages deck made are laid in one of the host app's windows
    stage: 'function',
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
    // The web pages a mod's page shows, each in one of the mod's web sessions, by name, which the environment keeps
    // apart from every other mod's. A web page is a page too, kept and handed back, and has an id, a number the mod's
    // page is told, which `pageOf` answers the page of. A web page is shown in the mod's page, or in a window of the
    // app's, as a mod's page or a web page asks for one; a web page in a window answers to the tab that opened it,
    // which is itself for a web page the mod asked for. `mod` is a mod's id and `session` a session's name.
    web: {
        // listen(deck), once, before any web page is shown: deck as `WEB_DECK` declares it, what it answers and is
        // told of the web pages a mod shows
        listen: 'function',
        embed: 'function', // embed(page): the page shows web pages, as elements of its own
        pageOf: 'function', // pageOf(id) -> the web page of that id, while it is there, or null
        // holderOf(page) -> { embedder, id, tab, inPage }: the page showing it, its id, the id of the tab it answers
        // to, and whether it is an element of that page; null for a page that is no web page
        holderOf: 'function',
        // holdsKeyboard(page) -> whether the page, or a web page shown in it, has the keyboard
        holdsKeyboard: 'function',
        // openWindow(embedder, { mod, session, url, title }) -> the id of a web page in a window
        openWindow: 'function',
        load: 'function', // load(page, url)
        navigate: 'function', // navigate(page, to): `back`, `forward`, `reload` or `stop`
        setMuted: 'function', // setMuted(page, on)
        // find(page, text, { start, back, matchCase }): `start` a new search, otherwise the next match
        find: 'function',
        stopFind: 'function', // stopFind(page, { keepSelection })
        close: 'function', // close(page): a web page in a window, with its window
        // stateOf(page) -> { url, title, icon, loading, canGoBack, canGoForward, audible, muted, capture }, or null
        // once it is gone; `capture` is `{ microphone, camera, screen }`, what the page says it captures
        stateOf: 'function',
        clickNotification: 'function', // clickNotification(page, notification): one it showed, clicked
        sessionOf: 'function', // sessionOf(page) -> the session a web page is in, `{ mod, name }`, or null
        // permissionsChanged(): what deck lets sites have changed, so what a page read of it is read again
        permissionsChanged: 'function',
        fetchText: 'function', // fetchText(mod, session, url) -> Promise of the text at a web address
        clear: 'function', // clear(mod, session) -> Promise: what the session stored, taken
        // trust(mod, session, entries) -> how many are trusted: `[{ host, fingerprint }]`, certificates trusted
        trust: 'function',
        // sessionsOf(mod) -> what a mod's page is told its mod's sessions are named by, a string it hands `view` (PAGE)
        // as `sessions`, unread
        sessionsOf: 'function',
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
        whenReady: 'function', // whenReady() -> Promise, settled once the app is ready to show pages
        // onQuit(hold): `hold()` is asked as the app is about to quit, once the quit is decided; answering true keeps
        // it from quitting, until it is asked to quit again
        onQuit: 'function',
        quit: 'function', // quit(): the app asked to quit
    },
});

// What deck hands an environment's web (`MAIN.web.listen`). Answered at once: `loading(embedder, page, to, { inPage,
// from, followed })`, what becomes of a web page `embedder` shows asked to load `to` from `from`, `page` null before it
// is made, `followed` when the page follows a link of its own: `load`, `refuse`, or `leave`, the document staying where
// it is while deck tells who shows it, and the environment does as it answers whatever it answers; `attaching(embedder,
// session)`, whether a web page in `session`, `{ mod, name }` or null for one that is no mod's, is shown in
// `embedder`'s page; `windowOpen(embedder, page, { url, tab, from, inPage, ownWindow, activates, target })`, whether a
// web page's window.open is given a window of its own, `tab` the id of the tab it answers to, `from` the address it is
// at and `ownWindow` whether it asked for a window rather than a tab; `permits(session, origin, name)`, whether a site
// may have `name` in `session`, as the environment checks it, and `permitted(session, name)`, the origins that may.
// Told: `adopted(embedder, page)`, a web page now shown, in its page or in a window; `changed(embedder, id, state)`;
// `found(embedder, id, { matches, active, final })`; `closed(embedder, id)`, a window gone; `refused(embedder, id,
// certificate)`; and `notified(embedder, id, { origin, notification, title, body, silent })`, what a site's
// notification shows. Asked, each a promise of whether it is allowed: `request(embedder, id, { origin, permissions })`
// and `requestApp(embedder, id, { url, origin })`, what a site in the tab of that id asks, `permissions` as deck names
// them (web/model/site-permission.js), none where the environment's name for it is none of deck's.
const WEB_DECK = Object.freeze({
    loading: 'function',
    attaching: 'function',
    windowOpen: 'function',
    permits: 'function',
    permitted: 'function',
    adopted: 'function',
    changed: 'function',
    found: 'function',
    closed: 'function',
    refused: 'function',
    notified: 'function',
    request: 'function',
    requestApp: 'function',
});

// What `MAIN.stage()` makes. `place(window, { bounds, front, onClose })`: the stage in one of the host app's windows at
// a time, `bounds` a rect or a function of the window's content size that it follows, `front` over what is in the
// window already, `onClose()` once it is out of a closing window; `size() -> { width, height }`;
// `whenResized(listener) -> off`; `show(on)`; `lay(laid)`, the pages on it, Laid, bottom to top: a hidden one keeps the
// place it has, a new one goes in over the layer before it, and a page left out, or gone, is taken off. Where a page
// laid on it marks itself with `-webkit-app-region: drag`, as the shell's frame and kit do, a press drags the window it
// is in.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
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
    web: {
        // view({ sessions, session, url }, { closing, focused }) -> { element, id }: a web page shown in this page, in
        // the mod's session by that name, `sessions` what main told this page its mod's sessions are named by
        // (`sessionsOf`, MAIN).
        // `element` is put where it shows, and `id` a promise of its id once it has one. `closing()` when the web page
        // asks to close itself, `focused()` when it takes focus
        view: 'function',
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

export { MAIN, STAGE, PAGE, WEB_DECK, missingIn, checked };
