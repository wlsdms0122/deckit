import { keyIn, storeOf } from './model/store.js';

// Every page deckit shows is WebKit's, through the module beside the core (deckit-web.node): a page of deck's, a
// surface one opened, or a web page. Each is a token that tells what becomes of it as events and answers what it is
// asked: `changed`, `started`, `stopped`, `committed` (url), `failed` (code, description, url), `gone`, `focus`,
// `close`, `mouse` (type, `mouseDown` or `mouseUp`, source), `key` (pressed, take), taken from the page once `take()` is
// called, `unhandled` (pressed, take), a key down the page did not handle, taken from the rest of the app once `take()`
// is called, and `destroyed`, once, as it closes; `source`, of `mouse` and in `pressed`, is the one an event was put
// with, and there is none on the machine's own. A key down a page shown in another (`containerOf(page)`, that page or
// null) did not handle is that page's next: a key down at its element with the keyboard, which its listeners may
// cancel, and then a key it did not handle. `path` is the module's, `folder` the system's own, which keeps the key its
// data stores are named by. `always` are scripts every document of every page starts with, beside its own, and
// `posted(page, body)` is asked of what deckit's scripts post in a page's main frame before its delegate is: true for a
// word that is its own, which the delegate is not told. `copied(text, source)` is told the text of each copy or cut key
// put into a page with `source`.
export function createWebKit({ path, folder, LOG, containerOf, always = [], posted = null, copied = null }) {
    // MARK: - Property
    // WebKit's code for a load another one replaced.
    const CANCELLED = -999;
    const pages = new Map(); // id -> page, while it is open
    let module = null;
    let applicationName = null;
    let key = null; // the system's key of its web data, once a store is named (keyIn)

    // MARK: - Initializer
    // MARK: - Public
    // A page in the data store named `store`, its session cookies lasting `cookieLifetime` seconds where
    // that is given. `scheme` is served by the page's delegate (`request`), `clear` draws nothing where the document
    // does not, `clearWhileBlank` so until it commits its first page, `fullSpeed` runs off screen as on it, and
    // `takesKeyboard` false has the keyboard only as it is given it or pressed. `delegate` answers what the page asks
    // (pageOf); `fields` are kept on the token; `scripts(page)` the scripts every document of the page starts with, as
    // `run` takes them, asked with the token before the module makes the page.
    function make({
        store,
        cookieLifetime,
        scheme,
        clear,
        clearWhileBlank,
        fullSpeed,
        takesKeyboard,
        delegate,
        fields = {},
        scripts,
    }) {
        const { page, listener } = pageOf({ delegate, fields });
        const options = {
            scripts: [...(scripts?.(page) ?? []), ...always],
            store: storeNamed(store),
            applicationName: agentName(),
            cookieLifetime,
            scheme,
            clear,
            clearWhileBlank,
            fullSpeed,
            takesKeyboard,
        };
        page.adopted(loaded().make(options, listener));
        return page;
    }

    // What the module is answered for a page WebKit makes for a window a page opened, in its opener's data store:
    // `{ listener, scripts }`, its listener and `scripts(page)`, as of `make`; `opened(page)` once the module has it.
    function listenerFor({ delegate, fields = {}, opened, scripts }) {
        const { page, listener } = pageOf({ delegate, fields, opened });
        return {
            listener: (event, payload) => (event === 'adopted' ? page.adopted(payload.id) : listener(event, payload)),
            scripts: [...(scripts?.(page) ?? []), ...always],
        };
    }

    // The page of the module's id, while it is open.
    function pageById(id) {
        return pages.get(id) || null;
    }

    // The page with the keyboard, in the window that has it, or null while another app has it.
    function focusedPage() {
        const id = loaded().focusedPage();
        return id === null || id === undefined ? null : pageById(id);
    }

    // `request` sent as the pages of the store named `store` send one, its answer refused past `limit` bytes, the
    // session cookies it is set lasting `cookieLifetime` seconds where that is given.
    function fetch(store, request, { limit, cookieLifetime }) {
        return loaded().fetch(storeNamed(store), request, { limit, applicationName: agentName(), cookieLifetime });
    }

    // A download a page started, stopped where it is still under way.
    function cancelDownload(id) {
        loaded().cancelDownload(id);
    }

    // What the store named `store` kept, taken.
    function clear(store) {
        return loaded().clear(storeNamed(store));
    }

    // The module itself, for the windows and stages pages are laid in.
    function native() {
        return loaded();
    }

    // MARK: - Private
    // A page and the listener the module tells it through, before the module has given it its id. `delegate`:
    // `navigate(url) -> 'load' | 'refuse' | 'leave'`; `open({ url, ownWindow, background, width, height, origin })`,
    // what `listenerFor` answers for the page given for the window, or nothing; `download({ url })`, the listener of
    // the download (deckit-web WebDownload), or nothing to cancel it; `permission({ origin, permissions }) -> Promise
    // of a boolean`;
    // `certificate(info) -> boolean`, whether it is trusted; `external({ url, origin })`, `origin`, as of `open`, the
    // frame's that goes there, or nothing where no frame does; `message(body, frame) -> boolean`, what deckit's scripts
    // post in any frame, `frame` `{ origin, main, evaluate(source, world), answer(text) }`: `evaluate` runs `source` in
    // that frame, its value dropped, and `answer` is the value of the post's promise, which runs no script in the page;
    // true for a message answered later, any other answered null at once; and, for a page with a scheme of its own,
    // `request({ url, method, body, reply })`.
    function pageOf({ delegate, fields, opened = null }) {
        const WEBKIT = loaded();
        const { EventEmitter } = require('events');
        const page = new EventEmitter();
        let state = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false, blank: true };
        let destroyed = false;
        let crashed = false;
        const can = () => !destroyed && page.id !== null;

        function heard(event, payload) {
            switch (event) {
                case 'changed':
                    state = payload;
                    return void page.emit('changed');
                case 'started':
                case 'stopped':
                case 'focus':
                case 'close':
                    return void page.emit(event);
                case 'committed':
                    crashed = false;
                    return void page.emit('committed', payload.url);
                case 'failed':
                    if (payload.code === CANCELLED) return undefined;
                    return void page.emit('failed', payload.code, payload.description, payload.url);
                case 'gone':
                    crashed = true;
                    return void page.emit('gone');
                case 'mouse':
                    return void page.emit('mouse', payload.type, payload.source);
                case 'key': {
                    let taken = false;
                    page.emit('key', payload, () => (taken = true));
                    return taken;
                }
                case 'unhandled': {
                    const { reply, ...pressed } = payload;
                    return void passOn(page, pressed, reply);
                }
                case 'clipboard':
                    return void copied?.(payload.text, payload.source);
                case 'message': {
                    const { body, ...frame } = payload;
                    if (frame.main && posted?.(page, body)) return false;
                    return delegate.message?.(body, frame) === true;
                }
                case 'request':
                    // A request the delegate throws on at once is answered as failed, so nothing waits on it; a
                    // second reply is dropped.
                    try {
                        return void delegate.request(payload);
                    } catch (error) {
                        payload.reply({ status: 500, body: '' });
                        throw error;
                    }
                case 'external':
                    return void delegate.external?.(payload);
                case 'navigate':
                    return delegate.navigate?.(payload.url) ?? 'load';
                case 'open':
                    return delegate.open?.(payload) || undefined;
                case 'download':
                    return delegate.download?.(payload) || undefined;
                case 'certificate':
                    return !!delegate.certificate?.(payload);
                case 'permission':
                    Promise.resolve(delegate.permission?.(payload) ?? false).then(
                        (granted) => payload.reply(!!granted),
                        () => payload.reply(false)
                    );
                    return undefined;
                case 'dialog':
                case 'picker': {
                    // `dialog(page, question)` answers what the page is replied, of its dialog, `{ kind, message,
                    // value, origin }`, or of its picker, `{ kind, name, options, rect, origin }`, `kind` `select`, which it
                    // does not wait on; no member, or a rejection, replies the refusal.
                    const { reply, ...question } = payload;
                    Promise.resolve(delegate.dialog?.(page, question)).then(
                        (answer) => reply(answer),
                        () => reply()
                    );
                    return undefined;
                }
                default:
                    return undefined;
            }
        }

        const listener = (event, payload) => {
            if (destroyed) return undefined;
            try {
                return heard(event, payload);
            } catch (error) {
                LOG.error(`a page's ${event} failed`, error);
                return undefined;
            }
        };
        Object.assign(page, fields, {
            id: null,
            delegate,
            adopted: (id) => {
                page.id = id;
                pages.set(id, page);
                opened?.(page);
            },
            isDestroyed: () => destroyed,
            isCrashed: () => crashed,
            getURL: () => state.url,
            getTitle: () => state.title,
            isLoading: () => state.loading,
            // Whether it has shown no page yet.
            isBlank: () => state.blank,
            isFocused: () => can() && WEBKIT.isFocused(page.id),
            capture: () => ({ microphone: !!state.microphone, camera: !!state.camera, screen: false }),
            navigationHistory: Object.freeze({
                canGoBack: () => state.canGoBack,
                canGoForward: () => state.canGoForward,
                goBack: () => can() && WEBKIT.go(page.id, 'back'),
                goForward: () => can() && WEBKIT.go(page.id, 'forward'),
            }),
            // Spelled as WebKit spells what it loads, so the module knows the load it asked for.
            loadURL: (url) => {
                if (can()) WEBKIT.load(page.id, spelled(url));
                return Promise.resolve();
            },
            reload: () => can() && WEBKIT.go(page.id, 'reload'),
            stop: () => can() && WEBKIT.go(page.id, 'stop'),
            focus: () => can() && WEBKIT.focus(page.id),
            droppedFiles: () => (can() ? WEBKIT.droppedFiles(page.id) : []),
            run: (scripts) => can() && WEBKIT.run(page.id, [...scripts, ...always]),
            evaluate: (source, world = 'page') =>
                can()
                    ? WEBKIT.evaluate(page.id, source, world).then((json) => JSON.parse(json))
                    : Promise.resolve(null),
            find: (text, options) => (can() ? WEBKIT.find(page.id, String(text), options) : Promise.resolve(false)),
            close: () => {
                if (destroyed) return;
                destroyed = true;
                if (page.id !== null) {
                    WEBKIT.close(page.id);
                    pages.delete(page.id);
                }
                page.emit('destroyed');
                page.removeAllListeners();
            },
        });
        return { page, listener };
    }

    // `pressed`, a key down `page` did not handle, to the page it is shown in, or else told as its own: `reply(taken)`
    // answers whether it is taken from the rest of the app.
    function passOn(page, pressed, reply) {
        const container = containerOf(page);
        if (!container) {
            let taken = false;
            try {
                page.emit('unhandled', pressed, () => (taken = true));
            } finally {
                reply(taken);
            }
            return;
        }
        container.evaluate(keyDown(pressed), 'deckit').then(
            (cancelled) => (cancelled ? reply(true) : passOn(container, pressed, reply)),
            () => reply(false)
        );
    }

    // A key down at the element with the keyboard, as the document's listeners hear one: whether one cancelled it.
    function keyDown({ code, key, meta, control, alt, shift }) {
        const options = {
            code,
            key,
            metaKey: meta,
            ctrlKey: control,
            altKey: alt,
            shiftKey: shift,
            bubbles: true,
            cancelable: true,
            composed: true,
        };
        return `const event = new KeyboardEvent('keydown', ${JSON.stringify(options)});
            (document.activeElement ?? document).dispatchEvent(event);
            return event.defaultPrevented;`;
    }

    function spelled(url) {
        try {
            return new URL(String(url)).href;
        } catch {
            return String(url);
        }
    }

    // The data store of this system named `name`: one of its own, apart from every other system's (keyIn).
    function storeNamed(name) {
        key ??= keyIn(folder);
        return storeOf(key, name);
    }

    function loaded() {
        if (!module) {
            const holder = { exports: {} };
            process.dlopen(holder, path);
            module = holder.exports;
        }
        return module;
    }

    // What WebKit adds to its user agent, as Safari does, the WebKit it shows pages on being Safari's.
    function agentName() {
        applicationName ??= (() => {
            const version = loaded().safariVersion();
            return version ? `Version/${version} Safari/605.1.15` : '';
        })();
        return applicationName;
    }

    return { make, listenerFor, pageById, focusedPage, fetch, cancelDownload, clear, native };
}
