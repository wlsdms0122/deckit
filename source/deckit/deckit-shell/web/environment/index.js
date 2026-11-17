// What an environment gives the web engine on deckit, as plain data, on main's side (`WEB`) and on a page's
// (`WEB_PAGE`), and what the web engine hands the environment's web (`WEB_CLIENT`). Each leaf says what a member is, as
// deckit's tables say (deckit/environment).
// MARK: - Property
// What an environment gives the web engine in main: the web pages a mod's page shows, what it tells of a page, and what
// is opened outside the app. `pages.watch` is as `MAIN.pages` says, and `open.url` as `MAIN.open` says.
const WEB = Object.freeze({
    // The web pages a mod's page shows, each in one of the mod's web sessions, by name, which the environment keeps
    // apart from every other mod's. A web page is a page too, kept and handed back, and has an id, a number the mod's
    // page is told, which `pageOf` answers the page of. A web page is shown in the mod's page, or in a window of the
    // app's as the mod's page asks for one, and answers for itself. `mod` is a mod's id and `session` a session's
    // name.
    web: {
        // listen(client), once, before any web page is shown: the web engine as `WEB_CLIENT` declares it, what it
        // answers and is told of the web pages a mod shows
        listen: 'function',
        embed: 'function', // embed(page): the page shows web pages, as elements of its own
        pageOf: 'function', // pageOf(id) -> the web page of that id, while it is there, or null
        // holderOf(page) -> { embedder, id, inPage }: the page showing it, its id, and whether it is an element of
        // that page; null for a page that is no web page
        holderOf: 'function',
        // holdsKeyboard(page) -> whether the page, or a web page shown in it, has the keyboard
        holdsKeyboard: 'function',
        // openWindow(embedder, { mod, session, url, title }) -> the id of a web page in a window, a blank page that
        // loads nothing for `url` '' or about:blank
        openWindow: 'function',
        load: 'function', // load(page, url)
        navigate: 'function', // navigate(page, to): `back`, `forward`, `reload` or `stop`
        setMuted: 'function', // setMuted(page, on)
        // find(page, text, { start, back, matchCase }): `start` a new search, otherwise the next match
        find: 'function',
        stopFind: 'function', // stopFind(page, { keepSelection })
        close: 'function', // close(page): a web page in a window, with its window
        // stateOf(page) -> { url, title, icon, loading, canGoBack, canGoForward, blank, audible, muted, capture,
        // failure }, or null once it is gone; `capture` is `{ microphone, camera, screen }`, what the page says it
        // captures, and `failure` `{ url, kind }` from a load of its main frame that failed before anything of it was
        // committed until a load commits, `kind` one of web/engine/model/load-failure.js, or null; a load stopped or
        // replaced, and a certificate refused, is no failure. While it holds one, `navigate(page, 'reload')` loads
        // `url`, and `back` goes to what the page showed, where it showed anything, and takes the failure away
        stateOf: 'function',
        clickNotification: 'function', // clickNotification(page, notification): one it showed, clicked
        // untaken() -> how many tellings the web pages' documents were told of the environment's own accord, a click on
        // a notification or the news that a site may have notifications, and have not yet taken
        untaken: 'function',
        sessionOf: 'function', // sessionOf(page) -> the session a web page is in, `{ mod, name }`, or null
        // permissionsChanged(): what the web engine lets sites have changed, so what a page read of it is read again
        permissionsChanged: 'function',
        // fetch(mod, session, { url, method, headers, body, redirect }) -> Promise of `{ url, status, headers, body,
        // redirected }`, the request sent as the session's pages send one: `headers` `[[name, value]]`, `body` bytes
        // in base64, left out of the request for none, `redirect` `follow`, `error` or `manual`, and `url` the address
        // that answered; rejected with kind QUOTA_EXCEEDED for an answer past `fetchLimit` (WEB_CLIENT)
        fetch: 'function',
        clear: 'function', // clear(mod, session) -> Promise: what the session stored, taken
        cancelDownload: 'function', // cancelDownload(id): a download under way, stopped
        // trust(mod, session, entries): `[{ host, fingerprint }]`, certificates trusted in that session, each a string
        trust: 'function',
        trusts: 'function', // trusts(mod) -> whether a certificate is trusted in a session of the mod's
        distrust: 'function', // distrust(mod): every certificate trusted in a session of the mod's, trusted no more
        // sessionsOf(mod) -> what a mod's page is told its mod's sessions are named by, a string it hands `view`
        // (WEB_PAGE) as `sessions`, unread
        sessionsOf: 'function',
    },
    pages: {
        watch: 'function',
        // watchInput(page, listener({ type })): `keydown` before anything watching after it may take the key, and
        // `mousedown`, `mouseup`, as UI Events name them
        watchInput: 'function',
    },
    // `appFor(url) -> string`, the name of the app that opens an address of its scheme as a person reads it, or ''
    // where none does, as for the environment's own schemes
    open: { url: 'function', appFor: 'function' },
    // The clipboard a site reaches, the one the mod's handle reads and writes: `readText() -> string` and
    // `writeText(text)`
    clipboard: { readText: 'function', writeText: 'function' },
});

