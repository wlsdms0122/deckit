DeckitModule.define(
    'deck/service/mod/entry',
    {
        uses: [],
        provides: ['MEMBERS', 'problemOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // What an entry's module.exports holds for deck: what it declares, and its hooks.
        const MEMBERS = ['settings', 'start', 'stop'];

        // MARK: - Initializer
        // MARK: - Public
        // What is wrong with what an entry set module.exports to, or null when it is an entry. `added` is what the
        // layers on deck read of it besides.
        function problemOf(exported, added = []) {
            if (!exported || typeof exported !== 'object') return 'module.exports is no object';
            const members = [...added, ...MEMBERS];
            const unknown = Object.keys(exported).filter((key) => !members.includes(key));
            if (unknown.length) return `module.exports has ${members.join(', ')}, not ${unknown.join(', ')}`;
            if (typeof exported.start !== 'function') return 'module.exports needs start(deck)';
            if (exported.stop !== undefined && typeof exported.stop !== 'function')
                return 'module.exports has a stop that is no function';
            return null;
        }

        // MARK: - Private

        return { MEMBERS, problemOf };
    }
);
