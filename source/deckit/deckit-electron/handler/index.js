// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// How deckit sets a handler Electron keeps one of, on a webContents or a session of deckit's: `hold(target, setter,
// handler)` sets it and keeps it. Whoever calls `target[setter]` later, as a host app setting its own on every
// webContents does, leaves it as deckit set it, and the call is told to `report(setter)`.
function createHold(report) {
    return function hold(target, setter, handler) {
        Object.getPrototypeOf(target)[setter].call(target, handler);
        Object.defineProperty(target, setter, { configurable: true, value: () => report(setter) });
    };
}

// MARK: - Private

export { createHold };
