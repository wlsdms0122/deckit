// MARK: - Property
let report = (label, error) => console.error(`[deckit] ${label} failed`, error);

// MARK: - Initializer
// MARK: - Public
// An exception nobody catches in main ends the app with no dialog, and a library does not own the process to catch
// it there. So every listener deck adds goes through here, and a throw, or a promise it rejects, is reported instead.
function wrap(listener, label) {
    return (...args) => {
        try {
            const result = listener(...args);
            if (result instanceof Promise) result.catch((error) => report(label, error));
            return result;
        } catch (error) {
            report(label, error);
        }
    };
}

// Where the listeners of the bundle that carries this report what they throw, as the composition hands it over with
// what carries the channels (deck/ipc): a layer's bundle carries its own.
function reportTo(reporter) {
    report = reporter;
}

// MARK: - Private

export { wrap, reportTo };
