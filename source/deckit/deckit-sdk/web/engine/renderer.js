import * as CHANNEL from '../../deckit/channel/index.js';
import * as LISTENER from '../../deckit/listener/index.js';
import * as REQUEST from '../../deckit/request/index.js';
import * as DECLARED from './protocol.js';
import * as SESSION from './model/session.js';

// MARK: - Property
// What `fetch` takes: an address, and how it is asked, `headers` `[[name, value]]` and `body` its bytes in base64.
const FETCHES = Object.freeze([
    ['url', 'string'],
    [
        'init',
        'object?',
        [
            ['method', 'string?'],
            ['headers', 'array?'],
            ['body', 'string?'],
            ['redirect', 'string?'],
        ],
    ],
]);
// What `allow` and `revoke` take, and what `trust` takes: arrays of tables, each of these keys.
const SITE_ENTRY = Object.freeze([
    ['origin', 'string'],
    ['permission', 'string'],
]);
const CERTIFICATE_ENTRY = Object.freeze([
    ['host', 'string'],
    ['fingerprint', 'string'],
]);
// The statuses an answer has no body with.
const NO_BODY = new Set([101, 103, 204, 205, 304]);
// A method and a header's name are tokens, and a header's value holds no line break and no NUL, as HTTP writes them.
const TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const VALUE = /^[^\0\r\n]*$/;
// The methods written in upper case whatever case they are handed in, as a page's fetch writes them.
const NORMALIZED = new Set(['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT']);
const REDIRECTS = new Set(['follow', 'error', 'manual']);
const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
// What a page's members take, by member.
const PAGE_TAKES = Object.freeze({
    load: [['url', 'string']],
    back: [],
    forward: [],
    reload: [],
    stop: [],
    mute: [['on', 'boolean']],
    find: [
        ['text', 'string'],
        [
            'options',
            'object?',
            [
                ['start', 'boolean?'],
                ['back', 'boolean?'],
                ['matchCase', 'boolean?'],
            ],
        ],
    ],
    stopFind: [['options', 'object?', [['keepSelection', 'boolean?']]]],
    focus: [],
    close: [],
});
// A blank page's address: none, or about:blank.
const BLANK = /^(?:about:blank(?:[?#].*)?)?$/i;

// A mod's web in its page: its sessions, and the pages that show what they load, in its page, as an element of it, and
// in windows. `web` is the environment's (environment: WEB_PAGE): what shows a web page in this page. `sessions` is
// what the environment names this mod's web sessions by, as the page was told it, handed back as it is. `channels`
// binds the web engine's channels in the page.
export function createWeb({ sessions, web: WEB, channels }) {
    // MARK: - Property
    const PROTOCOL = CHANNEL.bindAll(channels, DECLARED);
    const pages = new Map(); // page id -> { receive }
    // What main said about a page before this side knew which element it was, in order.
    const early = new Map(); // page id -> [[event, payload]]
    // A session is named only by a handle the mod was given, so it cannot name one it was not.
    const names = new WeakMap(); // session handle -> { name, scope }, the scope of the lifecycle it was made for
    const downloadListeners = new Set();
    let listening = false;
    let hearingDownloads = false;

    // MARK: - Initializer
    // MARK: - Public
    // The handle `web` for a lifecycle whose scope is `scope`: the mod's sessions by name, and the downloads its web
    // pages started, written to the Downloads folder. `session(name)` answers at once the handle of the session `name`,
    // the same one at each call in the lifecycle, and throws its refusal, INVALID_ARGUMENT, for a name that names no
    // session (SESSION.NAME). A session's members are requests, each refused at call, ENDED, once the lifecycle has
    // ended: `clear()`, what the session stored taken, `fetch(url, init)`, `trust(entries)`, `allow(entries)` and
    // `revoke(entries)`, each answering nothing. `downloads` are requests but `onChange(listener)`, which answers its
    // off, cut with `scope`, and throws its refusal for a listener that is no function. `request` makes a member a
    // request, refused as its channel's guard holds the mod, then for its arguments.
    function forMod({ request, scope }) {
        const id = [['id', 'string']];
        const made = new Map(); // a session's name -> its handle, for this lifecycle
        // The request `name` of a session: refused as `request` refuses it, then ENDED once `scope` is cut, and then
        // for what `problemOf` reads of its arguments.
        const live = (name, { guard, signature, problemOf = () => '' }, send) =>
            request(name, { guard, signature }, (...args) => {
                if (scope.isCut)
                    throw REQUEST.refusal('call', 'ENDED', `${name}: the lifecycle it was made for has ended`);
                const problem = problemOf(...args);
                if (problem) throw invalid(`${name}: ${problem}`);
                return send(...args);
            });
        const session = (name) => {
            const problem = SESSION.nameProblem(name);
            if (problem) throw invalid(`web.session: ${problem}`);
            if (made.has(name)) return made.get(name);
            const handle = Object.freeze({
                name,
                clear: live('web.session.clear', { guard: PROTOCOL.clear.guard }, () =>
                    PROTOCOL.clear.invoke({ name })
                ),
                fetch: live(
                    'web.session.fetch',
                    { guard: PROTOCOL.fetch.guard, signature: FETCHES, problemOf: fetchProblem },
                    (url, init) => fetchIn(name, url, init)
                ),
                trust: live(
                    'web.session.trust',
                    {
                        guard: PROTOCOL.trust.guard,
                        signature: [['entries', 'array']],
                        problemOf: entriesOf(CERTIFICATE_ENTRY),
                    },
                    async (entries) => {
                        await PROTOCOL.trust.invoke({ name, entries: picked(entries, CERTIFICATE_ENTRY) });
                    }
                ),
                allow: live(
                    'web.session.allow',
                    {
                        guard: PROTOCOL.allow.guard,
                        signature: [['entries', 'array']],
                        problemOf: entriesOf(SITE_ENTRY),
                    },
                    async (entries) => {
                        await PROTOCOL.allow.invoke({ name, entries: picked(entries, SITE_ENTRY) });
                    }
                ),
                revoke: live(
                    'web.session.revoke',
                    {
                        guard: PROTOCOL.revoke.guard,
                        signature: [['entries', 'array']],
                        problemOf: entriesOf(SITE_ENTRY),
                    },
                    async (entries) => {
                        await PROTOCOL.revoke.invoke({ name, entries: picked(entries, SITE_ENTRY) });
                    }
                ),
            });
            names.set(handle, { name, scope });
            made.set(name, handle);
            return handle;
        };
        const downloads = Object.freeze({
            list: request('web.downloads.list', { guard: PROTOCOL.downloads.guard }, () =>
                PROTOCOL.downloads.invoke({})
            ),
            onChange: (listener) => {
                if (typeof listener !== 'function') throw invalid('web.downloads.onChange: listener is no function');
                return scope.add(onDownload(listener));
            },
            cancel: request(
                'web.downloads.cancel',
                { guard: PROTOCOL.cancelDownload.guard, signature: id },
                async (given) => {
                    await PROTOCOL.cancelDownload.invoke({ id: given });
                }
            ),
            remove: request('web.downloads.remove', { guard: PROTOCOL.removeDownload.guard, signature: id }, (given) =>
                PROTOCOL.removeDownload.invoke({ id: given })
            ),
            open: request('web.downloads.open', { guard: PROTOCOL.openDownload.guard, signature: id }, (given) =>
                PROTOCOL.openDownload.invoke({ id: given })
            ),
        });
        return Object.freeze({ session, downloads });
    }

    // What shows web pages: pages in the mod's page, as elements of it, and in windows, each showing what a session
    // from `web.session` loads. `owner` is whoever hands it out ({ deliver, recordFailure }), `open(url, options)`
    // what opens outside the app an address the page passes on, as the mod's openExternal does; a page or window made
    // is closed, and nothing more is heard about it, once `scope` is cut.
    function surfacesOf({ owner, open, scope }) {
        if (!listening) listen();
        // The name of the session `handle` is, thrown its refusal for one that is no handle `web.session` answered in
        // this page, INVALID_ARGUMENT, or one of a lifecycle that has ended, ENDED.
        const named = (handle) => {
            const made = names.get(handle);
            if (!made) throw invalid('a web page takes a session that web.session(name) answered');
            if (made.scope.isCut) throw REQUEST.refusal('call', 'ENDED', "the session's lifecycle has ended");
            return made.name;
        };
        return Object.freeze({
            page: ({ session: handle, url = '' } = {}) =>
                keptIn(scope, page(named(handle), url, owner, open, handle, scope)),
            window: ({ session: handle, url = '', title = '' } = {}) =>
                keptIn(scope, windowPage(named(handle), url, title, owner, open, handle, scope)),
        });
    }

    // A page made for `scope`, closed once it is cut, its delegate no longer told; one the mod closes is closed as it
    // asked, its delegate still told.
    function keptIn(scope, made) {
        const { close } = made;
        let asked = false;
        const end = scope.add(() => {
            if (!asked) made.delegate = null;
            close();
        });
        made.close = memberOf('close', scope, () => {
            asked = true;
            end();
        });
        return made;
    }

    // MARK: - Private
    // What `fetch(url, { method, headers, body, redirect })` asks, sent as the session's pages send a request, with
    // its cookies: `method` GET where it is left out, `headers` `[[name, value]]`, `body` the bytes in base64, left out
    // for none, and `redirect` `follow` where it is left out. Answers `{ url, status, headers, body, redirected }`:
    // `url` the address that answered, `headers` `[[name, value]]` as the environment read them, and `body` the bytes
    // in base64, left out where the status has none.
    async function fetchIn(name, url, init) {
        const { method = 'GET', headers = [], body, redirect = 'follow' } = keysOf(init);
        const asked = {
            name,
            url: new URL(url).href,
            method: NORMALIZED.has(method.toUpperCase()) ? method.toUpperCase() : method,
            headers: headers.map(([key, value]) => [key, value]),
            redirect,
            ...(body === undefined ? {} : { body }),
        };
        const answer = await PROTOCOL.fetch.invoke(asked);
        return {
            url: answer.url,
            status: answer.status,
            headers: answer.headers,
            ...(NO_BODY.has(answer.status) ? {} : { body: answer.body }),
            redirected: answer.redirected,
        };
    }

    // Why what `fetch` was handed, of the types its signature gives, is no request, or ''.
    function fetchProblem(url, init) {
        const { method = 'GET', headers = [], body, redirect = 'follow' } = keysOf(init);
        let parsed = null;
        try {
            parsed = new URL(url);
        } catch {}
        if (parsed?.protocol !== 'http:' && parsed?.protocol !== 'https:') return `${url} is no web address`;
        if (!TOKEN.test(method)) return `${method} is no method`;
        for (const [index, header] of headers.entries()) {
            if (!Array.isArray(header) || header.length !== 2 || header.some((part) => typeof part !== 'string'))
                return `headers[${index}] is no [name, value] of strings`;
            if (!TOKEN.test(header[0]) || !VALUE.test(header[1])) return `headers[${index}] is no header`;
        }
        if (body !== undefined) {
            if (!BASE64.test(body)) return 'body is no base64';
            if (/^(GET|HEAD)$/i.test(method)) return `a ${method.toUpperCase()} request has no body`;
        }
        if (!REDIRECTS.has(redirect)) return `redirect is follow, error or manual, not ${redirect}`;
        return '';
    }

    // The keys of `init`, a table or left out, that are not left out: one that holds null is left out, as one that
    // holds undefined is.
    function keysOf(init) {
        return Object.fromEntries(
            Object.entries(init ?? {}).filter(([, value]) => value !== undefined && value !== null)
        );
    }

    // Why `entries`, an array, holds what is not a table of the keys and types `keys` gives, or ''.
    function entriesOf(keys) {
        return (entries) => {
            for (const [index, entry] of entries.entries()) {
                const problem = REQUEST.argumentProblem([[`entries[${index}]`, 'object', keys]], [entry]);
                if (problem) return problem;
            }
            return '';
        };
    }

    // Each entry with the keys `keys` gives alone.
    function picked(entries, keys) {
        return entries.map((entry) => Object.fromEntries(keys.map(([key]) => [key, entry[key]])));
    }

    function invalid(message) {
        return REQUEST.refusal('call', 'INVALID_ARGUMENT', message);
    }

    function onDownload(listener) {
        if (!hearingDownloads) {
            hearingDownloads = true;
            PROTOCOL.downloaded.on((download) => {
                for (const heard of downloadListeners) heard({ ...download });
            });
        }
        const heard = LISTENER.wrap(listener, 'a downloads listener');
        downloadListeners.add(heard);
        return () => downloadListeners.delete(heard);
    }

    function listen() {
        listening = true;
        PROTOCOL.changed.on(({ id, state }) => deliver(id, 'change', state));
        PROTOCOL.refused.on(({ id, certificate }) => deliver(id, 'certificate', certificate));
        PROTOCOL.found.on(({ id, matches, active, final }) => deliver(id, 'found', { matches, active, final }));
        PROTOCOL.leaving.on(({ id, url }) => deliver(id, 'leave', { url }));
        PROTOCOL.opening.on(({ id, page, url, activates }) => deliver(id, 'window', { page, url, activates }));
        PROTOCOL.asking.on(({ id, ask, origin, permissions, app, url }) => {
            let answered = false;
            deliver(id, 'permission', {
                origin,
                permissions,
                app: app || '',
                url: url || '',
                answer(allow) {
                    if (answered) return;
                    answered = true;
                    PROTOCOL.permit.send({ ask, allow: allow === true });
                },
            });
        });
        PROTOCOL.saving.on(({ id, ask, url, name, mimeType, expected }) => {
            let answered = false;
            deliver(id, 'download', {
                url,
                name,
                mimeType,
                expected,
                answer(save) {
                    if (answered) return;
                    answered = true;
                    PROTOCOL.save.send({ ask, save: save === true });
                },
            });
        });
        PROTOCOL.notified.on(({ id, notification, title, body, silent }) => {
            deliver(id, 'notification', {
                title,
                body,
                silent,
                click: () => PROTOCOL.clickNotification.send({ id, notification }),
            });
        });
        PROTOCOL.closed.on(({ id }) => deliver(id, 'closed'));
    }

    function deliver(id, event, payload) {
        const known = pages.get(id);
        if (known) {
            known.receive(event, payload);
            return;
        }
        if (!early.has(id)) early.set(id, []);
        early.get(id).push([event, payload]);
    }

    // The handle a mod holds for a page, and the delegate it answers through. Each member answers at once, and throws
    // its refusal: INVALID_ARGUMENT for what it does not take, then ENDED once `scope` is cut. A page that has closed
    // does nothing it is asked.
    function handleOf(owner, open, session, url, scope) {
        let delegate = null;
        let id = null;
        const waiting = [];
        const state = {
            url,
            title: '',
            icon: '',
            loading: !BLANK.test(String(url)),
            canGoBack: false,
            canGoForward: false,
            blank: true,
            audible: false,
            muted: false,
            capture: { microphone: false, camera: false, screen: false },
        };
        const tell = (method, ...args) => {
            const listener = delegate?.[method];
            if (typeof listener === 'function')
                owner.deliver(`page delegate ${method}()`, listener.bind(delegate), ...args);
        };
        const ask = async (method, fallback, ...args) => {
            const answer = delegate?.[method];
            if (typeof answer !== 'function') return fallback;
            try {
                return await answer.apply(delegate, args);
            } catch (error) {
                owner.recordFailure(`page delegate ${method}() threw: ${error.message || error}`);
                return fallback;
            }
        };
        const openElsewhere = (to, options) =>
            open(to, options).catch((error) => owner.recordFailure(`${to} did not open: ${error.message || error}`));
        // The address a file page leaves for, asked of shouldLeave(url) alone: only false keeps it in, so a delegate
        // that forgot to answer does not lose it.
        const leave = async (to) => {
            if ((await ask('shouldLeave', true, to)) === false) return;
            openElsewhere(to);
        };
        // The window a page opened, as a page of the mod's to show. One the delegate does not take goes, and its
        // address opens elsewhere, as one of a page with no window to hand over does, but for a blank page's, which
        // is never opened outside the app.
        const takeWindow = async ({ page: given, url: to, activates }) => {
            const elsewhere = () => !BLANK.test(String(to)) && openElsewhere(to, { activates });
            if (given === undefined || given === null) return void elsewhere();
            const made = page(names.get(session).name, to, owner, open, session, scope, given);
            const { close } = made;
            const opened = keptIn(scope, made);
            if ((await ask('openWindow', false, opened, { url: to, activates })) !== false) return;
            close();
            elsewhere();
        };
        const receive = (event, payload) => {
            switch (event) {
                case 'change':
                    Object.assign(state, payload);
                    return tell('didChange', { ...state });
                case 'press':
                    return tell('didFocus');
                case 'certificate':
                    return tell('didRefuseCertificate', payload);
                case 'notification':
                    return tell('didReceiveNotification', payload);
                case 'found':
                    return tell('didFind', payload);
                case 'close':
                    return tell('didRequestClose');
                // A window gone is gone for good: nothing more is heard about it.
                case 'closed':
                    pages.delete(id);
                    return tell('didClose');
                // Anything but true refuses: unanswered, the page would wait on it for as long as it lives.
                case 'permission': {
                    const { answer, ...request } = payload;
                    return ask('decidePermission', false, request).then((allow) => answer(allow === true));
                }
                case 'download': {
                    const { answer, ...download } = payload;
                    return ask('shouldDownload', true, download).then((save) => answer(save !== false));
                }
                case 'leave':
                    return leave(payload.url);
                case 'window':
                    return takeWindow(payload);
            }
        };
        const whenKnown = (send) => {
            if (id === null) waiting.push(send);
            else send(id);
        };
        const know = (known) => {
            id = known;
            pages.set(id, { receive });
            for (const [event, payload] of early.get(id) || []) receive(event, payload);
            early.delete(id);
            for (const send of waiting.splice(0)) send(id);
            PROTOCOL.state.send({ id });
        };
        const handle = {
            session,
            get state() {
                return { ...state };
            },
            load: memberOf('load', scope, (to) => whenKnown((page) => PROTOCOL.load.send({ id: page, url: to }))),
            back: memberOf('back', scope, () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'back' }))),
            forward: memberOf('forward', scope, () =>
                whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'forward' }))
            ),
            reload: memberOf('reload', scope, () =>
                whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'reload' }))
            ),
            stop: memberOf('stop', scope, () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'stop' }))),
            mute: memberOf('mute', scope, (on) => whenKnown((page) => PROTOCOL.mute.send({ id: page, on }))),
            find: memberOf('find', scope, (text, options) => {
                const { start = false, back = false, matchCase = false } = keysOf(options);
                whenKnown((page) => PROTOCOL.find.send({ id: page, text, start, back, matchCase }));
            }),
            stopFind: memberOf('stopFind', scope, (options) => {
                const { keepSelection = false } = keysOf(options);
                whenKnown((page) => PROTOCOL.stopFind.send({ id: page, keepSelection }));
            }),
            get delegate() {
                return delegate;
            },
            set delegate(next) {
                delegate = next && typeof next === 'object' ? next : null;
            },
        };
        return {
            handle,
            know,
            receive,
            isKnown: () => id !== null,
            close: () => whenKnown((page) => PROTOCOL.close.send({ id: page })),
        };
    }

    // The member `name` of a page: it answers nothing at once, and throws its refusal, INVALID_ARGUMENT where what it
    // is handed does not fit PAGE_TAKES, then ENDED once `scope` is cut.
    function memberOf(name, scope, act) {
        return (...args) => {
            const problem = REQUEST.argumentProblem(PAGE_TAKES[name], args);
            if (problem) throw invalid(`page.${name}: ${problem}`);
            if (scope.isCut) throw REQUEST.refusal('call', 'ENDED', `page.${name}: the lifecycle it was for has ended`);
            act(...args);
        };
    }

    // A web page shown in this page, as an element of it: a new one at `url`, or the window of id `given` a web page
    // opened.
    function page(name, url, owner, open, session, scope, given) {
        const { handle, know, receive, isKnown } = handleOf(owner, open, session, url, scope);
        let closed = false;
        const { element, id, close } = WEB.view(
            { sessions, session: name, url, ...(given === undefined ? {} : { page: given }) },
            { closing: () => !closed && receive('close'), focused: () => receive('press') }
        );
        id.then((known) => !isKnown() && !closed && know(known));
        return Object.assign(handle, {
            element,
            // Focused anew even while it has the focus, as the keyboard may have gone to the overlay since: focusing
            // the element is what hands the web page the keyboard.
            focus: memberOf('focus', scope, () => {
                if (document.activeElement === element) element.blur();
                element.focus();
            }),
            close: () => {
                closed = true;
                close();
            },
        });
    }

    function windowPage(name, url, title, owner, open, session, scope) {
        const { handle, know, receive, close } = handleOf(owner, open, session, url, scope);
        PROTOCOL.window.invoke({ name, url: String(url), title: String(title) }).then(
            (id) => know(id),
            () => receive('closed')
        );
        return Object.assign(handle, { close });
    }

    return { forMod, surfacesOf };
}
