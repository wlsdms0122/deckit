import * as LISTENER from '../listener/index.js';

// The requests one mod makes of another as deckit relays them: a call on a connection, a mod reached by its id, and a
// launch or relaunch a mod with deckit.mods asks for. What listens is told each as `{ from, to }`, the ids of the mod
// that asks and of the mod asked, before it goes on to that mod.
export function createRequest() {
    // MARK: - Property
    const listeners = new Set();

    // MARK: - Initializer
    // MARK: - Public
    function tell(from, to) {
        const request = Object.freeze({ from, to });
        for (const listener of [...listeners]) listener(request);
    }

    // Answers its off.
    function onRequest(listener) {
        const heard = LISTENER.wrap(listener, 'a request listener');
        listeners.add(heard);
        return () => listeners.delete(heard);
    }

    return { tell, onRequest };
}
