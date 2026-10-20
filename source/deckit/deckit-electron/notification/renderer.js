import * as CHANNEL from '../../deckit-shell/deck/channel/index.js';
import * as IPC from '../../deckit-shell/deck/ipc/renderer.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createNotification() {
    // MARK: - Property
    // macOS keeps a notification in Notification Centre well past the banner, so a click can come late.
    const TTL = 10 * 60 * 1000;
    const handlers = new Map(); // id -> onClick
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function listen(deliver) {
        PROTOCOL.clicked.on(({ id }) => {
            const handler = handlers.get(id);
            handlers.delete(id);
            if (handler) deliver('notification onClick', handler);
        });
    }

    function notify({ title = '', body = '', silent = false, onClick = null } = {}) {
        const id = 'notification-' + ++sequence;
        if (typeof onClick === 'function') {
            handlers.set(id, onClick);
            // Most notifications are never clicked; without this every handler stays for the life of the page.
            setTimeout(() => handlers.delete(id), TTL);
        }
        return PROTOCOL.show.invoke({ id, title: String(title), body: String(body), silent: !!silent });
    }

    // MARK: - Private

    return { listen, notify };
}
