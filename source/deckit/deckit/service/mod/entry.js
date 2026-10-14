DeckitModule.define(
    'deckit/service/mod/entry',
    {
        uses: [],
        provides: ['MEMBERS', 'problemOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What an entry's module.exports may hold: how the switcher shows it, what it declares, and its hooks.
        const MEMBERS = ['icon', 'keywords', 'settings', 'start', 'stop'];

        // MARK: - Initializer
        // MARK: - Public
        // What is wrong with what an entry set module.exports to, or null when it is an entry.
        function problemOf(exported) {
            if (!exported || typeof exported !== 'object') return 'module.exports is no object';
            const unknown = Object.keys(exported).filter((key) => !MEMBERS.includes(key));
            if (unknown.length) return `module.exports has ${MEMBERS.join(', ')}, not ${unknown.join(', ')}`;
            if (typeof exported.start !== 'function') return 'module.exports needs start(deck)';
            if (exported.stop !== undefined && typeof exported.stop !== 'function')
                return 'module.exports has a stop that is no function';
            return null;
        }

        // MARK: - Private

        return { MEMBERS, problemOf };
    }
);
