import * as SITE from '../../deckit-shell/web/engine/model/site.js';

// What deckit runs in a web page: in the page's own world, in every frame, the page's Notification, which deckit shows,
// and its clipboard, which the web engine reads and writes, and in deckit's, which the page does not see, what carries
// each frame's word to deckit, and in the main frame what tells deckit the page's icon and whether it plays sound,
// mutes it, counts what find finds and clears the selection. A frame's word is its own origin's, and what it asks is
// answered in that frame by the reply to its word. What deckit tells a document, the news that its site may have
// notifications, a click on a notification it shows, and what the main frame is asked, is the reply to a word the
// document said that waits for it: a reply runs no script, so what deckit tells gives the page no user activation, as
// the web platform gives none for any of it; a yes to take the screen alone is run as a script (`display`). The scripts
// are run once in the document the page has as deckit takes it, which starts before them. What the page's Notification
// shows, and what it asks, are told to the web engine: `notified(embedder, id, { origin, notification, title, body,
// silent })`, and `request(embedder, id, { origin, permissions })`, a promise of whether it is allowed; what it reads
// and writes of the clipboard, `readClipboard(embedder, id, { origin })`, a promise of the text or null, and
// `writeClipboard(embedder, id, { origin, text })`, a promise of whether it was written; its copy, cut and paste by
// execCommand are refused where the site may not have the clipboard. `permits(session, origin, name)` and
// `permitted(session, name)` are what the web engine says a site in a session may have, and `sessionOf(page)` the
// session a page is in.
export function createScript({ LOG, sessionOf, permits, permitted, notified, request, readClipboard, writeClipboard }) {
    // MARK: - Property
    // page id -> { session, install, icon, audible, muted, notifications, news, own }: `notifications` each shown, by
    // the number deckit gave it, as `{ frame, id }`, the frame that shows it and its word, answered as it is clicked;
    // `news` the words `{ frame, id, origin }` of each document that waits to hear its site may have notifications;
    // `own` what the main frame is asked, `{ frame, awaiting, queue, sent, counts, sequence }`, `frame` the one whose
    // word waits for it, `awaiting` true while its document acts on what it was told, and each count by its number
    const pages = new Map();
    let shownSequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // What the web engine lets sites have changed: each page's scripts are installed again with what they have now,
    // and each document that waits for it hears its site may have notifications.
    function permissionsChanged() {
        for (const entry of pages.values()) {
            entry.install();
            tellNews(entry);
        }
    }

    // `changed()` when the page's icon or sound changes.
    function attach(embedder, page, changed) {
        const session = sessionOf(page);
        // A name of the page's own, so a page cannot easily tell deckit is listening.
        const channel = `deckit-${require('crypto').randomUUID()}`;
        const entry = {
            session,
            icon: '',
            audible: false,
            muted: false,
            notifications: new Map(),
            news: [],
            own: freshOwn(),
            channel,
            install: () => page.run(scripts()),
        };
        pages.set(page.id, entry);
        page.once('destroyed', () => {
            pages.delete(page.id);
            for (const resolve of entry.own.counts.values()) resolve(0);
        });
        // The scripts every document of the page starts with.
        function scripts() {
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
            return [
                { source: site, world: 'page', mainFrameOnly: false },
                { source: relay, world: 'deckit', mainFrameOnly: false },
                { source: own, world: 'deckit', mainFrameOnly: true },
            ];
        }
        // Also run in the document already there, which may be under way before its scripts are: the one script
        // deckit runs in a page. The scripts do nothing a second time.
        const first = scripts();
        page.run(first);
        for (const { source, world } of first) page.evaluate(source, world).catch(() => {});
        // A new document starts without the last one's icon or sound; it tells its own. The words of the last one's
        // documents are let go, as they are gone, and what its main frame was asked to count is none.
        page.on('committed', () => {
            entry.icon = '';
            entry.audible = false;
            entry.notifications.clear();
            entry.news = [];
            for (const resolve of entry.own.counts.values()) resolve(0);
            entry.own = freshOwn();
        });
        return (body, frame) => heard(embedder, page, entry, body, frame, changed);
    }

    // A notification is clicked once, in the frame that shows it.
    function clickNotification(page, notification) {
        const entry = pages.get(page.id);
        const shown = entry?.notifications.get(Number(notification));
        if (!shown) return;
        entry.notifications.delete(Number(notification));
        shown.frame.answer(JSON.stringify({ id: shown.id, answer: true }));
    }

    // Muted stays with the page, its next documents included.
    function setMuted(page, on) {
        const entry = pages.get(page.id);
        if (!entry || entry.muted === !!on) return;
        entry.muted = !!on;
        entry.install();
        askMain(entry, { op: 'mute', on: entry.muted });
    }

    // How many times `text` is in the page's text: none in a document that runs none of deckit's scripts.
    function count(page, text, matchCase) {
        const entry = pages.get(page.id);
        if (!entry) return Promise.resolve(0);
        const n = ++entry.own.sequence;
        return new Promise((resolve) => {
            if (!askMain(entry, { op: 'count', n, text: String(text), matchCase: !!matchCase })) return resolve(0);
            entry.own.counts.set(n, resolve);
        });
    }

    function unselect(page) {
        const entry = pages.get(page.id);
        if (entry) askMain(entry, { op: 'unselect' });
    }

    function stateOf(page) {
        const entry = pages.get(page.id);
        return { icon: entry?.icon || '', audible: !!entry?.audible, muted: !!entry?.muted };
    }

    // MARK: - Private
    function freshOwn() {
        return { frame: null, awaiting: false, queue: [], sent: [], counts: new Map(), sequence: 0 };
    }

    // `asked` of the main frame's document, told with the next reply to its word: whether one waits for it, as none
    // does in a document that runs none of deckit's scripts.
    function askMain(entry, asked) {
        const own = entry.own;
        if (!own.frame && !own.awaiting) return false;
        own.queue.push(asked);
        tellMain(own);
        return true;
    }

    function tellMain(own) {
        if (!own.frame || !own.queue.length) return;
        const told = own.queue;
        own.queue = [];
        own.sent = told.flatMap((asked) => (asked.op === 'count' ? [asked.n] : []));
        own.frame.answer(JSON.stringify(told));
        own.frame = null;
        own.awaiting = true;
    }

    // Each document that waits for the news and whose site may now have notifications hears it.
    function tellNews(entry) {
        entry.news = entry.news.filter(({ frame, id, origin }) => {
            if (!permits(entry.session, origin, 'notifications')) return true;
            frame.answer(JSON.stringify({ id, answer: 'granted' }));
            return false;
        });
    }

    // `frame` is the frame that said it (deckit-web WebPage `message`): what it asks is answered by `frame.answer`,
    // which runs no script in the page and so gives it no user activation. Whether it is answered later.
    function heard(embedder, page, entry, body, frame, changed) {
        let message;
        try {
            message = JSON.parse(body);
        } catch {
            return false;
        }
        const id = Number(message.id) || 0;
        const origin = SITE.originOf(frame.origin);
        const answer = (asked, failed, refusal) =>
            asked
                .catch((error) => {
                    LOG.error(failed, error);
                    return refusal;
                })
                .then((value) => frame.answer(JSON.stringify({ id, answer: value })));
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
            return true;
        } else if (message.op === 'news') {
            entry.news.push({ frame, id, origin });
            tellNews(entry);
            return true;
        } else if (message.op === 'listen' && frame.main) {
            // The main frame's document did what it was told, and waits for more: each count sent comes to what it
            // says, or none where it does not say it, as a new document does not; one muted otherwise than the page
            // is muted again first.
            const own = entry.own;
            for (const n of own.sent) own.counts.get(n)?.(Number(message.counted?.[n]) || 0);
            for (const n of own.sent) own.counts.delete(n);
            own.sent = [];
            own.frame = frame;
            own.awaiting = false;
            if (message.muted !== entry.muted) own.queue.unshift({ op: 'mute', on: entry.muted });
            tellMain(own);
            return true;
        } else if (message.op === 'request') {
            const asked = request(embedder, page.id, { origin, permissions: ['notifications'] });
            answer(asked, "a site's notifications were not asked", false);
            return true;
        } else if (message.op === 'display') {
            // A yes is answered by a script, whose user gesture WebKit's own needs to take the screen; it is run in
            // deckit's world, which the page's code cannot reach, under the name only the page script knows.
            const yes = JSON.stringify(JSON.stringify({ id, answer: true }));
            const name = JSON.stringify(`${entry.channel}:answer`);
            request(embedder, page.id, { origin, permissions: ['display-capture'] })
                .catch((error) => {
                    LOG.error("a site's screen was not asked", error);
                    return false;
                })
                .then((ok) => {
                    if (!ok) return frame.answer(JSON.stringify({ id, answer: false }));
                    frame.evaluate(`document.dispatchEvent(new CustomEvent(${name}, { detail: ${yes} }))`, 'deckit');
                    return frame.answer();
                });
            return true;
        } else if (message.op === 'read') {
            answer(readClipboard(embedder, page.id, { origin }), "a site's clipboard was not reached", null);
            return true;
        } else if (message.op === 'write') {
            const asked = writeClipboard(embedder, page.id, { origin, text: message.text });
            answer(asked, "a site's clipboard was not reached", false);
            return true;
        }
        return false;
    }

    // Runs in the page's world, as source, with only its arguments: what it says crosses to deckit's world as an
    // event under `channel`, and what deckit answers comes back as one under `${channel}:answer`.
    function inPage(channel, table, commands) {
        if (window.__deckitNotification) return;
        // What it calls of the engine's own, and what it says and answers through, are held as the document started,
        // so the page's own code learns neither name nor gets a hold of them by replacing what they are called through.
        const apply = Reflect.apply;
        const dispatch = EventTarget.prototype.dispatchEvent;
        const Custom = CustomEvent;
        const say = (msg) => apply(dispatch, document, [new Custom(channel, { detail: JSON.stringify(msg) })]);
        // The document's origin, which a frame the page made without an address has from the page.
        const origin = self.origin;
        let permission = table[origin] || 'default';
        let seq = 0;
        const ids = new WeakMap(),
            live = new Map(),
            waiting = Object.create(null); // id -> what takes deckit's answer
        // `take(answer)` once deckit answers `msg`.
        const ask = (msg, take) => {
            const id = ++seq;
            waiting[id] = take;
            say({ ...msg, id });
        };
        document.addEventListener(`${channel}:answer`, (event) => {
            const { id, answer } = JSON.parse(event.detail);
            const take = waiting[id];
            if (!take) return;
            delete waiting[id];
            take(answer);
        });
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
                // Shown, it waits for its click, which deckit answers.
                setTimeout(() => {
                    if (permission !== 'granted') return fire(this, 'error');
                    live.set(id, this);
                    const shown = { op: 'show', title: this.title, body: this.body, silent: this.silent };
                    ask(shown, () => live.has(id) && fire(this, 'click'));
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
                        : new Promise((resolve) =>
                              ask({ op: 'request' }, (ok) => {
                                  permission = ok ? 'granted' : 'denied';
                                  resolve(permission);
                              })
                          );
                if (typeof callback === 'function') answer.then(callback);
                return answer;
            }
        }
        Object.defineProperty(window, 'Notification', { value: Notification, writable: true, configurable: true });
        // The news that the site may have notifications, which deckit answers once allow lets it: a grant made in
        // another tab, not an answer. A document come back from the back-forward cache asks again.
        const news = () =>
            permission === 'default' &&
            ask({ op: 'news' }, (state) => {
                if (permission === 'default' && state === 'granted') permission = state;
            });
        news();
        addEventListener('pageshow', (event) => event.persisted && news());
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
        // not have it: an item is written as its text, and one with no text is refused. Replaced on its class, so the
        // page reaches the engine's own through no other way.
        const clipboard = navigator.clipboard;
        const reach = (op, text) =>
            new Promise((resolve, reject) =>
                ask({ op, text }, (answer) => {
                    if (answer === null || answer === false)
                        reject(new DOMException('The site may not reach the clipboard', 'NotAllowedError'));
                    else resolve(op === 'read' ? answer : undefined);
                })
            );
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
                Object.defineProperty(Object.getPrototypeOf(clipboard), name, {
                    value,
                    writable: true,
                    configurable: true,
                });
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
                return apply(execCommand, this, [command, ...rest]);
            },
            writable: true,
            configurable: true,
        });
        // The page's taking of the screen, the engine's own, asked of deckit first, as the web platform's name
        // `display-capture`, and refused as NotAllowedError where the site may not have it. Without the page's user
        // activation it is refused as the web platform refuses it, unasked; deckit's yes calls the engine's own.
        const media = window.MediaDevices?.prototype;
        const getDisplayMedia = media?.getDisplayMedia;
        const activation = navigator.userActivation;
        const isActive = activation && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(activation), 'isActive');
        const active = () => !!isActive?.get && apply(isActive.get, activation, []);
        if (getDisplayMedia)
            Object.defineProperty(media, 'getDisplayMedia', {
                value: function (...rest) {
                    if (!active()) {
                        const message = 'getDisplayMedia must be called from a user gesture handler.';
                        return Promise.reject(new DOMException(message, 'InvalidStateError'));
                    }
                    return new Promise((resolve, reject) =>
                        ask({ op: 'display' }, (answer) => {
                            if (answer === true) resolve(apply(getDisplayMedia, this, rest));
                            else reject(new DOMException('The site may not take the screen', 'NotAllowedError'));
                        })
                    );
                },
                writable: true,
                configurable: true,
            });
        Object.defineProperty(window, '__deckitNotification', { value: true });
    }

    // Runs in deckit's world, in every frame, as source, with only its arguments: what the page's world says under
    // `channel` goes on to deckit, from the frame it is said in, and what deckit answers, the post's reply, back to
    // the page's world under `${channel}:answer`.
    function inRelay(channel) {
        if (window.__deckitRelay) return;
        Object.defineProperty(window, '__deckitRelay', { value: true });
        const back = (answer) =>
            typeof answer === 'string' &&
            document.dispatchEvent(new CustomEvent(`${channel}:answer`, { detail: answer }));
        document.addEventListener(channel, (event) => {
            if (typeof event.detail !== 'string') return;
            window.webkit.messageHandlers.deckit.postMessage(event.detail).then(back, () => {});
        });
    }

    // Runs in deckit's world, in the main frame, as source, with only its arguments: the page's icon, whether it plays
    // sound, and its media muted while `muted`, to deckit. Only what deckit muted is let speak again. What deckit asks
    // of it, to mute, to count what find finds and to clear the selection, is the reply to its word `listen`, which
    // it says again, with each count and whether it is muted, once it did what it was asked.
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
        const setMute = (on) => {
            mute = on;
            for (const el of media()) {
                if (on) quiet(el);
                else if (silenced.delete(el)) el.muted = false;
            }
            report();
        };
        const count = (text, matchCase) => {
            if (!text) return 0;
            const haystack = matchCase
                ? document.body?.innerText || ''
                : (document.body?.innerText || '').toLowerCase();
            const needle = matchCase ? text : text.toLowerCase();
            let found = 0;
            for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) found++;
            return found;
        };
        const listen = (counted) =>
            window.webkit.messageHandlers.deckit
                .postMessage(JSON.stringify({ op: 'listen', counted, muted: mute }))
                .then(
                    (asked) => {
                        if (typeof asked !== 'string') return;
                        const done = {};
                        for (const each of JSON.parse(asked)) {
                            if (each.op === 'mute') setMute(each.on);
                            else if (each.op === 'count') done[each.n] = count(each.text, each.matchCase);
                            else if (each.op === 'unselect') getSelection()?.removeAllRanges();
                        }
                        listen(done);
                    },
                    () => {}
                );
        listen({});
        // A document come back from the back-forward cache, whose word deckit let go, says it again.
        addEventListener('pageshow', (event) => event.persisted && listen({}));
        Object.defineProperty(window, '__deckit', { value: true });
    }

    return { permissionsChanged, attach, clickNotification, setMuted, count, unselect, stateOf };
}
