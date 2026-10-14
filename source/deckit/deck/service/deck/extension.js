DeckitModule.define(
    'deck/service/deck/extension',
    {
        uses: [
            'deck/module/version',
            'deck/service/deck/identity',
            'deck/service/deck/runner',
            'deck/service/deck/protocol',
            'deck/service/deck/model/extension-point',
        ],
        provides: ['start', 'pointsExtendedBy'],
        runs: 'main',
    },
    (VERSION, IDENTITY, RUNNER, PROTOCOL, EXTENSION_POINT) => {
        // MARK: - Property
        // an open point's id -> mod id -> { values, functions }: what each mod extends it with
        const points = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A mod opens an extension point and another extends it: the one that extends requires the one that opened it,
        // so it starts after that one has and ends before it does, or uses it optionally, and then what it extends the
        // point with is held and handed again each time the point's mod launches. What it extends a point with stays
        // in its own page and is called there through main; the point's mod is told each time what extends it changes.
        function start() {
            RUNNER.observe('didLaunch', (run) => {
                for (const name of run.contributions.extensionPoints)
                    points.set(EXTENSION_POINT.idOf(run.mod.id, name), new Map());
                for (const [point, extension] of Object.entries(run.contributions.extensions))
                    extend(run, point, extension);
                for (const { run: other } of RUNNER.runs()) {
                    if (other.state !== 'running' || !Object.hasOwn(other.mod.optional, run.mod.id)) continue;
                    for (const [point, extension] of Object.entries(other.contributions.extensions))
                        if (EXTENSION_POINT.modOf(point) === run.mod.id) extend(other, point, extension);
                }
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
        // A point it extends belongs to a mod it requires, which is running, so the point is open or never will be; or
        // to one it uses optionally, which may not run now, and then nothing extends the point until it does.
        function extend(run, point, extension) {
            const owner = EXTENSION_POINT.modOf(point);
            const optional = Object.hasOwn(run.mod.optional, owner);
            if (!Object.hasOwn(run.mod.requires, owner) && !optional)
                return run.record(`deck.extend() names ${point}, but manifest.toml neither requires nor uses ${owner}`);
            const ownerRun = RUNNER.runOf(owner);
            if (
                optional &&
                (ownerRun?.state !== 'running' || !VERSION.satisfies(ownerRun.mod.version, run.mod.optional[owner]))
            )
                return;
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
