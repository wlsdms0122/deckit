DeckitModule.define(
    'deckit/module/listener',
    {
        uses: [],
        provides: ['guard', 'wrap', 'reportTo'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        let report = (label, error) => console.error(`[deckit] ${label} failed`, error);

        // MARK: - Initializer
        // MARK: - Public
        // An exception nobody catches in main ends the app with no dialog, and deckit does not own the process
        // to catch it there. So every listener deckit adds goes through here, and a throw is reported instead.
        function guard(emitter, event, listener, { once = false } = {}) {
            const guarded = wrap(listener, event);
            emitter[once ? 'once' : 'on'](event, guarded);
            return guarded;
        }

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

        function reportTo(reporter) {
            report = reporter;
        }

        // MARK: - Private

        return { guard, wrap, reportTo };
    }
);
