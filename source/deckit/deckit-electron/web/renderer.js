import * as IPC from '../deck/ipc/index.js';
import * as DECLARED from './protocol.js';
import * as WEB_PERMISSION from './model/permission.js';
import * as PARTITION from './model/partition.js';

const PROTOCOL = IPC.bindAll(DECLARED);

export function createWeb({ sessionPrefix }) {
    // MARK: - Property
    // Unique across reloads of this document, since main may still be closing the last one's pages.
    const boot = Date.now().toString(36);
    let sequence = 0;
    const pages = new Map(); // page id -> { apply, receive }
    // What main said about a page before this side knew which element it was, in order.
    const early = new Map(); // page id -> [[event, payload]]
    // A session is named only by a handle the mod was given, so it cannot name one it was not.
    const sessions = new WeakMap(); // session handle -> its name

    // MARK: - Initializer
    // MARK: - Public
    function listen() {
        PROTOCOL.changed.on(({ id, state }) => deliver(id, 'change', state));
        PROTOCOL.refused.on(({ id, certificate }) => deliver(id, 'certificate', certificate));
        PROTOCOL.found.on(({ id, matches, active, final }) => deliver(id, 'found', { matches, active, final }));
        PROTOCOL.leaving.on(({ id, url }) => deliver(id, 'leave', { url }));
        PROTOCOL.opening.on(({ id, url, activates, target }) =>
            deliver(id, 'window', { url, options: { activates, target } })
        );
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

    // What a mod is handed of the web: its sessions, pages in its view, and pages in windows. `owner` is
    // whoever hands it out ({ deliver, recordFailure }), `opener` what opens an address the page passes on, and
    // `permissions` decides which of the session's tools exist.
    function forMod({ permissions, owner, opener }) {
        const has = (permission) => permissions.includes(permission);
        const made = new Map();
        const session = (name) => {
            if (made.has(name)) return made.get(name);
            PARTITION.spellIn(sessionPrefix, name);
            const handle = Object.freeze({
                name,
                clear: () => PROTOCOL.clear.invoke({ name }),
                ...(has(WEB_PERMISSION.NETWORK)
                    ? { fetchText: (url) => PROTOCOL.fetchText.invoke({ name, url: String(url) }) }
                    : {}),
                ...(has(WEB_PERMISSION.CERTIFICATES)
                    ? { trust: (entries) => PROTOCOL.trust.invoke({ name, entries: [].concat(entries) }) }
                    : {}),
                ...(has(WEB_PERMISSION.SITE_PERMISSIONS)
                    ? {
                          allow: (entries) => PROTOCOL.allow.invoke({ name, entries: [].concat(entries) }),
                          revoke: (entries) => PROTOCOL.revoke.invoke({ name, entries: [].concat(entries) }),
                      }
                    : {}),
            });
            sessions.set(handle, name);
            made.set(name, handle);
            return handle;
        };
        const nameOf = (handle) => {
            if (!sessions.has(handle)) throw new Error('a web page needs a session from deck.web.session(name)');
            return sessions.get(handle);
        };
        return Object.freeze({
            session,
            page: ({ session: handle, url = '' } = {}) =>
                page(PARTITION.spellIn(sessionPrefix, nameOf(handle)), url, owner, opener, handle),
            window: ({ session: handle, url = '', title = '' } = {}) =>
                windowPage(nameOf(handle), url, title, owner, opener, handle),
        });
    }

    // MARK: - Private
    function deliver(id, event, payload) {
        const known = pages.get(id);
        if (known) {
            known.receive(event, payload);
            return;
        }
        if (!early.has(id)) early.set(id, []);
        early.get(id).push([event, payload]);
    }

    // The handle a mod holds for a page, and the delegate it answers through.
    function handleOf(owner, opener, session, url) {
        let delegate = null;
        let id = null;
        const waiting = [];
        const state = {
            url,
            title: '',
            icon: '',
            loading: !!url,
            canGoBack: false,
            canGoForward: false,
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
        // Only false keeps the default back, so a delegate that forgot to answer does not lose the request.
        const otherwiseOpen = async (method, to, options) => {
            if ((await ask(method, true, to, options)) === false) return;
            opener
                .open(to, options)
                .catch((error) => owner.recordFailure(`${to} did not open: ${error.message || error}`));
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
                case 'leave':
                    return otherwiseOpen('shouldLeave', payload.url);
                case 'window':
                    return otherwiseOpen('shouldOpenWindow', payload.url, payload.options);
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
            load: (to) => whenKnown((page) => PROTOCOL.load.send({ id: page, url: String(to) })),
            back: () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'back' })),
            forward: () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'forward' })),
            reload: () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'reload' })),
            stop: () => whenKnown((page) => PROTOCOL.navigate.send({ id: page, to: 'stop' })),
            mute: (on) => whenKnown((page) => PROTOCOL.mute.send({ id: page, on: !!on })),
            find: (text, { start = false, back = false, matchCase = false } = {}) =>
                whenKnown((page) => PROTOCOL.find.send({ id: page, text: String(text), start, back, matchCase })),
            stopFind: ({ keepSelection = false } = {}) =>
                whenKnown((page) => PROTOCOL.stopFind.send({ id: page, keepSelection })),
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

    // A <webview>, not a frame: a framed page knows it is framed, and the cookies it writes are third-party.
    // `partition` has to be on the element before `src` is.
    function page(partition, url, owner, opener, session) {
        const { handle, know, receive, isKnown } = handleOf(owner, opener, session, url);
        const key = boot + '-' + ++sequence;
        const element = document.createElement('webview');
        element.dataset.deckitPage = key;
        element.setAttribute('partition', partition);
        element.setAttribute('src', url || 'about:blank');
        // Without it a <webview> refuses every window.open before main is asked.
        element.setAttribute('allowpopups', '');
        // White under the page, as a browser has: a <webview> is see-through, and a site that leaves its own
        // background unset would show what is under it through its text.
        element.style.background = '#fff';
        let closed = false;
        // The <webview>'s methods exist only in the document's main world, not this one, so its id is read from
        // there once and everything else goes through main.
        element.addEventListener('dom-ready', async () => {
            if (isKnown() || closed) return;
            const id = await require('electron').webFrame.executeJavaScript(
                `document.querySelector('webview[data-deckit-page="${key}"]')?.getWebContentsId() ?? null`
            );
            if (id !== null && !closed) know(id);
        });
        element.addEventListener('close', () => !closed && receive('close'));
        // Focus is the only sign of a click in the page this document gets.
        element.addEventListener('focus', () => receive('press'));
        return Object.assign(handle, {
            element,
            focus: () => element.focus(),
            close: () => {
                closed = true;
                element.remove();
            },
        });
    }

    function windowPage(name, url, title, owner, opener, session) {
        const { handle, know, receive, close } = handleOf(owner, opener, session, url);
        PROTOCOL.window.invoke({ name, url: String(url), title: String(title) }).then(
            (id) => (id ? know(id) : receive('closed')),
            () => receive('closed')
        );
        return Object.assign(handle, { close });
    }

    return { listen, forMod };
}