// What the web engine hands an environment's web (`WEB.web.listen`), its client: what the web calls back as its pages
// ask and change. Answered at once: `loading(embedder, page, to, { inPage, from, followed })`, what becomes of a web
// page `embedder` shows asked to load `to` from `from`, `page` null before it is made, `followed` when the page follows
// a link of its own: `load`, `refuse`, or `leave`, the document staying where it is while the web engine tells who
// shows it, and the environment does as it answers whatever it answers; `attaching(embedder, session)`, whether a web
// page in `session`, `{ mod, name }` or null for one that is no mod's, is shown in `embedder`'s page;
// `windowOpen(embedder, page, { url, from, origin, activates })`, whether a web page's window.open, in `embedder`'s
// page or in a window, is given a page, one handed to `embedder` to show (told with `opened`), `from` the address it
// is at and `origin` that of the frame that opens it;
// `permits(session, origin, name)`, whether a site may have `name` in `session`, as the environment checks it, and
// `permitted(session, name)`, the origins that may. Told: `adopted(embedder, page)`, a web
// page now shown, in its page or in a window; `opened(embedder, opener, id, { url, activates })`, the page of id `id`
// the web page of id `opener` opened, handed to `embedder`, which shows it with `view`; `changed(embedder, id, state)`;
// `found(embedder, id, { matches, active, final })`; `closed(embedder, id)`, a window gone; `refused(embedder, id,
// certificate)`; `notified(embedder, id, { origin, notification, title, body, silent })`, what a site's notification
// shows, as the page told it, which answers whether it is shown; and `downloaded(embedder, { id, url, name, path,
// state, received, expected, error })`, a download a web page it shows started, as it changes, written to the Downloads
// folder: `state` is `downloading`, `finished`, `failed` or `cancelled`, and `expected` -1 while it is not known.
// Asked, each a promise of whether it is
// allowed: `shouldDownload(embedder, id, { url, name, mimeType, expected })`, whether a download the web page of that id
// started is saved, `name` the file's as the site gives it; `request(embedder, id, { origin, permissions
// })`, what a site in the web page of that id asks, `permissions` as the web engine names them
// (web/engine/model/site-permission.js), none where the environment's name for it is none of the web engine's;
// `readClipboard(embedder, id, { origin })`, the clipboard's text a site in that web page reads, null where it may not;
// `writeClipboard(embedder, id, { origin, text })`, whether it replaced the clipboard's text with `text`; and
// `requestApp(embedder, id, { url, origin })`, an app's address a site in the web page of that id goes to, which the web
// engine opens with `open.url` (WEB) where the mod lets it, a promise of whether it opened. Kept as given:
// `cookieLifetime`, the seconds a cookie a site sets with no expiry lasts in a mod's session; and `fetchLimit`, the
// bytes past which `fetch` refuses an answer.
const WEB_CLIENT = Object.freeze({
    loading: 'function',
    attaching: 'function',
    windowOpen: 'function',
    permits: 'function',
    permitted: 'function',
    adopted: 'function',
    opened: 'function',
    changed: 'function',
    found: 'function',
    closed: 'function',
    refused: 'function',
    notified: 'function',
    downloaded: 'function',
    shouldDownload: 'function',
    request: 'function',
    readClipboard: 'function',
    writeClipboard: 'function',
    requestApp: 'function',
    cookieLifetime: 'number',
    fetchLimit: 'number',
});

// What an environment gives the web engine on a mod's page.
const WEB_PAGE = Object.freeze({
    web: {
        // view({ sessions, session, url, page }, { closing, focused }) -> { element, id, close }: a web page shown in
        // this page, in the mod's session by that name, `sessions` what main told this page its mod's sessions are
        // named by (`sessionsOf`, WEB), or with `page` the id of a window handed to this page (`opened`, WEB_CLIENT).
        // `element` is put where it shows, `id` a promise of its id once it has one, and `close()` ends it, in the
        // document or never put there; the element leaving the document once in it ends it too. `closing()` when the
        // web page asks to close itself, `focused()` when it takes focus
        view: 'function',
    },
});

// MARK: - Initializer
// MARK: - Public
// MARK: - Private

export { WEB, WEB_CLIENT, WEB_PAGE };
