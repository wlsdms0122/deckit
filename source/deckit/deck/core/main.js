import * as CONNECTION from './connection.js';
import * as MESSAGE from './message.js';

// The core: deckit's own process, which keeps a mod's records. `CONFIG.core` is its executable.
export function createCore({ CONFIG, HOME, LOG }) {
    // MARK: - Property
    const pending = new Map(); // request id -> { resolve, reject }
    let connection = null;
    let ready = null; // settled once the core has answered initialize
    let ended = null; // why the core is gone, once it is
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // Once the app is ready, before any mod launches.
    function start() {
        connection = CONNECTION.open(CONFIG.core, {
            onMessage: receive,
            onLog: (line) => LOG.info('core:', line),
            onEnd: end,
        });
        ready = send('initialize', { home: HOME.folder });
        // A core that does not start is logged as it ends, and each request after it is refused with why.
        ready.catch(() => {});
    }

    // What the core answers. Asked before the core has answered initialize, it waits for that.
    function request(method, params) {
        return ready.then(() => send(method, params));
    }

    // MARK: - Private
    // A core that ended is not started again: all that is asked of it is refused, saying the app is to be
    // restarted, and so whatever asked shows it.
    function end(why) {
        ended = new Error(`deckit's core ended (${why}): restart the app`);
        LOG.error(ended.message);
        for (const { reject } of pending.values()) reject(ended);
        pending.clear();
    }

    function send(method, params) {
        if (ended) return Promise.reject(ended);
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

    return { start, request };
}
