import * as MESSAGE from './message.js';
import { API } from '../contract/index.js';

// The core: deckit's own, which reads and installs the mods, and keeps what they store and the state. `core` is how
// the environment reaches it, and `home` deckit's folder.
export function createCore({ CONFIG, FOLDERS, LOG, core, home }) {
    // MARK: - Property
    const pending = new Map(); // request id -> { resolve, reject }
    let connection = null;
    let ready = null; // settled once the core has answered initialize
    let kept = null; // where deck keeps the mods it installed and their data folders, as initialize answered
    let ended = null; // why the core is gone, once it is
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    // Once the app is ready, before any mod launches: what the mods are read against is handed over then, `permissions`
    // the layers' own.
    function start({ permissions }) {
        connection = core.open({
            onMessage: receive,
            onLog: (line) => LOG.info('core:', line),
            onEnd: end,
        });
        ready = send('initialize', {
            home,
            name: CONFIG.name,
            schemeHandlers: CONFIG.schemeHandlers,
            api: API,
            ship: FOLDERS.ship,
            sources: FOLDERS.sources,
            permissions,
        }).then((folders) => {
            kept = folders;
        });
        // A core that does not start is logged, as it ends or as it refuses what it is handed, and each request after
        // it is refused with why.
        ready.catch((error) => {
            if (!ended) LOG.error("deckit's core did not start", error);
        });
    }

    // What the core answers. Asked before the core has answered initialize, it waits for that.
    function request(method, params) {
        return ready.then(() => send(method, params));
    }

    // Where deck keeps the mods it installed and their data folders, `{ mods, data }`, once the core has started: a
    // mod's data folder is the one in `data` named by its id.
    function folders() {
        return kept;
    }

    // MARK: - Private
    // A core that ended is not started again: all that is asked of it is refused, of kind ENDED, saying the app is
    // to be restarted, and so whatever asked shows it.
    function end(why) {
        ended = Object.assign(new Error(`deckit's core ended (${why}): restart the app`), { kind: 'ENDED' });
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

    return { start, request, folders };
}
