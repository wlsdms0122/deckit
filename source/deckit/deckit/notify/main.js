DeckitModule.define(
    'deckit/notify/main',
    {
        uses: [
            'deck/log/main',
            'deck/identity',
            'deckit/notify/protocol',
            'deckit/notify/model/permission',
        ],
        provides: ['start'],
    },
    (LOG, IDENTITY, PROTOCOL, NOTIFY_PERMISSION) => {
        // MARK: - Property
        // A Notification nothing refers to is garbage collected, and macOS then withdraws it or never delivers it.
        // The cap covers a close that never comes.
        const live = new Set();
        const HOLD_MS = 24 * 3600 * 1000;
        // A platform that says neither shown nor failed within this is taken as having shown it.
        const SETTLE_MS = 1500;

        // MARK: - Initializer
        // MARK: - Public
        // `clicked` is the app's answer to a clicked notice, which brings it forward before the mod hears of it.
        function start({ clicked }) {
            PROTOCOL.notify.handle(({ id, title, body, silent }, sender) => {
                IDENTITY.modFrom(sender, NOTIFY_PERMISSION.NOTIFICATIONS);
                return show(sender, id, title, body, silent, clicked);
            });
        }

        // MARK: - Private
        function show(sender, id, title, body, silent, clicked) {
            const { Notification } = require('electron');
            if (!Notification.isSupported()) return false;
            const notice = new Notification({ title: title.slice(0, 200), body: body.slice(0, 400), silent });
            live.add(notice);
            const cap = setTimeout(() => live.delete(notice), HOLD_MS);
            const letGo = () => {
                clearTimeout(cap);
                live.delete(notice);
            };
            LOG.guard(notice, 'click', () => {
                clicked();
                PROTOCOL.clicked.send(sender, { id });
                letGo();
            });
            LOG.guard(notice, 'close', letGo);
            return new Promise((resolve) => {
                let settled = false;
                const settle = (shown, why) => {
                    if (settled) return;
                    settled = true;
                    if (!shown) {
                        LOG.warn('a notice was not shown', why || '');
                        letGo();
                    }
                    resolve(shown);
                };
                LOG.guard(notice, 'show', () => settle(true), { once: true });
                LOG.guard(notice, 'failed', (_event, error) => settle(false, error), { once: true });
                setTimeout(() => settle(true), SETTLE_MS);
                notice.show();
            });
        }

        return { start };
    }
);
