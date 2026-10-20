// MARK: - Property
// What a driver handed this bundle to bind the shell's channels with: in main as the shell is attached, in a page as
// deckit starts the shell there. One per bundle, as the process and the page have one.
let channels = null;
const ENDPOINT = ['on', 'handle', 'send', 'invoke'];

// MARK: - Initializer
// MARK: - Public
function use(given) {
    channels = given;
}

// Each of `declarations` (a protocol.js), by its name, bound once first used: a protocol is read as its module is
// imported, before the driver has handed the bundle anything.
function bindAll(declarations) {
    return Object.freeze(
        Object.fromEntries(Object.entries(declarations).map(([name, declared]) => [name, lazily(declared)]))
    );
}

// MARK: - Private
function lazily(declared) {
    let endpoint = null;
    const bound = () => {
        if (!channels)
            throw new Error(`[deckit] ${declared.channel} is used before deckit handed the shell its channels`);
        return (endpoint ??= channels.bind(declared));
    };
    return Object.freeze(Object.fromEntries(ENDPOINT.map((name) => [name, (...args) => bound()[name](...args)])));
}

export { use, bindAll };
