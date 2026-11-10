import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as LIFECYCLE from '../runner/model/lifecycle.js';
import * as LISTENER from '../../../deckit-sdk/deckit/listener/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods as a mod with deckit.mods manages them: what it reads of every mod, installing and removing them, launching
// them, launching them again and quitting them, pinning the owner of each interface, and what one has stored where
// the core keeps it and in its pages' storage. A launch and a relaunch it asks for are told to `REQUEST` as its
// requests of that mod. `pages` is the environment's, which keeps what a mod's pages stored.
export function createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, REQUEST, pages }) {
    // MARK: - Property
    const TRANSITIONS = ['launching', 'terminating']; // a run's states between running and not
    const watching = new Set(); // the pages told when what `list`, `runs` or `interfaces` answer may have changed
    const installedListeners = new Set(); // told of a mod installed
    const removedListeners = new Set(); // told of a mod removed
    const erasers = new Set(); // asked to erase what they keep of a mod removed with its data

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        eraseUncleared();
        listen();
    }

    // `listener(id)` is told of a mod installed, once the one it replaced, if that ran, has launched again. Answers its
    // off.
    function onInstalled(listener) {
        installedListeners.add(listener);
        return () => installedListeners.delete(listener);
    }

    // `listener(id)` is told of a mod removed, before what runs in its place launches, while its run, if any, has not
    // ended. Answers its off.
    function onRemoved(listener) {
        removedListeners.add(listener);
        return () => removedListeners.delete(listener);
    }

    // `eraser(id)` is asked to erase what it keeps outside the core of a mod removed with its data, answering a promise
    // that rejects where it could not: the erasure is tried again at the next start. Answers its off.
    function onErase(eraser) {
        erasers.add(eraser);
        return () => erasers.delete(eraser);
    }

    // MARK: - Private
    function listen() {
        PROTOCOL.list.handle(() => list());
        PROTOCOL.runs.handle(() => runs());
        PROTOCOL.interfaces.handle(() => interfaces());
        PROTOCOL.install.handle(({ folder, dryRun }) => install(folder, { dryRun }));
        PROTOCOL.remove.handle(({ id, erase }) => remove(id, erase));
        PROTOCOL.launch.handle(({ id }, sender) => {
            const by = IDENTITY.modFrom(sender).id;
            REQUEST.tell(by, id);
            return RUNNER.launch(id, by);
        });
        PROTOCOL.relaunch.handle(({ id }, sender) => {
            const by = IDENTITY.modFrom(sender).id;
            REQUEST.tell(by, id);
            return RUNNER.relaunch([id], by);
        });
        PROTOCOL.quit.handle(({ id }, sender) => {
            const by = IDENTITY.modFrom(sender).id;
            return RUNNER.quit(id, by);
        });
        PROTOCOL.pin.handle(({ interface: named, mod }) => CATALOG.pin(named, mod));
        PROTOCOL.usage.handle(async ({ id }) => {
            const usage = await CORE.request('storage/usage', { mod: id });
            return { ...usage, values: { count: await pages.countStorage(id) } };
        });
        PROTOCOL.watchMods.on((_payload, sender) => {
            if (watching.has(sender)) return;
            watching.add(sender);
            IDENTITY.whenPageEnds(sender, () => watching.delete(sender));
        });
        const tell = () => {
            for (const page of watching) PROTOCOL.modsChanged.send(page);
        };
        CATALOG.onChange(tell);
        for (const name of LIFECYCLE.NOTIFICATIONS) RUNNER.observe(name, tell);
        RUNNER.onProblem(tell);
    }

    // Every mod the catalog found, in the mods' order, each `{ id, mod, refusal, folder, installed, shipped, system,
    // hides }`: `mod` its manifest, absent for one refused; `refusal`, `{ stage, kind, message }` at `read`, absent
    // for one taken, `kind` null for a problem that is no refusal; `installed`, whether it is a copy in the core's
    // mods folder; `shipped`, whether the app ships it; `system`, whether it is a system mod; `hides`, folders of the
    // same id that are not read.
    function list() {
        return CATALOG.found().map((mod) => ({
            id: mod.id,
            ...(mod.problem ? { refusal: { stage: 'read', ...mod.problem } } : { mod: mod.manifest }),
            folder: mod.folder,
            installed: mod.installed,
            shipped: mod.shipped,
            system: mod.system,
            hides: mod.hides,
        }));
    }

    // The latest run of each mod that loads, in the mods' order, each `{ id, state, refusal, problem, failed,
    // launchedAt, summary }`: `refusal`, `{ stage, kind, message }`, what it is refused with at launch, absent while it
    // is none; `summary`, what the run's layers report it contributes, null before it runs and once it has ended, and
    // while it launches or terminates that of its latest run that launched, if any. A mod with no run since the start
    // is `notRunning`, with nothing else.
    function runs() {
        return CATALOG.mods().map(({ id }) => {
            const run = RUNNER.runOf(id);
            if (!run) return { id, state: 'notRunning', problem: null, failed: false, launchedAt: null, summary: null };
            return {
                id,
                state: run.state,
                ...(run.refusal && { refusal: run.refusal }),
                problem: run.problem,
                failed: run.failed,
                launchedAt: run.launchedAt,
                summary: summaryOf(id, run),
            };
        });
    }

    function summaryOf(id, run) {
        if (run.state === 'running') return run.summary;
        if (!TRANSITIONS.includes(run.state)) return null;
        return RUNNER.launchedOf(id)?.summary ?? null;
    }

    // Each interface a mod provides or uses, `{ interface, name, owner, pinned, providers, clients }`, as the catalog
    // read it, `clients` each mod that uses it, `{ id, major, problem }`, in the mods' order: `problem` why it reaches
    // no one by it, or null.
    function interfaces() {
        const found = CATALOG.found();
        return CATALOG.interfaces().map((queue) => ({
            ...queue,
            clients: found.flatMap(({ id, uses }) =>
                uses
                    .filter((use) => use.interface === queue.interface)
                    .map(({ major, problem }) => ({ id, major, problem: problem ?? null }))
            ),
        }));
    }

    // Any folder, since a mod may already run code in this process: restricting where it comes from guards
    // nothing. What a removal of the same id left to erase is erased first, so erasing it never reaches this one.
    // Answers the manifest of what it installs with `replaces`, whether it takes the place of an installed mod, and
    // with `dryRun` changes nothing.
    async function install(from, { dryRun }) {
        if (dryRun) return answerOf(await CATALOG.install(from, { dryRun }));
        const { id } = (await CATALOG.install(from, { dryRun: true })).manifest;
        if ((await CORE.request('erasure/uncleared')).includes(id)) await erase(id);
        const installation = await CATALOG.install(from);
        await CATALOG.refresh();
        await RUNNER.whenReconciled();
        for (const listener of installedListeners)
            LISTENER.wrap(listener, 'what hears a mod installed')(installation.manifest.id);
        return answerOf(installation);
    }

    function answerOf({ manifest, replaces }) {
        return { ...manifest, replaces };
    }

    // What runs in its place is told before its run ends. Its run has ended, stop() and all, and its page closed,
    // before what it stored is taken, so nothing writes it back. Answers whether what it stored was erased.
    async function remove(id, erasing) {
        const keeps = await CATALOG.remove(id);
        for (const listener of removedListeners) LISTENER.wrap(listener, 'what hears a mod removed')(id);
        await CATALOG.refresh();
        await RUNNER.whenReconciled();
        if (!erasing || !keeps) return { erased: false };
        await erase(id);
        return { erased: true };
    }

    // A mod removed with its data, whose pages' storage or what an eraser keeps of it was not cleared then, or what the
    // core keeps of it not erased: erased here.
    async function eraseUncleared() {
        const uncleared = await CORE.request('erasure/uncleared').catch((error) => {
            LOG.warn('could not read which mods removed are left to erase', error);
            return [];
        });
        for (const id of uncleared) {
            erase(id).catch((error) => LOG.warn(`could not erase what is kept of ${id}`, error));
        }
    }

    // What a mod removed with its data kept outside its own folder: the core erases its data folder, its records and
    // what is kept for it in the core, and notes it until its pages' storage and what each eraser keeps of it outside
    // the core are cleared here. Each is cleared whether or not another fails; the note goes only once all are, so
    // a failure is tried again at the next start.
    async function erase(id) {
        const outcomes = await Promise.allSettled([
            CORE.request('erasure/erase', { mod: id }),
            pages.clearStorage(id),
            ...[...erasers].map((eraser) => Promise.resolve().then(() => eraser(id))),
        ]);
        const failed = outcomes.find(({ status }) => status === 'rejected');
        if (failed) throw failed.reason;
        await CORE.request('erasure/cleared', { mod: id });
    }

    return { start, onInstalled, onRemoved, onErase };
}
