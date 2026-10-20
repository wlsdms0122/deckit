import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = IPC.bindAll(DECLARED);

export function createScript({ LOG, DEBUGGER, SESSION, SITE_PERMISSION }) {
    // MARK: - Property
    // Electron's own notification knows nothing of the page, so the page's Notification is replaced by a content
    // script, which reports through a binding only the DevTools session hears. Chromium does not tell an
    // embedder what a page captures, so its capture calls are watched there too. Neither covers a service
    // worker or a frame inside the page.
    const BINDING = '__deckitPage';
    const NOT_CAPTURING = { microphone: false, camera: false, screen: false };
    const scripts = new Map(); // page id -> installs the script again with the grants now
    const capturing = new Map(); // page id -> { microphone, camera, screen }, as the page reports

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        SITE_PERMISSION.onChange(() => {
            for (const install of scripts.values()) install();
        });
    }

    function attach(embedder, page, changed) {
        const partition = SESSION.partitionOf(page);
        const allowed = (origin) => SITE_PERMISSION.granted(partition, origin, 'notifications');
        const evaluate = (expression) =>
            DEBUGGER.send(page, 'Runtime.evaluate', { expression, userGesture: true }).catch(() => {});
        let script = null;
        // Also run in the document already there: it is usually under way before the session is. The script
        // does nothing the second time.
        const install = () => {
            const source = `(${inPage})(${JSON.stringify(BINDING)}, ${JSON.stringify(SITE_PERMISSION.notifications(partition))})`;
            const dropped = script
                ? DEBUGGER.send(page, 'Page.removeScriptToEvaluateOnNewDocument', { identifier: script })
                : Promise.resolve();
            return dropped
                .then(() => DEBUGGER.send(page, 'Page.addScriptToEvaluateOnNewDocument', { source }))
                .then((added) => (script = added.identifier))
                .then(() => evaluate(source))
                .catch(() => {});
        };
        scripts.set(page.id, () => {
            install();
            if (allowed(SITE_PERMISSION.originOf(page.getURL())))
                evaluate('window.__deckitNotification?.permission(0, "granted")');
        });
        page.once('destroyed', () => {
            scripts.delete(page.id);
            capturing.delete(page.id);
        });

        DEBUGGER.on(page, (method, params, sessionId) => {
            if (method !== 'Runtime.bindingCalled' || sessionId || params?.name !== BINDING) return;
            const message = JSON.parse(params.payload);
            const id = Number(message.id) || 0;
            const origin = SITE_PERMISSION.originOf(page.getURL());
            if (message.op === 'capture') {
                capturing.set(page.id, {
                    microphone: !!message.microphone,
                    camera: !!message.camera,
                    screen: !!message.screen,
                });
                changed();
            } else if (message.op === 'show' && allowed(origin)) {
                PROTOCOL.notified.send(embedder, {
                    id: page.id,
                    notification: id,
                    title: String(message.title).slice(0, 200),
                    body: String(message.body).slice(0, 400),
                    silent: !!message.silent,
                });
            } else if (message.op === 'request') {
                SITE_PERMISSION.ask(embedder, page, origin, ['notifications']).then((ok) =>
                    evaluate(`window.__deckitNotification?.permission(${id}, "${ok ? 'granted' : 'denied'}")`)
                );
            }
        });

        // A binding reaches later documents only while Runtime is enabled, which a page can detect (sign-in and
        // bot checks look for it), so Runtime stays off and each new document is bound.
        const bind = () =>
            DEBUGGER.send(page, 'Runtime.removeBinding', { name: BINDING })
                .catch(() => {})
                .then(() => DEBUGGER.send(page, 'Runtime.addBinding', { name: BINDING }));
        page.on('did-navigate', () => bind().catch(() => {}));
        // A page that has not started loading has no document to talk to yet.
        const arm = () =>
            DEBUGGER.send(page, 'Page.enable')
                .then(bind)
                .then(install)
                .catch((error) => LOG.error("a page's notifications and capture stay the page's own", error));
        if (page.getURL() || page.isLoading()) arm();
        else page.once('did-start-loading', arm);
    }

    function clickNotification(page, id) {
        DEBUGGER.send(page, 'Runtime.evaluate', {
            expression: `window.__deckitNotification?.click(${Number(id) || 0})`,
            userGesture: true,
        }).catch(() => {});
    }

    function captureOf(id) {
        return { ...(capturing.get(id) || NOT_CAPTURING) };
    }

    function forget(id) {
        capturing.delete(id);
    }

    // MARK: - Private
    // Runs in the page, as source. Everything it needs is in its arguments.
    function inPage(binding, table) {
        if (window.__deckitNotification) return;
        // The binding may arrive after the page's first script, so messages wait for it.
        let call = null,
            retry = 0;
        const outbox = [];
        const flush = () => {
            if (!call && typeof window[binding] === 'function') {
                call = window[binding];
                try {
                    delete window[binding];
                } catch {}
            }
            if (!call) {
                if (outbox.length && !retry)
                    retry = setTimeout(() => {
                        retry = 0;
                        flush();
                    }, 100);
                return;
            }
            while (outbox.length) call(outbox.shift());
        };
        const say = (msg) => {
            outbox.push(JSON.stringify(msg));
            flush();
        };
        flush();
        let permission = table[location.origin] || 'default';
        let seq = 0;
        const ids = new WeakMap(),
            live = new Map(),
            waiting = new Map();
        const fire = (n, type) => {
            const ev = new Event(type);
            n.dispatchEvent(ev);
            const fn = n['on' + type];
            if (typeof fn === 'function') {
                try {
                    fn.call(n, ev);
                } catch (err) {
                    setTimeout(() => {
                        throw err;
                    });
                }
            }
        };
        class Notification extends EventTarget {
            constructor(title, options) {
                super();
                if (arguments.length === 0) {
                    throw new TypeError("Failed to construct 'Notification': 1 argument required, but only 0 present.");
                }
                const o = options || {};
                Object.assign(this, {
                    title: String(title),
                    body: String(o.body || ''),
                    tag: String(o.tag || ''),
                    icon: String(o.icon || ''),
                    badge: String(o.badge || ''),
                    image: String(o.image || ''),
                    lang: String(o.lang || ''),
                    dir: o.dir || 'auto',
                    data: o.data === undefined ? null : o.data,
                    silent: !!o.silent,
                    renotify: !!o.renotify,
                    requireInteraction: !!o.requireInteraction,
                    timestamp: o.timestamp || Date.now(),
                    actions: [],
                    onclick: null,
                    onshow: null,
                    onerror: null,
                    onclose: null,
                });
                const id = ++seq;
                ids.set(this, id);
                setTimeout(() => {
                    if (permission !== 'granted') return fire(this, 'error');
                    live.set(id, this);
                    say({ op: 'show', id, title: this.title, body: this.body, silent: this.silent });
                    fire(this, 'show');
                });
            }
            close() {
                const id = ids.get(this);
                if (!live.delete(id)) return;
                fire(this, 'close');
            }
            static get permission() {
                return permission;
            }
            static get maxActions() {
                return 2;
            }
            static requestPermission(callback) {
                const answer =
                    permission !== 'default'
                        ? Promise.resolve(permission)
                        : new Promise((resolve) => {
                              const id = ++seq;
                              waiting.set(id, resolve);
                              say({ op: 'request', id });
                          });
                if (typeof callback === 'function') answer.then(callback);
                return answer;
            }
        }
        Object.defineProperty(window, 'Notification', { value: Notification, writable: true, configurable: true });
        const perms = navigator.permissions;
        if (perms && typeof perms.query === 'function') {
            const query = perms.query.bind(perms);
            perms.query = (desc) =>
                desc && desc.name === 'notifications'
                    ? Promise.resolve(
                          Object.assign(new EventTarget(), {
                              name: 'notifications',
                              onchange: null,
                              state: permission === 'default' ? 'prompt' : permission,
                          })
                      )
                    : query(desc);
        }
        const tracks = new Map(); // track -> "microphone" | "camera" | "screen"
        let reported = '';
        const reportCapture = () => {
            const on = { microphone: false, camera: false, screen: false };
            for (const [track, kind] of tracks) {
                if (track.readyState === 'live') on[kind] = true;
                else tracks.delete(track);
            }
            const sig = JSON.stringify(on);
            if (sig === reported) return;
            reported = sig;
            say({ op: 'capture', ...on });
        };
        const watch = (track, kind) => {
            tracks.set(track, kind);
            track.addEventListener('ended', reportCapture);
        };
        const devices = navigator.mediaDevices && Object.getPrototypeOf(navigator.mediaDevices);
        for (const [name, screen] of [
            ['getUserMedia', false],
            ['getDisplayMedia', true],
        ]) {
            const original = devices && devices[name];
            if (typeof original !== 'function') continue;
            Object.defineProperty(devices, name, {
                configurable: true,
                writable: true,
                value: function (...args) {
                    return original.apply(this, args).then((stream) => {
                        for (const t of stream.getTracks())
                            watch(t, screen ? 'screen' : t.kind === 'audio' ? 'microphone' : 'camera');
                        reportCapture();
                        return stream;
                    });
                },
            });
        }
        const track = window.MediaStreamTrack && MediaStreamTrack.prototype;
        if (track) {
            const stop = track.stop,
                clone = track.clone;
            track.stop = function () {
                const r = stop.apply(this, arguments);
                if (tracks.delete(this)) reportCapture();
                return r;
            };
            track.clone = function () {
                const copy = clone.apply(this, arguments);
                const kind = tracks.get(this);
                if (kind) watch(copy, kind);
                return copy;
            };
        }
        Object.defineProperty(window, '__deckitNotification', {
            value: {
                click(id) {
                    const n = live.get(id);
                    if (n) fire(n, 'click');
                },
                // id 0 is news for the page as a whole (a grant made in another tab), not an answer.
                permission(id, state) {
                    if (id === 0 && permission !== 'default') return;
                    permission = state;
                    const resolve = waiting.get(id);
                    if (resolve) {
                        waiting.delete(id);
                        resolve(state);
                    }
                },
            },
        });
    }

    return { start, attach, clickNotification, captureOf, forget };
}
