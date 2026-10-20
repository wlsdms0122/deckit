import * as CONNECTION from './connection.js';
import * as MESSAGE from './message.js';

// The core: deckit's own process, which keeps a mod's records. `CONFIG.core` is its executable.
export function createCore({ CONFIG, HOME, LOG }) {
    // MARK: - Property
    const pending = new Map(); // request id -> { resolve, reject }
    const restarting = [];
    let connection = null;
    let ready = null; // resolved once the running core has answered initialize
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // Once the app is ready, before any mod launches.
    function start() {
        ready = launch();
    }

    // What the core answers. Asked while a core is starting, it waits for that one.
    function request(method, params) {
        const asked = ready;
        return asked.then(() => (asked === ready ? send(method, params) : request(method, params)));
    }

    // `listener` is told as a core that ended is replaced: what it kept was answered by one that is gone.
    function onRestart(listener) {
        restarting.push(listener);
    }

    // MARK: - Private
    // A core that ends after it answered initialize is replaced; one that ends before it never started, and every
    // request after it fails with why.
    function launch() {
        let initialized = false;
        connection = CONNECTION.open(CONFIG.core, {
            onMessage: receive,
            onLog: (line) => LOG.info('core:', line),
            onEnd: (why) => {
                for (const { reject } of pending.values()) reject(new Error(`the core ended: ${why}`));
                pending.clear();
                if (!initialized) return LOG.error(`the core did not start: ${why}`);
                LOG.warn(`the core ended (${why}): it starts again, and every mod launches again`);
                ready = launch();
                for (const listener of restarting) listener();
            },
        });
        const launched = send('initialize', { home: HOME.folder }).then(
            () => {
                initialized = true;
            },
            (error) => {
                throw new Error(`the core did not start: ${error.message}`);
            }
        );
        // Why it did not start is logged as it ends; each request after it is refused with it.
        launched.catch(() => {});
        return launched;
    }

    function send(method, params) {
        const id = ++sequence;
        return new Promise((resolve, reject) => {
            pending.set(id, { resolve, reject });
            connection.send(MESSAGE.request(id, method, params));
        });
    }

    function receive(line) {
        let response;
        try {
            response = MESSAGE.read(line);
        } catch {
            return LOG.error('the core said what is no message:', line);
        }
        const asked = pending.get(response.id);
        if (!asked) return LOG.error('the core answered nothing asked:', line);
        pending.delete(response.id);
        if (response.error) asked.reject(response.error);
        else asked.resolve(response.result);
    }

    return { start, request, onRestart };
}
