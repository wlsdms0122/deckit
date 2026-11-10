import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as REQUEST from '../request/index.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createNotification() {
    // MARK: - Property
    const listeners = new Map(); // id -> { heard, forget }: the Set of what hears its press, and what lets it go
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // A press is heard once: its listeners are let go as it is delivered.
    function listen(deliver) {
        PROTOCOL.pressed.on(({ id }) => {
            const shown = listeners.get(id);
            if (!shown) return;
            shown.forget();
            for (const listener of shown.heard) deliver('notification press', listener);
        });
    }

    // `notifications` for a handle, each member made a request with `request` (mod/renderer.js): a press is heard until
    // `scope` is cut, once.
    function notificationsOf(scope, request) {
        const signature = [
            [
                'notification',
                'object',
                [
                    ['title', 'string?'],
                    ['body', 'string?'],
                    ['silent', 'boolean?'],
                ],
            ],
        ];
        const show = async (notification) => {
            const title = notification.title ?? '';
            const body = notification.body ?? '';
            const silent = notification.silent ?? false;
            if (!title && !body) {
                throw REQUEST.refusal(
                    'call',
                    'INVALID_ARGUMENT',
                    'notifications.show: notification.title and notification.body are both empty'
                );
            }
            const id = 'notification-' + ++sequence;
            const heard = new Set();
            listeners.set(id, { heard, forget: scope.add(() => listeners.delete(id)) });
            const shown = await PROTOCOL.show.invoke({ id, title, body, silent });
            if (!shown) listeners.get(id)?.forget();
            return Object.freeze({
                shown,
                // Not a request: it answers at once, and throws the refusal a request rejects with.
                onPress: (listener) => {
                    if (typeof listener !== 'function') {
                        throw REQUEST.refusal(
                            'call',
                            'INVALID_ARGUMENT',
                            `notifications.show: onPress: listener is ${CHANNEL.kindOf(listener)}, not function`
                        );
                    }
                    heard.add(listener);
                    return () => heard.delete(listener);
                },
            });
        };
        return Object.freeze({
            show: request('notifications.show', { guard: PROTOCOL.show.guard, signature }, show),
        });
    }

    // MARK: - Private

    return { listen, notificationsOf };
}
