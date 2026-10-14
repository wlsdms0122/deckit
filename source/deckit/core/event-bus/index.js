DeckitModule.define(
    'core/event-bus',
    {
        uses: [],
        provides: ['make'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // Listeners by event name. `call(listener, args, name)` is how a listener is called, for a caller that answers
        // for what one throws; `onNamesChange(names)` hears when the names listened to change. A listener taken off
        // while an event is being told is not told it.
        function make({ call = (listener, args) => listener(...args), onNamesChange = () => {} } = {}) {
            const listeners = new Map(); // name -> Set
            return {
                // Answers the listener's off.
                on(name, listener) {
                    if (!listeners.has(name)) {
                        listeners.set(name, new Set());
                        onNamesChange([...listeners.keys()]);
                    }
                    listeners.get(name).add(listener);
                    return () => {
                        const set = listeners.get(name);
                        if (!set?.delete(listener) || set.size) return;
                        listeners.delete(name);
                        onNamesChange([...listeners.keys()]);
                    };
                },
                emit(name, ...args) {
                    const told = listeners.get(name);
                    for (const listener of [...(told || [])]) if (told.has(listener)) call(listener, args, name);
                },
                names: () => [...listeners.keys()],
            };
        }

        // MARK: - Private

        return { make };
    }
);
