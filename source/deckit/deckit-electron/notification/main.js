import * as LISTENER from '../deck/listener/index.js';

// The system's notifications (deckit-shell/environment: notifications).
export function createNotifications() {
    // MARK: - Property
    // A Notification nothing refers to is garbage collected, and macOS then withdraws it or never delivers it. The
    // cap covers a close that never comes.
    const live = new Set();
    const HOLD_MS = 24 * 3600 * 1000;
    // A platform that says neither shown nor failed within this is taken as having shown it.
    const SETTLE_MS = 1500;

    // MARK: - Initializer
    // MARK: - Public
    // Resolves true once shown, false where the system has none, and rejects with why when it says it did not show
    // it. `onClick()` hears a click on it.
    function show({ title, body, silent }, { onClick }) {
        const { Notification } = require('electron');
        if (!Notification.isSupported()) return Promise.resolve(false);
        const notification = new Notification({ title, body, silent });
        live.add(notification);
        const cap = setTimeout(() => live.delete(notification), HOLD_MS);
        const letGo = () => {
            clearTimeout(cap);
            live.delete(notification);
        };
        LISTENER.guard(notification, 'click', () => {
            onClick();
            letGo();
        });
        LISTENER.guard(notification, 'close', letGo);
        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (shown, why) => {
                if (settled) return;
                settled = true;
                if (shown) return resolve(true);
                letGo();
                reject(new Error(String(why || '')));
            };
            LISTENER.guard(notification, 'show', () => settle(true), { once: true });
            LISTENER.guard(notification, 'failed', (_event, error) => settle(false, error), { once: true });
            setTimeout(() => settle(true), SETTLE_MS);
            notification.show();
        });
    }

    // MARK: - Private

    return { show };
}
