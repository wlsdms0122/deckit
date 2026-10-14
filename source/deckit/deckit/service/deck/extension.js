DeckitModule.define(
    'deckit/service/deck/extension',
    {
        uses: [
            'deckit/service/deck/identity',
            'deckit/service/deck/runner',
            'deckit/service/deck/protocol',
            'deckit/service/deck/model/extension-target',
        ],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, RUNNER, PROTOCOL, TARGET) => {
        // MARK: - Property
        // `<mod id>:<point>` -> mod id -> { values, functions }: what each mod extends each open point with
        const points = new Map();

        // MARK: - Initializer
        // MARK: - Public
        // A mod opens an extension point and another extends it: the one that extends requires the one that opened it,
        // so it starts after that one has and ends before it does. What it extends a point with stays in its own page
        // and is called there through main; the point's mod is told each time what extends it changes.
        function start() {
            RUNNER.observe('didLaunch', (run) => {
                for (const point of run.contributions.extensionPoints)
                    points.set(TARGET.targetOf(run.mod.id, point), new Map());
                for (const [target, extension] of Object.entries(run.contributions.extensions))
                    extend(run, target, extension);
            });
            RUNNER.observe('didTerminate', ({ mod }) => {
                for (const target of [...points.keys()]) {
                    if (TARGET.modOf(target) === mod.id) points.delete(target);
                    else if (points.get(target).delete(mod.id)) tell(target);
                }
            });
            PROTOCOL.callExtension.handle(async ({ run: number, mod, target, path, args }, sender) => {
                const caller = IDENTITY.modFrom(sender);
                if (TARGET.modOf(target) !== caller.id) throw new Error(`${target} is not a point of ${caller.id}`);
                const run = RUNNER.currentRun(sender, number);
                if (!run || run.state === 'notRunning') throw new Error(`${caller.id} is not running`);
                const extension = points.get(target)?.get(mod);
                if (!extension) throw new Error(`${mod} does not extend ${target}`);
                if (!extension.functions.some((written) => written.join('.') === path.join('.')))
                    throw new Error(`${mod} extends ${target} with no function ${path.join('.')}`);
                return PROTOCOL.extensionCalled.invoke(IDENTITY.pageOf(mod), { target, path, args });
            });
        }

        // MARK: - Private
        // A point it extends belongs to a mod it requires, which is running, so the point is open or never will be.
        function extend(run, target, extension) {
            const owner = TARGET.modOf(target);
            if (!Object.hasOwn(run.mod.requires, owner))
                return run.record(`deck.extend() names ${target}, but manifest.toml does not require ${owner}`);
            if (!points.has(target)) return run.record(`deck.extend() names ${target}, which ${owner} does not open`);
            points.get(target).set(run.mod.id, extension);
            tell(target);
        }

        function tell(target) {
            const page = IDENTITY.pageOf(TARGET.modOf(target));
            if (!page) return;
            PROTOCOL.extensionsChanged.send(page, {
                point: TARGET.pointOf(target),
                extensions: Object.fromEntries(points.get(target)),
            });
        }

        return { start };
    }
);
