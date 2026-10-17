import * as PROTOCOL from './protocol.js';

// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// What this page is: { page }, the name of a page the shell made, or { id } for a mod's.
function setup() {
    return PROTOCOL.setup.invoke();
}

// MARK: - Private

export { setup };
