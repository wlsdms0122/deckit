// What the mods post to deckit/notifications: kept in a record, let through at a rate for each sender, queued, and shown
// as a toast while the app is in front and a drawer for toasts is there, or else as a notification of the system's. A
// press runs the token the sender handed, and takes the notification away.
const KEY = 'notifications';
// How many the record keeps: the oldest goes, with its tokens.
const KEEP = 100;
// A sender's notifications beyond `count` within `within` milliseconds are kept and listed, not shown.
const RATE = Object.freeze({ count: 3, within: 10000 });
// Toasts on screen at once: the rest wait in the queue.
const TOASTS = 3;
const INTERFACE = 'deckit/notifications';

// `deckit` is the function lifecycle's handle; `now()` the time in milliseconds.
function center(deckit, { now = Date.now } = {}) {
    // MARK: - Property
    const kept = deckit.storage.records.get(KEY, []); // newest first
    const sent = new Map(); // mod id -> when its notifications were shown, within the rate's window
    const queue = []; // what waits to be shown
    const toasts = new Set(); // ids on screen as toasts
    const listeners = new Set();
    let drawer = null; // { show(notification), hide(id) }
    let draining = false;

    // MARK: - Initializer
    // MARK: - Public
    // The exports for a connection: what a sender posts is its own.
    function exportsFor(connection) {
        const mod = { id: connection.mod.id, name: connection.mod.name };
        return Object.freeze({
            post: (notification) => post(mod, notification),
            remove: async (id) => remove(id, { of: mod.id }),
            list: async () => list(),
        });
    }

    // The record, newest first, without the tokens it holds.
    function list() {
        return kept.map(({ id, mod, title, body, posted, actions }) => ({
            id,
            mod,
            title,
            body,
            posted,
            actions: actions.map((action) => ({ title: action.title })),
        }));
    }

    // The person pressed a notification, or its `action`th action: its token runs, and it is taken away.
    async function press(id, action = null) {
        const notification = kept.find((each) => each.id === id);
        if (!notification) return;
        const token = action === null ? notification.token : notification.actions[action]?.token;
        take(notification);
        try {
            if (token) await deckit.commands.tokens.run(token);
        } catch (error) {
            console.error(`[notifications] ${notification.title || notification.body} did not run`, error);
        } finally {
            release(notification);
        }
    }

    // Taken away by the person, or by its sender, `of` its id: answers whether it was there.
    function remove(id, { of = null } = {}) {
        const notification = kept.find((each) => each.id === id && (of === null || each.mod.id === of));
        if (!notification) return false;
        take(notification);
        release(notification);
        return true;
    }

    function clear() {
        for (const notification of [...kept]) remove(notification.id);
    }

    // `listener()` each time the record changes; answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // What draws toasts, while the screen lifecycle lasts; answers its off. A toast it took away lets the next out.
    function drawWith(given) {
        drawer = given;
        drain();
        return () => {
            if (drawer === given) drawer = null;
            toasts.clear();
        };
    }

    function toastGone(id) {
        if (toasts.delete(id)) drain();
    }

    // MARK: - Private
    async function post(mod, { title = '', body = '', silent = false, token = null, actions = [] } = {}) {
        if (typeof title !== 'string' || typeof body !== 'string' || !(title || body))
            throw new TypeError('post takes { title, body }, text, one of them not empty');
        if (token !== null && typeof token !== 'string') throw new TypeError('a token is a command token');
        if (!Array.isArray(actions) || actions.some((action) => !action?.title || typeof action.token !== 'string'))
            throw new TypeError('actions are [{ title, token }]');
        const notification = {
            id: crypto.randomUUID(),
            mod,
            title,
            body,
            silent: !!silent,
            token,
            actions: actions.map((action) => ({ title: String(action.title), token: action.token })),
            posted: now(),
        };
        kept.unshift(notification);
        for (const old of kept.splice(KEEP)) release(old);
        changed('posted', notification.id);
        if (allowed(mod.id)) {
            queue.push(notification);
            drain();
        }
        return notification.id;
    }

    function allowed(id) {
        const at = now();
        const recent = (sent.get(id) || []).filter((time) => at - time < RATE.within);
        const lets = recent.length < RATE.count;
        sent.set(id, lets ? [...recent, at] : recent);
        return lets;
    }

    // One at a time, in the order posted: a toast waits while the screen is full.
    function drain() {
        if (draining) return;
        draining = true;
        (async () => {
            try {
                while (queue.length) {
                    const toasting = !!drawer && (await deckit.active());
                    if (toasting && toasts.size >= TOASTS) break;
                    const next = queue.shift();
                    if (!kept.includes(next)) continue;
                    if (toasting) {
                        toasts.add(next.id);
                        drawer.show(next);
                    } else await showOnSystem(next);
                }
            } catch (error) {
                console.error('[notifications] the queue stopped', error);
            } finally {
                draining = false;
            }
        })();
    }

    async function showOnSystem(notification) {
        try {
            const shown = await deckit.notifications.show({
                title: notification.title,
                body: notification.body,
                silent: notification.silent,
            });
            shown.onPress(() => press(notification.id));
        } catch (error) {
            console.error('[notifications] the system did not show one', error);
        }
    }

    // Out of the record, the queue and the screen.
    function take(notification) {
        const place = kept.indexOf(notification);
        if (place < 0) return;
        kept.splice(place, 1);
        if (toasts.delete(notification.id)) drawer?.hide(notification.id);
        changed('removed', notification.id);
        drain();
    }

    function release(notification) {
        for (const token of [notification.token, ...notification.actions.map((action) => action.token)])
            if (token) deckit.commands.tokens.release(token).catch(() => {});
    }

    function changed(signal, id) {
        deckit.storage.records.set(KEY, kept);
        deckit.events.emit(`${INTERFACE}:${signal}`, id);
        for (const listener of listeners) listener();
    }

    return Object.freeze({ exportsFor, list, press, remove, clear, onChange, drawWith, toastGone });
}

module.exports = { center, INTERFACE, KEEP, RATE, TOASTS };
