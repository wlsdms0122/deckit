// How every file of deckit names what it uses and what it provides. The one global a bundle adds.
(() => {
    // MARK: - Property
    const made = new Map();

    // MARK: - Initializer
    globalThis.DeckitModule = Object.freeze({ define, use });

    // MARK: - Public
    // `runs` is for whoever reads the declarations by running each file against a recorder, as the check does.
    function define(name, { uses = [], provides = [] } = {}, make) {
        if (made.has(name)) throw new Error(`[deckit] ${name} is defined twice`);
        const value = make(...resolve(name, uses));
        const has = value && typeof value === 'object' ? Object.keys(value) : [];
        if (has.length !== provides.length || provides.some((key) => !has.includes(key))) {
            throw new Error(
                `[deckit] ${name} provides ${provides.join(', ')}, but made ${has.join(', ') || 'nothing'}`
            );
        }
        made.set(name, viewOf(name, Object.freeze(value)));
    }

    function use(uses, run) {
        return run(...resolve('a caller of use()', uses));
    }

    // MARK: - Private
    function resolve(asker, names) {
        return names.map((written) => {
            const optional = written.endsWith('?');
            const name = optional ? written.slice(0, -1) : written;
            if (made.has(name)) return made.get(name);
            if (optional) return undefined;
            throw new Error(`[deckit] ${asker} uses ${name}, which is not defined before it`);
        });
    }

    // A name not provided throws where it is read. Symbols and `then` pass: runtimes probe every value
    // for symbols, and a promise asks `then` of what it resolves with.
    function viewOf(name, value) {
        return new Proxy(value, {
            get(target, key, receiver) {
                if (typeof key === 'symbol' || key in target) return Reflect.get(target, key, receiver);
                if (key === 'then') return undefined;
                throw new Error(`[deckit] ${name} provides no ${key}`);
            },
        });
    }
})();
