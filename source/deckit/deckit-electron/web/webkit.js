// The web pages deckit shows on WebKit, through the module beside the core (deckit-web.node), each a page token as
// Electron's webContents is to the rest of deckit-electron: it answers the same questions and tells the same events
// of itself, so what keeps, watches and reads a page does not ask which engine shows it. `path` is the module's.
export function createWebKit({ path, LOG }) {
    // MARK: - Property
    // Above every id Electron gives a webContents, so the two never name the same page.
    const FIRST_ID = 1 << 30;
    // Chromium's code for a load another one replaced, which deckit's watches pass over, where WebKit says cancelled.
    const ABORTED = -3;
    const CANCELLED = -999;
    let module = null;
    let applicationName = null;

    // MARK: - Initializer
    // MARK: - Public
    // A page in the data store named after `partition`, a mod's session as Electron spells it. `delegate` answers what
    // the page asks: `navigate(url) -> 'load' | 'refuse' | 'leave'`, `open({ url, ownWindow, background })` and
    // `permission({ origin, permissions }) -> Promise of a boolean`.
    function make({ partition, delegate }) {
        const WEBKIT = loaded();
        const { EventEmitter } = require('events');
        const page = new EventEmitter();
        let state = { url: '', title: '', loading: false, canGoBack: false, canGoForward: false };
        let destroyed = false;
        let crashed = false;
        let muted = false;
        const native = WEBKIT.make({ store: storeOf(partition), applicationName: agentName() }, (event, payload) => {
            if (destroyed) return undefined;
            try {
                return heard(event, payload);
            } catch (error) {
                LOG.error(`a web page's ${event} failed`, error);
                return undefined;
            }
        });

        function heard(event, payload) {
            switch (event) {
                case 'changed':
                    state = payload;
                    page.emit('state-changed');
                    return undefined;
                case 'started':
                    return void page.emit('did-start-loading');
                case 'stopped':
                    return void page.emit('did-stop-loading');
                case 'committed':
                    crashed = false;
                    return void page.emit('did-navigate', {}, payload.url);
                case 'failed':
                    return void page.emit(
                        'did-fail-load',
                        {},
                        payload.code === CANCELLED ? ABORTED : payload.code,
                        payload.description,
                        payload.url,
                        true
                    );
                case 'gone':
                    crashed = true;
                    return void page.emit('render-process-gone', {}, { reason: 'crashed' });
                case 'focus':
                    return void page.emit('focus');
                case 'close':
                    return void page.emit('close');
                case 'mouse':
                    return void page.emit('input-event', {}, { type: payload.type });
                case 'key': {
                    let taken = false;
                    const told = { preventDefault: () => (taken = true) };
                    page.emit('before-input-event', told, payload);
                    return taken;
                }
                case 'navigate':
                    return delegate.navigate(payload.url);
                case 'open':
                    delegate.open(payload);
                    return undefined;
                case 'permission':
                    delegate.permission(payload).then(
                        (granted) => payload.reply(!!granted),
                        () => payload.reply(false)
                    );
                    return undefined;
                default:
                    return undefined;
            }
        }

        const id = FIRST_ID + native;
        return Object.assign(page, {
            id,
            partition,
            isWebKit: true,
            isDestroyed: () => destroyed,
            isCrashed: () => crashed,
            getURL: () => state.url,
            getTitle: () => state.title,
            isLoading: () => state.loading,
            isFocused: () => !destroyed && WEBKIT.isFocused(native),
            isCurrentlyAudible: () => false,
            isAudioMuted: () => muted,
            setAudioMuted: (on) => (muted = !!on),
            capture: () => ({ microphone: !!state.microphone, camera: !!state.camera, screen: false }),
            navigationHistory: Object.freeze({
                canGoBack: () => state.canGoBack,
                canGoForward: () => state.canGoForward,
                goBack: () => WEBKIT.go(native, 'back'),
                goForward: () => WEBKIT.go(native, 'forward'),
            }),
            loadURL: (url) => {
                if (!destroyed) WEBKIT.load(native, String(url));
                return Promise.resolve();
            },
            reload: () => WEBKIT.go(native, 'reload'),
            stop: () => WEBKIT.go(native, 'stop'),
            focus: () => !destroyed && WEBKIT.focus(native),
            place: (layout) => !destroyed && WEBKIT.place(native, layout),
            evaluate: (source) => WEBKIT.evaluate(native, source).then((json) => JSON.parse(json)),
            snapshot: () => WEBKIT.snapshot(native),
            findInPage: () => {},
            stopFindInPage: () => {},
            close: () => {
                if (destroyed) return;
                destroyed = true;
                WEBKIT.close(native);
                page.emit('destroyed');
                page.removeAllListeners();
            },
        });
    }

    // MARK: - Private
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

    // A UUID made from the partition's name, the same each run, as WebKit names a data store.
    function storeOf(partition) {
        const hash = require('crypto').createHash('sha1').update(`deckit-web:${partition}`).digest();
        hash[6] = (hash[6] & 0x0f) | 0x50;
        hash[8] = (hash[8] & 0x3f) | 0x80;
        const hex = hash.subarray(0, 16).toString('hex');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    return { make };
}
