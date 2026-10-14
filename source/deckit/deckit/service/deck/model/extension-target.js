DeckitModule.define(
    'deckit/service/deck/model/extension-target',
    {
        uses: [],
        provides: ['targetOf', 'isTarget', 'modOf', 'pointOf'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        // A mod id holds no colon, so the first one ends it.
        const SEPARATOR = ':';

        // MARK: - Initializer
        // MARK: - Public
        // An extension point as another mod names it: after the mod that opened it, `<mod id>:<point>`.
        function targetOf(modId, point) {
            return modId + SEPARATOR + point;
        }

        function isTarget(target) {
            const at = target.indexOf(SEPARATOR);
            return at > 0 && at < target.length - 1;
        }

        function modOf(target) {
            return target.slice(0, target.indexOf(SEPARATOR));
        }

        function pointOf(target) {
            return target.slice(target.indexOf(SEPARATOR) + 1);
        }

        // MARK: - Private

        return { targetOf, isTarget, modOf, pointOf };
    }
);
