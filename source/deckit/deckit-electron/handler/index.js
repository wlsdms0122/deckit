// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// How deckit sets a handler Electron keeps one of, on a webContents or a session of deckit's: `hold(target, setter,
// handler)` sets it and keeps it. Whoever calls `target[setter]` later, as a host app setting its own on every
// webContents does, leaves it as deckit set it, and the first such call of each setter is told to `report(setter)`.
function createHold(report) {
    const reported = new Set();
    return function hold(target, setter, handler) {
        Object.getPrototypeOf(target)[setter].call(target, handler);
        Object.defineProperty(target, setter, { configurable: true, value: () => reportOnce(setter) });
    };

    function reportOnce(setter) {
        if (reported.has(setter)) return;
        reported.add(setter);
        report(setter);
    }
}

// MARK: - Private

export { createHold };
