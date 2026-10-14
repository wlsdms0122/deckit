DeckitModule.define(
    'deckit/service/deck/extension',
    {
        uses: [
            'deckit/service/deck/identity',
            'deckit/service/deck/runner',
            'deckit/service/deck/protocol',
            'deckit/service/deck/model/extension-point',
        ],
        provides: ['start', 'pointsExtendedBy'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, PROTOCOL, EXTENSION_POINT) => {
        // MARK: - Property
        // an open point's id -> mod id -> { values, functions }: what each mod extends it with
        const points = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A mod opens an extension point and another extends it: the one that extends requires the one that opened it,
        // so it starts after that one has and ends before it does. What it extends a point with stays in its own page
        // and is called there through main; the point's mod is told each time what extends it changes.
        function start() {
            RUNNER.observe('didLaunch', (run) => {
                for (const name of run.contributions.extensionPoints)
                    points.set(EXTENSION_POINT.idOf(run.mod.id, name), new Map());
                for (const [point, extension] of Object.entries(run.contributions.extensions))
                    extend(run, point, extension);
            });
            RUNNER.observe('didTerminate', ({ mod }) => {
                for (const point of [...points.keys()]) {
                    if (EXTENSION_POINT.modOf(point) === mod.id) points.delete(point);
                    else if (points.get(point).delete(mod.id)) tell(point);
                }
            });
            PROTOCOL.callExtension.handle(async ({ run: number, mod, point, path, args }, sender) => {
                const caller = IDENTITY.modFrom(sender);
                if (EXTENSION_POINT.modOf(point) !== caller.id)
                    throw new Error(`${point} is not a point of ${caller.id}`);
                const run = RUNNER.currentRun(sender, number);
                if (!run || run.state === 'notRunning') throw new Error(`${caller.id} is not running`);
                const extension = points.get(point)?.get(mod);
                if (!extension) throw new Error(`${mod} does not extend ${point}`);
                if (!extension.functions.some((written) => written.join('.') === path.join('.')))
                    throw new Error(`${mod} extends ${point} with no function ${path.join('.')}`);
                return PROTOCOL.extensionCalled.invoke(IDENTITY.pageOf(mod), { point, path, args });
            });
        }

        // The points the mod extends now, as deck took them.
        function pointsExtendedBy(modId) {
            return [...points].filter(([, extensions]) => extensions.has(modId)).map(([point]) => point);
        }

        // MARK: - Private
        // A point it extends belongs to a mod it requires, which is running, so the point is open or never will be.
        function extend(run, point, extension) {
            const owner = EXTENSION_POINT.modOf(point);
            if (!Object.hasOwn(run.mod.requires, owner))
                return run.record(`deck.extend() names ${point}, but manifest.toml does not require ${owner}`);
            if (!points.has(point)) return run.record(`deck.extend() names ${point}, which ${owner} does not open`);
            points.get(point).set(run.mod.id, extension);
            tell(point);
        }

        function tell(point) {
            const page = IDENTITY.pageOf(EXTENSION_POINT.modOf(point));
            if (!page) return;
            PROTOCOL.extensionsChanged.send(page, {
                name: EXTENSION_POINT.nameOf(point),
                extensions: Object.fromEntries(points.get(point)),
            });
        }

        return { start, pointsExtendedBy };
    }
);
