DeckitModule.define(
    'deck/service/deck/model/proxy',
    {
        uses: [],
        provides: ['proxyOf', 'deepFreeze'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // Values as given, with a function at each path that calls it by its path: what another side holds, called
        // through main. A path names the object's own properties, defined rather than assigned: a name such as
        // `__proto__` is a property like any other, never the page's prototypes.
        function proxyOf(functions, values, call) {
            const out = values && typeof values === 'object' ? values : {};
            const own = (at, key, value) =>
                Object.defineProperty(at, key, { value, enumerable: true, writable: true, configurable: true });
            for (const path of functions) {
                let at = out;
                for (const key of path.slice(0, -1)) {
                    if (!Object.hasOwn(at, key)) own(at, key, {});
                    at = at[key];
                }
                own(at, path.at(-1), (...args) => call(path, args));
            }
            return out;
        }

        function deepFreeze(value) {
            if (value && typeof value === 'object' && !Object.isFrozen(value)) {
                Object.freeze(value);
                for (const inner of Object.values(value)) deepFreeze(inner);
            }
            return value;
        }

        // MARK: - Private

        return { proxyOf, deepFreeze };
    }
);
