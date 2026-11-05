import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createNotification() {
    // MARK: - Property
    // macOS keeps a notification in Notification Centre well past the banner, so a press can come late.
    const TTL = 10 * 60 * 1000;
    const listeners = new Map(); // id -> Set of what hears its press
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function listen(deliver) {
        PROTOCOL.pressed.on(({ id }) => {
            const heard = listeners.get(id);
            listeners.delete(id);
            for (const listener of heard ?? []) deliver('notification press', listener);
        });
    }

    // `notifications` for a handle: a press is heard until `scope` is cut, or the notification is too old to be.
    function notificationsOf(scope) {
        const show = async ({ title = '', body = '', silent = false } = {}) => {
            const id = 'notification-' + ++sequence;
            const heard = new Set();
            listeners.set(id, heard);
            // Most notifications are never pressed; without this every listener stays for the life of the page.
            setTimeout(
                scope.add(() => listeners.delete(id)),
                TTL
            );
            const shown = await PROTOCOL.show.invoke({
                id,
                title: String(title),
                body: String(body),
                silent: !!silent,
            });
            if (!shown) listeners.delete(id);
            return Object.freeze({
                shown,
                onPress: (listener) => {
                    if (typeof listener !== 'function') throw new TypeError('onPress takes a function');
                    heard.add(listener);
                    return () => heard.delete(listener);
                },
            });
        };
        return Object.freeze({ show });
    }

    // MARK: - Private

    return { listen, notificationsOf };
}
