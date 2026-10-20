// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// How a listener on one of Electron's emitters is added: `guard(emitter, event, listener, { once })`, its throw, or a
// promise it rejects, told to `report(label, error)` instead: a library does not own the process to catch it there.
function createGuard(report) {
    return function guard(emitter, event, listener, { once = false } = {}) {
        const guarded = (...args) => {
            try {
                const result = listener(...args);
                if (result instanceof Promise) result.catch((error) => report(event, error));
                return result;
            } catch (error) {
                report(event, error);
            }
        };
        emitter[once ? 'once' : 'on'](event, guarded);
        return guarded;
    };
}

// MARK: - Private

export { createGuard };
