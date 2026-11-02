// Every page deckit shows is WebKit's, through the module beside the core (deckit-web.node): a page of deck's, a
// surface one opened, or a web page. Each is a token that tells what becomes of it as events and answers what it is
// asked: `changed`, `started`, `stopped`, `committed` (url), `failed` (code, description), `gone`, `focus`, `close`,
// `mouse` (type, `mouseDown` or `mouseUp`), `key` (pressed, take), taken from the page once `take()` is called, and
// `destroyed`, once, as it closes. `path` is the module's.
export function createWebKit({ path, LOG }) {
    // MARK: - Property
    // WebKit's code for a load another one replaced.
    const CANCELLED = -999;
    const pages = new Map(); // id -> page, while it is open
    let module = null;
    let applicationName = null;

    // MARK: - Initializer
    // MARK: - Public
    // A page in the data store `store`, a UUID (storeOf), its session cookies lasting `cookieLifetime` seconds where
    // that is given. `scheme` is served by the page's delegate (`request`), `clear` draws nothing where the document
    // does not, and `fullSpeed` runs off screen as on it. `delegate` answers what the page asks (pageOf); `fields` are
    // kept on the token.
    function make({ store, cookieLifetime, scheme, clear, fullSpeed, delegate, fields = {} }) {
        const { page, listener } = pageOf({ delegate, fields });
        const options = { store, applicationName: agentName(), cookieLifetime, scheme, clear, fullSpeed };
        page.adopted(loaded().make(options, listener));
        return page;
    }

    // The listener of a page WebKit makes for a window a page opened, in its opener's data store: `opened(page)`
    // once the module has it.
    function listenerFor({ delegate, fields = {}, opened }) {
        const { page, listener } = pageOf({ delegate, fields, opened });
        return (event, payload) => (event === 'adopted' ? page.adopted(payload.id) : listener(event, payload));
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

    // The text at `url`, asked as the pages of `store` ask, refused past `limit` bytes.
    function fetchText(store, url, limit) {
        return loaded().fetchText(store, String(url), { limit, applicationName: agentName() });
    }

    // What `store` kept, taken.
    function clear(store) {
        return loaded().clear(store);
    }

    // The module itself, for the windows and stages pages are laid in.
    function native() {
        return loaded();
    }

    // MARK: - Private
    // A page and the listener the module tells it through, before the module has given it its id. `delegate`:
    // `navigate(url) -> 'load' | 'refuse' | 'leave'`; `open({ url, ownWindow, background, width, height })`, the
    // listener of the page given for the window, or nothing; `permission({ origin, permissions }) -> Promise of a
    // boolean`; `certificate(info) -> boolean`, whether it is trusted; `external(url)`; `message(body)`; and, for a
    // page with a scheme of its own, `request({ url, method, body, reply })`.
    function pageOf({ delegate, fields, opened = null }) {
        const WEBKIT = loaded();
        const { EventEmitter } = require('events');
        const page = new EventEmitter();
        let state = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false };
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
                    return void page.emit('failed', payload.code, payload.description);
                case 'gone':
                    crashed = true;
                    return void page.emit('gone');
                case 'mouse':
                    return void page.emit('mouse', payload.type);
                case 'key': {
                    let taken = false;
                    page.emit('key', payload, () => (taken = true));
                    return taken;
                }
                case 'message':
                    return void delegate.message?.(payload.body);
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
                    return void delegate.external?.(payload.url);
                case 'navigate':
                    return delegate.navigate?.(payload.url) ?? 'load';
                case 'open':
                    return delegate.open?.(payload) || undefined;
                case 'certificate':
                    return !!delegate.certificate?.(payload);
                case 'permission':
                    Promise.resolve(delegate.permission?.(payload) ?? false).then(
                        (granted) => payload.reply(!!granted),
                        () => payload.reply(false)
                    );
                    return undefined;
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
            run: (scripts) => can() && WEBKIT.run(page.id, scripts),
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

    function spelled(url) {
        try {
            return new URL(String(url)).href;
        } catch {
            return String(url);
        }
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

    return { make, listenerFor, pageById, focusedPage, fetchText, clear, native };
}

// A UUID made from `name`, the same each run, as WebKit names a data store.
export function storeOf(name) {
    const hash = require('crypto').createHash('sha1').update(`deckit-web:${name}`).digest();
    hash[6] = (hash[6] & 0x0f) | 0x50;
    hash[8] = (hash[8] & 0x3f) | 0x80;
    const hex = hash.subarray(0, 16).toString('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
