import * as SITE from '../../deckit-shell/web/engine/model/site.js';

// What deckit runs in a web page: in the page's own world, in every frame, the page's Notification, which deckit shows,
// and its clipboard, which the web engine reads and writes, and in deckit's, which the page does not see, what carries
// each frame's word to deckit, and in the main frame what tells deckit the page's icon and whether it plays sound,
// mutes it, and counts what find finds. A frame's word is its own origin's, and is answered in that frame. What the page's Notification shows, and
// what it asks, are told to the web engine: `notified(embedder, id, { origin, notification, title, body, silent })`,
// and `request(embedder, id, { origin, permissions })`, a promise of whether it is allowed; what it reads and writes of
// the clipboard, `readClipboard(embedder, id, { origin })`, a promise of the text or null, and
// `writeClipboard(embedder, id, { origin, text })`, a promise of whether it was written; its copy, cut and paste by
// execCommand are refused where the site may not have the clipboard. `permits(session, origin,
// name)` and `permitted(session, name)` are what the web engine says a site in a session may have, and
// `sessionOf(page)` the session a page is in.
export function createScript({ LOG, sessionOf, permits, permitted, notified, request, readClipboard, writeClipboard }) {
    // MARK: - Property
    // page id -> { install, icon, audible, muted, notifications }, `notifications` each shown, by the number deckit
    // gave it, as `{ frame, id }`, the frame that shows it and the number it has there
    const pages = new Map();
    let shownSequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // What the web engine lets sites have changed: each page's scripts are installed again with what they have now.
    function permissionsChanged() {
        for (const { install } of pages.values()) install();
    }

    // `changed()` when the page's icon or sound changes.
    function attach(embedder, page, changed) {
        const session = sessionOf(page);
        // A name of the page's own, so a page cannot easily tell deckit is listening.
        const channel = `deckit-${require('crypto').randomUUID()}`;
        const entry = { icon: '', audible: false, muted: false, notifications: new Map(), install };
        pages.set(page.id, entry);
        page.once('destroyed', () => pages.delete(page.id));
        // Also run in the document already there: the page may be under way before its scripts are. The scripts do
        // nothing the second time.
        function install() {
            const granted = Object.fromEntries(
                permitted(session, 'notifications').map((origin) => [origin, 'granted'])
            );
            const commands = {
                writes: permits(session, SITE.originOf(page.getURL()), 'clipboard-write'),
                reads: permitted(session, 'clipboard-read'),
            };
            const site = `(${inPage})(${JSON.stringify(channel)}, ${JSON.stringify(granted)}, ${JSON.stringify(commands)})`;
            const relay = `(${inRelay})(${JSON.stringify(channel)})`;
            const own = `(${inDeckit})(${entry.muted})`;
            page.run([
                { source: site, world: 'page', mainFrameOnly: false },
                { source: relay, world: 'deckit', mainFrameOnly: false },
                { source: own, world: 'deckit', mainFrameOnly: true },
            ]);
            page.evaluate(site, 'page').catch(() => {});
            page.evaluate(relay, 'deckit').catch(() => {});
            page.evaluate(own, 'deckit').catch(() => {});
            if (permits(session, SITE.originOf(page.getURL()), 'notifications'))
                page.evaluate('window.__deckitNotification?.permission(0, "granted")', 'page').catch(() => {});
        }
        install();
        // A new document starts without the last one's icon or sound; it tells its own.
        page.on('committed', () => {
            entry.icon = '';
            entry.audible = false;
            entry.notifications.clear();
        });
        return (body, frame) => heard(embedder, page, entry, body, frame, changed);
    }

    function clickNotification(page, notification) {
        const shown = pages.get(page.id)?.notifications.get(Number(notification));
        if (shown) shown.frame.evaluate(`window.__deckitNotification?.click(${shown.id})`, 'page');
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
    // `frame` is the frame that said it (deckit-web WebPage `message`).
    function heard(embedder, page, entry, body, frame, changed) {
        let message;
        try {
            message = JSON.parse(body);
        } catch {
            return;
        }
        const id = Number(message.id) || 0;
        const origin = SITE.originOf(frame.origin);
        if (message.op === 'icon') {
            entry.icon = String(message.url || '');
            changed();
        } else if (message.op === 'audible') {
            entry.audible = !!message.on;
            changed();
        } else if (message.op === 'show') {
            const notification = ++shownSequence;
            entry.notifications.set(notification, { frame, id });
            notified(embedder, page.id, {
                origin,
                notification,
                title: message.title,
                body: message.body,
                silent: message.silent,
            });
        } else if (message.op === 'request') {
            request(embedder, page.id, { origin, permissions: ['notifications'] }).then(
                (ok) =>
                    frame.evaluate(
                        `window.__deckitNotification?.permission(${id}, "${ok ? 'granted' : 'denied'}")`,
                        'page'
                    ),
                (error) => LOG.error("a site's notifications were not asked", error)
            );
        } else if (message.op === 'read' || message.op === 'write') {
            const asked =
                message.op === 'read'
                    ? readClipboard(embedder, page.id, { origin })
                    : writeClipboard(embedder, page.id, { origin, text: message.text });
            asked
                .catch((error) => {
                    LOG.error("a site's clipboard was not reached", error);
                    return message.op === 'read' ? null : false;
                })
                .then((answer) =>
                    frame.evaluate(`window.__deckitClipboard?.answer(${id}, ${JSON.stringify(answer)})`, 'page')
                );
        }
    }

    // Runs in the page's world, as source, with only its arguments: what it says crosses to deckit's world as an
    // event under `channel`.
    function inPage(channel, table, commands) {
        if (window.__deckitNotification) return;
        const say = (msg) => document.dispatchEvent(new CustomEvent(channel, { detail: JSON.stringify(msg) }));
        // The document's origin, which a frame the page made without an address has from the page.
        const origin = self.origin;
        let permission = table[origin] || 'default';
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
        // The page's clipboard is text the web engine reads and writes, refused as NotAllowedError where the site may
        // not have it: an item is written as its text, and one with no text is refused.
        const clipboard = navigator.clipboard;
        const asked = new Map();
        const reach = (op, text) =>
            new Promise((resolve, reject) => {
                const id = ++seq;
                asked.set(id, { op, resolve, reject });
                say({ op, id, text });
            });
        if (clipboard) {
            const text = async (item) => {
                if (!item || !item.types?.includes('text/plain')) throw new DOMException('No text', 'NotAllowedError');
                return (await item.getType('text/plain')).text();
            };
            const own = {
                readText: () => reach('read'),
                writeText: (data) => reach('write', String(data)),
                read: () => reach('read').then((data) => [new ClipboardItem({ 'text/plain': data })]),
                write: async (items) => reach('write', await text([...items][0])),
            };
            for (const [name, value] of Object.entries(own))
                Object.defineProperty(clipboard, name, { value, writable: true, configurable: true });
        }
        // The page's copy, cut and paste by execCommand, the engine's own, answer false and do nothing where the site
        // may not have the clipboard: `commands.writes`, and `commands.reads`, the sites that may read it, as the
        // document starts, since a command answers at once.
        const execCommand = Document.prototype.execCommand;
        const reaches = new Map([
            ['copy', () => commands.writes],
            ['cut', () => commands.writes],
            ['paste', () => commands.reads.includes(origin)],
        ]);
        Object.defineProperty(Document.prototype, 'execCommand', {
            value: function (command, ...rest) {
                const may = reaches.get(String(command).toLowerCase());
                if (may && !may()) return false;
                return execCommand.call(this, command, ...rest);
            },
            writable: true,
            configurable: true,
        });
        Object.defineProperty(window, '__deckitClipboard', {
            value: {
                answer(id, answer) {
                    const one = asked.get(id);
                    if (!one) return;
                    asked.delete(id);
                    if (answer === null || answer === false)
                        one.reject(new DOMException('The site may not reach the clipboard', 'NotAllowedError'));
                    else one.resolve(one.op === 'read' ? answer : undefined);
                },
            },
        });
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

    // Runs in deckit's world, in every frame, as source, with only its arguments: what the page's world says under
    // `channel` goes on to deckit, from the frame it is said in.
    function inRelay(channel) {
        if (window.__deckitRelay) return;
        Object.defineProperty(window, '__deckitRelay', { value: true });
        document.addEventListener(
            channel,
            (event) =>
                typeof event.detail === 'string' && window.webkit.messageHandlers.deckit.postMessage(event.detail)
        );
    }

    // Runs in deckit's world, in the main frame, as source, with only its arguments: the page's icon, whether it plays
    // sound, and its media muted while `muted`, to deckit. Only what deckit muted is let speak again.
    function inDeckit(muted) {
        if (window.__deckit) return;
        const post = (msg) => window.webkit.messageHandlers.deckit.postMessage(JSON.stringify(msg));
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
