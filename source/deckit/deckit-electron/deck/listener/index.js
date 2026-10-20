import * as LISTENER from '../../../deckit-shell/deck/listener/index.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A listener on one of Electron's emitters, reported as deck's listeners are when it throws: a library does not own
// the process to catch it.
function guard(emitter, event, listener, { once = false } = {}) {
    const guarded = LISTENER.wrap(listener, event);
    emitter[once ? 'once' : 'on'](event, guarded);
    return guarded;
}

// MARK: - Private

export { guard };
