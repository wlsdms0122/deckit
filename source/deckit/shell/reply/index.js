DeckitModule.define(
    'shell/reply',
    {
        uses: [],
        provides: ['awaitReply', 'cancel'],
        runs: 'main',
    },
    () => {
        // MARK: - Property
        // Main waits on a page only for an exit before it moves and a fade before it goes off screen; this guards a
        // page that is gone or stuck.
        const REPLY_TIMEOUT = 400;
        const waiting = new Map(); // reply -> the wait in progress for it
        const heard = new Set(); // replies listened to
        let replies = 0;

        // MARK: - Initializer
        // MARK: - Public
        // Waits for a page's reply that carries this wait's token, then runs `next`; a newer wait on the same reply
        // runs `superseded` instead. Answers the token the page sends back.
        function awaitReply(webContents, reply, next, { superseded = null } = {}) {
            waiting.get(reply)?.drop();
            if (!webContents || webContents.isDestroyed()) {
                next();
                return null;
            }
            if (!heard.has(reply)) {
                heard.add(reply);
                reply.on(({ token }, sender) => waiting.get(reply)?.answer(sender, token));
            }
            const token = ++replies;
            let done = false;
            const finish = (run) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (waiting.get(reply) === wait) waiting.delete(reply);
                run?.();
            };
            const timer = setTimeout(() => finish(next), REPLY_TIMEOUT);
            const wait = {
                drop: () => finish(superseded),
                answer: (sender, answered) => sender === webContents && answered === token && finish(next),
            };
            waiting.set(reply, wait);
            return token;
        }

        // The wait in progress on `reply` gives way, running its `superseded`.
        function cancel(reply) {
            waiting.get(reply)?.drop();
        }

        // MARK: - Private

        return { awaitReply, cancel };
    }
);
