import * as SITE from '../../deckit-shell/deckit/web/model/site.js';

// What deckit runs in a web page: in the page's own world, the page's Notification, which deckit shows, and in
// deckit's, which the page does not see, what tells deckit the page's icon and whether it plays sound, mutes it, and
// counts what find finds. What the page's Notification shows, and what it asks, are told to deck: `notified(embedder,
// id, { origin, notification, title, body, silent })`, and `request(embedder, id, { origin, permissions })`, a promise
// of whether it is allowed. `permits(session, origin, name)` and `permitted(session, name)` are what deck says a site
// in a session may have, and `sessionOf(page)` the session a page is in.
export function createScript({ LOG, sessionOf, permits, permitted, notified, request }) {
    // MARK: - Property
    const pages = new Map(); // page id -> { install, icon, audible, muted }

    // MARK: - Initializer
    // MARK: - Public
    // What deck lets sites have changed: each page's scripts are installed again with what they have now.
    function permissionsChanged() {
        for (const { install } of pages.values()) install();
    }

    // `changed()` when the page's icon or sound changes.
    function attach(embedder, page, changed) {
        const session = sessionOf(page);
        // A name of the page's own, so a page cannot easily tell deckit is listening.
        const channel = `deckit-${require('crypto').randomUUID()}`;
        const entry = { icon: '', audible: false, muted: false, install };
        pages.set(page.id, entry);
        page.once('destroyed', () => pages.delete(page.id));
        // Also run in the document already there: the page may be under way before its scripts are. The scripts do
        // nothing the second time.
        function install() {
            const granted = Object.fromEntries(
                permitted(session, 'notifications').map((origin) => [origin, 'granted'])
            );
            const notifications = `(${inPage})(${JSON.stringify(channel)}, ${JSON.stringify(granted)})`;
            const own = `(${inDeckit})(${JSON.stringify(channel)}, ${entry.muted})`;
            page.run([
                { source: notifications, world: 'page', mainFrameOnly: true },
                { source: own, world: 'deckit', mainFrameOnly: true },
            ]);
            page.evaluate(notifications, 'page').catch(() => {});
            page.evaluate(own, 'deckit').catch(() => {});
            if (permits(session, SITE.originOf(page.getURL()), 'notifications'))
                page.evaluate('window.__deckitNotification?.permission(0, "granted")', 'page').catch(() => {});
        }
        install();
        // A new document starts without the last one's icon or sound; it tells its own.
        page.on('committed', () => {
            entry.icon = '';
            entry.audible = false;
        });
        return (body) => heard(embedder, page, entry, body, changed);
    }

    function clickNotification(page, id) {
        page.evaluate(`window.__deckitNotification?.click(${Number(id) || 0})`, 'page').catch(() => {});
    }

    // Muted stays with the page, its next documents included.
    function setMuted(page, on) {
        const entry = pages.get(page.id);
        if (!entry || entry.muted === !!on) return;
        entry.muted = !!on;
        entry.install();
        page.evaluate(`window.__deckit?.mute(${entry.muted})`, 'deckit').catch(() => {});
    }

    // How many times `text` is in the page's text.
    function count(page, text, matchCase) {
        return page
            .evaluate(`return window.__deckit?.count(${JSON.stringify(String(text))}, ${!!matchCase}) ?? 0`, 'deckit')
            .then(
                (found) => Number(found) || 0,
                () => 0
            );
    }

    function stateOf(page) {
        const entry = pages.get(page.id);
        return { icon: entry?.icon || '', audible: !!entry?.audible, muted: !!entry?.muted };
    }

    // MARK: - Private
    function heard(embedder, page, entry, body, changed) {
        let message;
        try {
            message = JSON.parse(body);
        } catch {
            return;
        }
        const id = Number(message.id) || 0;
        const origin = SITE.originOf(page.getURL());
        if (message.op === 'icon') {
            entry.icon = String(message.url || '');
            changed();
        } else if (message.op === 'audible') {
            entry.audible = !!message.on;
            changed();
        } else if (message.op === 'show') {
            notified(embedder, page.id, {
                origin,
                notification: id,
                title: String(message.title),
                body: String(message.body),
                silent: !!message.silent,
            });
        } else if (message.op === 'request') {
            request(embedder, page.id, { origin, permissions: ['notifications'] }).then(
                (ok) =>
                    page
                        .evaluate(
                            `window.__deckitNotification?.permission(${id}, "${ok ? 'granted' : 'denied'}")`,
                            'page'
                        )
                        .catch(() => {}),
                (error) => LOG.error("a site's notifications were not asked", error)
            );
        }
    }

    // Runs in the page's world, as source, with only its arguments: what it says crosses to deckit's world as an
    // event under `channel`.
    function inPage(channel, table) {
        if (window.__deckitNotification) return;
        const say = (msg) => document.dispatchEvent(new CustomEvent(channel, { detail: JSON.stringify(msg) }));
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

    // Runs in deckit's world, as source, with only its arguments: what the page's world says under `channel` goes on
    // to deckit, with the page's icon, whether it plays sound, and its media muted while `muted`. Only what deckit
    // muted is let speak again.
    function inDeckit(channel, muted) {
        if (window.__deckit) return;
        const post = (msg) => window.webkit.messageHandlers.deckit.postMessage(JSON.stringify(msg));
        document.addEventListener(
            channel,
            (event) => typeof event.detail === 'string' && post(JSON.parse(event.detail))
        );
        let mute = muted;
        let audible = false;
        let icon = null;
        const silenced = new WeakSet();
        const media = () => document.querySelectorAll('audio, video');
        const quiet = (el) => {
            if (!mute || el.muted) return;
            el.muted = true;
            silenced.add(el);
        };
        const report = () => {
            const on = [...media()].some((el) => !el.paused && !el.muted && el.volume > 0 && el.readyState > 2);
            if (on === audible) return;
            audible = on;
            post({ op: 'audible', on });
        };
        for (const type of ['play', 'playing', 'pause', 'ended', 'volumechange', 'emptied'])
            document.addEventListener(
                type,
                (event) => {
                    if (!(event.target instanceof HTMLMediaElement)) return;
                    quiet(event.target);
                    report();
                },
                true
            );
        const tellIcon = () => {
            const link = [...document.querySelectorAll('link[rel][href]')].find((each) =>
                /(^|\s)icon(\s|$)/i.test(each.rel)
            );
            const url = link ? link.href : /^https?:$/.test(location.protocol) ? location.origin + '/favicon.ico' : '';
            if (url === icon) return;
            icon = url;
            post({ op: 'icon', url });
        };
        const watchIcon = () => {
            tellIcon();
            new MutationObserver(tellIcon).observe(document.head || document.documentElement, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['href', 'rel'],
            });
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchIcon);
        else watchIcon();
        Object.defineProperty(window, '__deckit', {
            value: {
                mute(on) {
                    mute = on;
                    for (const el of media()) {
                        if (on) quiet(el);
                        else if (silenced.delete(el)) el.muted = false;
                    }
                    report();
                },
                count(text, matchCase) {
                    if (!text) return 0;
                    const haystack = matchCase
                        ? document.body?.innerText || ''
                        : (document.body?.innerText || '').toLowerCase();
                    const needle = matchCase ? text : text.toLowerCase();
                    let found = 0;
                    for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length))
                        found++;
                    return found;
                },
            },
        });
    }

    return { permissionsChanged, attach, clickNotification, setMuted, count, stateOf };
}
