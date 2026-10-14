import * as PROTOCOL from './protocol.js';

export function createNotify() {
    // MARK: - Property
    // macOS keeps a notice in Notification Centre well past the banner, so a click can come late.
    const TTL = 10 * 60 * 1000;
    const handlers = new Map(); // id -> onClick
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function listen(deliver) {
        PROTOCOL.clicked.on(({ id }) => {
            const handler = handlers.get(id);
            handlers.delete(id);
            if (handler) deliver('notice onClick', handler);
        });
    }

    function notify({ title = '', body = '', silent = false, onClick = null } = {}) {
        const id = 'notice-' + ++sequence;
        if (typeof onClick === 'function') {
            handlers.set(id, onClick);
            // Most notices are never clicked; without this every handler stays for the life of the page.
            setTimeout(() => handlers.delete(id), TTL);
        }
        return PROTOCOL.notify.invoke({ id, title: String(title), body: String(body), silent: !!silent });
    }

    // MARK: - Private

    return { listen, notify };
}
