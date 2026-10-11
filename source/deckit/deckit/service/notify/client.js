DeckitModule.define(
    'deckit/service/notify/client',
    {
        uses: ['deckit/service/notify/model/protocol'],
        provides: ['notify', 'listen'],
    },
    (PROTOCOL) => {
        const handlers = new Map(); // id -> onClick
        let seq = 0;
        // macOS keeps a notice in Notification Centre well past the banner, so a click can come late.
        const TTL = 10 * 60 * 1000;

        const notify = ({ title = '', body = '', silent = false, onClick = null } = {}) => {
            const id = 'n' + ++seq;
            if (typeof onClick === 'function') {
                handlers.set(id, onClick);
                // Most notices are never clicked; without this every callback stays for the life of the page.
                setTimeout(() => handlers.delete(id), TTL);
            }
            const asked = Promise.resolve().then(() =>
                PROTOCOL.notify.ask({ id, title: String(title || ''), body: String(body || ''), silent: !!silent })
            );
            return asked.catch((e) => {
                handlers.delete(id);
                console.warn('[deckit] notify failed', e);
                return false;
            });
        };

        return Object.freeze({
            notify,
            listen: () => {
                PROTOCOL.clicked.hear(({ id }) => {
                    const run = handlers.get(id);
                    handlers.delete(id);
                    try {
                        run?.();
                    } catch (e) {
                        console.warn('[deckit] notify click handler threw', e);
                    }
                });
            },
        });
    }
);
