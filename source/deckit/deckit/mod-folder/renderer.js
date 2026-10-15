import * as PROTOCOL from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A folder the person picks to install, as it would install, or null when they did not pick one.
function pick() {
    return PROTOCOL.pick.invoke();
}

// The mod's folder, shown in Finder.
function reveal(id) {
    return PROTOCOL.reveal.invoke({ id: String(id) });
}

// MARK: - Private

export { pick, reveal };
