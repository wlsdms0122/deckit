import * as PROTOCOL from './protocol.js';
import * as SCOPED from '../mod/model/scoped-name.js';

export function createExtension({ IDENTITY, RUNNER, EXPORT }) {
    // MARK: - Property
    // an open point's id -> mod id -> { values, functions }: what each mod extends it with
    const points = new Map();

    // MARK: - Initializer
    // MARK: - Public
    // A mod opens an extension point and another extends it: the one that extends requires the one that opened it,
    // so it starts after that one has and ends before it does, or has it as an optional dependency, and then what
    // it extends the point with is held and handed again each time the point's mod launches. What it extends a
    // point with stays in its own page and is called there through main; the point's mod is told each time what
    // extends it changes.
    function start() {
        // A point's mod hears what extends it once, with all deck holds for it.
        RUNNER.observe('didLaunch', (run) => {
            for (const name of run.contributions.extensionPoints)
                points.set(SCOPED.scopedName(run.mod.id, name), new Map());
            const changed = new Set();
            for (const [point, extension] of Object.entries(run.contributions.extensions))
                changed.add(extend(run, point, extension));
            for (const { run: other } of RUNNER.runs()) {
                if (other.state !== 'running' || !Object.hasOwn(other.mod.optional, run.mod.id)) continue;
                for (const [point, extension] of Object.entries(other.contributions.extensions))
                    if (SCOPED.modOf(point) === run.mod.id) changed.add(extend(other, point, extension));
            }
            for (const point of changed) if (point) tell(point);
        });
        RUNNER.observe('didTerminate', ({ mod }) => {
            for (const point of [...points.keys()]) {
                if (SCOPED.modOf(point) === mod.id) points.delete(point);
                else if (points.get(point).delete(mod.id)) tell(point);
            }
        });
        PROTOCOL.callExtension.handle(async ({ run: number, mod, point, path, args }, sender) => {
            const caller = IDENTITY.modFrom(sender);
            if (SCOPED.modOf(point) !== caller.id) throw new Error(`${point} is not a point of ${caller.id}`);
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
    // to an optional dependency, which may not run, or not open the point, and then nothing extends the point and
    // nothing is wrong. Answers the point it extended, or null.
    function extend(run, point, extension) {
        const owner = SCOPED.modOf(point);
        const optional = Object.hasOwn(run.mod.optional, owner);
        if (!Object.hasOwn(run.mod.requires, owner) && !optional) {
            RUNNER.reportProblem(
                run,
                `deck.extend() names ${point}, but ${owner} is in neither [requires] nor [optional]`
            );
            return null;
        }
        if (optional && (!EXPORT.usable(run.mod, owner) || !points.has(point))) return null;
        if (!points.has(point)) {
            RUNNER.reportProblem(run, `deck.extend() names ${point}, which ${owner} does not open`);
            return null;
        }
        points.get(point).set(run.mod.id, extension);
        return point;
    }

    function tell(point) {
        const page = IDENTITY.pageOf(SCOPED.modOf(point));
        if (!page) return;
        PROTOCOL.extensionsChanged.send(page, {
            name: SCOPED.nameOf(point),
            extensions: Object.fromEntries(points.get(point)),
        });
    }

    return { start, pointsExtendedBy };
}
