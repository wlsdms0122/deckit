DeckitModule.define(
    'deckit/service/style/main',
    {
        uses: [
            'deckit/service/deck/identity',
            'deckit/service/deck/runner',
            'deckit/service/deck/catalog',
            'deckit/service/style/protocol',
        ],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, CATALOG, PROTOCOL) => {
        // MARK: - Property
        const PERMISSION = 'deckit.styles';
        const EVERY_PAGE = '*';
        const pages = new Map(); // a page that wears styles -> the mod it runs, or null for the switcher's

        // MARK: - Initializer
        // MARK: - Public
        // A mod with `deckit.styles` styles other pages while it runs: a mod's by its id, or every page deckit draws by
        // "*". Each page wears what applies to it in the mods' order, the later over the earlier.
        function start() {
            PROTOCOL.current.handle((_payload, sender) => {
                const modId = IDENTITY.isSwitcher(sender) ? null : IDENTITY.modFrom(sender).id;
                if (!pages.has(sender)) IDENTITY.whenPageEnds(sender, () => pages.delete(sender));
                pages.set(sender, modId);
                return stylesFor(modId);
            });
            RUNNER.observe('didLaunch', (run) => stylesOf(run) && tell());
            RUNNER.observe('didTerminate', (run) => stylesOf(run) && tell());
            CATALOG.onChange(tell);
        }

        // MARK: - Private
        // What the page of `modId`, or the switcher's for null, wears.
        function stylesFor(modId) {
            return CATALOG.mods()
                .map(({ id }) => RUNNER.runOf(id))
                .filter((run) => run?.state === 'running')
                .map(stylesOf)
                .filter(Boolean)
                .flatMap((given) =>
                    [given[EVERY_PAGE], modId && given[modId]].filter((css) => typeof css === 'string')
                );
        }

        // What a run styles, held to the permission: main does not take a page's word for it.
        function stylesOf(run) {
            const given = run.contributions?.styles;
            if (!given || !Object.keys(given).length) return null;
            return run.mod.permissions.some(({ id }) => id === PERMISSION) ? given : null;
        }

        function tell() {
            for (const [page, modId] of pages) PROTOCOL.changed.send(page, { styles: stylesFor(modId) });
        }

        return { start };
    }
);
