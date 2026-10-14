import * as PROTOCOL from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
function about() {
    return PROTOCOL.about.invoke();
}

function restart() {
    return PROTOCOL.restart.invoke();
}

// MARK: - Private

export { about, restart };
