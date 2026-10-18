import * as PROTOCOL from './protocol.js';
import * as NOTIFICATION_PERMISSION from './model/permission.js';

// `clicked` is the app's answer to a clicked notification, which brings it forward before the mod hears of it.
export function createNotification({ LOG, IDENTITY, clicked }) {
    // MARK: - Property
    // A Notification nothing refers to is garbage collected, and macOS then withdraws it or never delivers it.
    // The cap covers a close that never comes.
    const live = new Set();
    const HOLD_MS = 24 * 3600 * 1000;
    // A platform that says neither shown nor failed within this is taken as having shown it.
    const SETTLE_MS = 1500;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.show.handle(({ id, title, body, silent }, sender) => {
            IDENTITY.modFrom(sender, NOTIFICATION_PERMISSION.NOTIFICATIONS);
            return show(sender, id, title, body, silent, clicked);
        });
    }

    // MARK: - Private
    function show(sender, id, title, body, silent, clicked) {
        const { Notification } = require('electron');
        if (!Notification.isSupported()) return false;
        const notification = new Notification({ title: title.slice(0, 200), body: body.slice(0, 400), silent });
        live.add(notification);
        const cap = setTimeout(() => live.delete(notification), HOLD_MS);
        const letGo = () => {
            clearTimeout(cap);
            live.delete(notification);
        };
        LOG.guard(notification, 'click', () => {
            clicked();
            PROTOCOL.clicked.send(sender, { id });
            letGo();
        });
        LOG.guard(notification, 'close', letGo);
        return new Promise((resolve) => {
            let settled = false;
            const settle = (shown, why) => {
                if (settled) return;
                settled = true;
                if (!shown) {
                    LOG.warn('a notification was not shown', why || '');
                    letGo();
                }
                resolve(shown);
            };
            LOG.guard(notification, 'show', () => settle(true), { once: true });
            LOG.guard(notification, 'failed', (_event, error) => settle(false, error), { once: true });
            setTimeout(() => settle(true), SETTLE_MS);
            notification.show();
        });
    }

    return { start };
}
