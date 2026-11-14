// What the mods post to deckit/notifications: kept in a record, let through at a rate for each sender, queued, and
// shown as a toast while the app is in front and a drawer for toasts is there, or else as a notification of the
// system's. A press runs the command of the sender's it names, and takes the notification away.
const KEY = 'notifications';
// How many the record keeps: the oldest goes.
const KEEP = 100;
// A sender's notifications beyond `count` within `within` milliseconds are kept and listed, not shown.
const RATE = Object.freeze({ count: 3, within: 10000 });
// Toasts on screen at once: the rest wait in the queue.
const TOASTS = 3;
const INTERFACE = 'deckit/notifications';

// `deckit` is the function lifecycle's handle; `commands()` the owner of deckit/commands while one is connected, or
// null; `now()` the time in milliseconds.
function center(deckit, { commands = () => null, now = Date.now } = {}) {
    // MARK: - Property
    const kept = deckit.storage.records.get(KEY, []); // newest first
    const sent = new Map(); // mod id -> when its notifications were shown, within the rate's window
    const queue = []; // what waits to be shown
    const toasts = new Set(); // ids on screen as toasts
    const listeners = new Set();
    let drawer = null; // { show(notification), hide(id), active() }
    let draining = false;

    // MARK: - Initializer
    // MARK: - Public
    // The exports for a connection: what a sender posts is its own, and it reads and takes away its own alone.
    function exportsFor(connection) {
        const mod = { id: connection.credential.mod, name: connection.mod.name };
        return Object.freeze({
            post: async (notification) => post(mod, notification),
            remove: async (id) => {
                if (typeof id !== 'string') throw invalid('remove takes (id), a string');
                return remove(id, { of: mod.id });
            },
            list: async () => list().flatMap(({ mod: sender, ...each }) => (sender.id === mod.id ? [each] : [])),
        });
    }

    // The record, newest first, each with its sender and without the commands a press runs.
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

    // The person pressed a notification, or its `action`th action: it is taken away, and the command it names runs
    // on its sender through deckit/commands, which launches the sender if it does not run.
    async function press(id, action = null) {
        const notification = kept.find((each) => each.id === id);
        if (!notification) return;
        const pressed = action === null ? notification : notification.actions[action];
        take(notification);
        if (!pressed?.command) return;
        try {
            const owner = commands();
            if (!owner) throw new Error('no mod runs commands now');
            await owner.run(notification.mod.id, pressed.command, pressed.args);
        } catch (error) {
            console.error(`[notifications] ${notification.title || notification.body} did not run`, error);
        }
    }

    // Taken away by the person, or by its sender, `of` its id: answers whether it was there.
    function remove(id, { of = null } = {}) {
        const notification = kept.find((each) => each.id === id && (of === null || each.mod.id === of));
        if (!notification) return false;
        take(notification);
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

    // What draws toasts, while the screen lifecycle lasts, `active()` resolving to whether the app is in front; answers
    // its off. A toast it took away lets the next out.
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
    // A post of `mod`'s, refused of kind INVALID_ARGUMENT where `given` is not a table of the keys and types it takes.
    async function post(mod, given) {
        if (!isTable(given)) throw invalid('post takes (notification), a table');
        const { title = '', body = '', silent = false, command = null, args = null, actions = [] } = given;
        if (typeof title !== 'string' || typeof body !== 'string' || !(title || body))
            throw invalid('post takes { title, body }, text, one of them not empty');
        if (typeof silent !== 'boolean') throw invalid('silent is a boolean');
        if (!runs({ command, args })) throw invalid("a command is the id of one of the sender's, args a table");
        if (!Array.isArray(actions) || !actions.every(isAction))
            throw invalid('actions are [{ title, command, args }], a title and a command not empty');
        const notification = {
            id: newId(),
            mod,
            title,
            body,
            silent,
            ...ran({ command, args }),
            actions: actions.map((action) => ({ title: action.title, ...ran(action) })),
            posted: now(),
        };
        kept.unshift(notification);
        kept.splice(KEEP);
        changed();
        if (allowed(mod.id)) {
            queue.push(notification);
            drain();
        }
        return notification.id;
    }

    // Whether `command` is none or a command's id, and `args` none or a table.
    function runs({ command = null, args = null }) {
        if (command !== null && (typeof command !== 'string' || !command)) return false;
        return args === null || isTable(args);
    }

    function isAction(action) {
        return (
            isTable(action) && typeof action.title === 'string' && !!action.title && !!action.command && runs(action)
        );
    }

    function isTable(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    function invalid(message) {
        return Object.assign(new Error(message), { kind: 'INVALID_ARGUMENT' });
    }

    // What a press runs, as it is kept: a command with its args, `{}` for none, or neither for no command.
    function ran({ command = null, args = null }) {
        return command ? { command, args: args ?? {} } : {};
    }

    // Unguessable and never repeated, across runs too.
    function newId() {
        return [...crypto.getRandomValues(new Uint8Array(16))]
            .map((byte) => byte.toString(16).padStart(2, '0'))
            .join('');
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
                    const toasting = !!drawer && (await drawer.active());
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
        changed();
        drain();
    }

    function changed() {
        deckit.storage.records.set(KEY, kept);
        for (const listener of listeners) listener();
    }

    return Object.freeze({ exportsFor, list, press, remove, clear, onChange, drawWith, toastGone });
}

module.exports = { center, INTERFACE, KEEP, RATE, TOASTS };
