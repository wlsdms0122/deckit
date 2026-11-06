import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../mod/permission.js';
import * as LIFECYCLE from '../mod/lifecycle.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods as a mod with deckit.mods manages them: what it reads of every mod, and installing, removing, launching
// again, loading and quitting as the person asks, putting them in an order, pinning the owner of each interface,
// approving the mods that ask to start with the app and what one has where deck keeps it.
// `pages` is the environment's, which keeps what a mod's pages stored.
export function createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, pages }) {
    // MARK: - Property
    let layer = null;
    const TRANSITIONS = ['launching', 'terminating']; // a run's states between running and not
    const watching = new Set(); // the pages told when what `mods` answers may have changed

    // MARK: - Initializer
    // MARK: - Public
    // What is on deck is told of a mod installed, once the one it replaced, if that ran, has launched again, and
    // answers what it adds to what install answers (`installed(id)`, which may answer a promise), and of one removed
    // (`removed(id)`). It is asked what it knows of a mod (`facts(mod)`), and tells when that may have changed
    // (`onFactsChange(tell)`), and to erase what it keeps outside deck of a mod removed with its data (`erase(id)`, a
    // promise).
    function start(given) {
        layer = given;
        eraseUncleared();
        listen();
    }

    // What a folder would install, asked before the person is: its manifest, and whether it replaces an installed
    // mod. Refused with why for a folder install refuses.
    async function planInstall(from) {
        const { manifest, replaces } = await CATALOG.planInstall(from);
        return { ...manifest, from, replaces };
    }

    // MARK: - Private
    function listen() {
        PROTOCOL.mods.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return describe();
        });
        PROTOCOL.planInstall.handle(({ from }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return planInstall(from);
        });
        PROTOCOL.install.handle(({ from }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return install(from);
        });
        PROTOCOL.remove.handle(({ id, data }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return remove(id, data);
        });
        PROTOCOL.relaunch.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return RUNNER.relaunch([id]);
        });
        PROTOCOL.quit.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return RUNNER.unload([id]);
        });
        PROTOCOL.load.handle(({ ids }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return RUNNER.open(ids);
        });
        PROTOCOL.arrange.handle(({ ids }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return CATALOG.arrange(ids);
        });
        PROTOCOL.pin.handle(({ interface: named, mod }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return CATALOG.pin(named, mod);
        });
        PROTOCOL.approveStartup.handle(({ id, approved }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return CATALOG.approveStartup(id, approved);
        });
        PROTOCOL.usage.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return CORE.request('storage/usage', { mod: id });
        });
        PROTOCOL.watchMods.on((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            if (watching.has(sender)) return;
            watching.add(sender);
            IDENTITY.whenPageEnds(sender, () => watching.delete(sender));
        });
        const tell = () => {
            for (const page of watching) PROTOCOL.modsChanged.send(page);
        };
        CATALOG.onChange(tell);
        layer.onFactsChange?.(tell);
        for (const name of LIFECYCLE.NOTIFICATIONS) RUNNER.observe(name, tell);
        RUNNER.onProblem(tell);
    }

    // What a mod with deckit.mods reads of every mod, loaded or not, and what each running one contributes. `found`:
    // every mod the catalog found, in the mods' order whether it loads or not, each with `installed`, whether it is a
    // copy in deck's mods folder, `problem`, why it does not load, `declarationProblems`, what is wrong with what it
    // declares, `startupApproved`, whether the person approved it to start with the app, `run`, its latest run's
    // `state`, `problem`, `origin`, `failed`, `relaunchLimited` and `launchedAt`, null for one with no sandbox, `hides`, folders of
    // the same id that are not read, `launched`, while it starts or stops again, what its latest run that launched
    // contributed, as `running` lists it, `relations`, each mod in its [dependencies] and whether that one runs, and
    // `uses`, each interface it uses and what it comes to. `interfaces`: each interface's queue of providers and its
    // owner, as the catalog read it.
    function describe() {
        const running = (id) => RUNNER.runOf(id)?.state === 'running';
        return {
            found: CATALOG.found().map((mod) => {
                const run = RUNNER.runOf(mod.id);
                return {
                    ...mod.manifest,
                    folder: mod.folder,
                    installed: mod.installed,
                    shipped: mod.shipped,
                    hides: mod.hides,
                    problem: mod.problem ?? null,
                    declarationProblems: mod.declarationProblems,
                    startupApproved: mod.startupApproved,
                    run: run && {
                        state: run.state,
                        problem: run.problem,
                        origin: run.origin,
                        failed: run.failed,
                        relaunchLimited: run.relaunchLimited,
                        launchedAt: run.launchedAt,
                    },
                    launched:
                        TRANSITIONS.includes(run?.state) && RUNNER.launchedOf(mod.id)
                            ? entryOf(mod, RUNNER.launchedOf(mod.id))
                            : null,
                    ...layer.facts(mod),
                    relations: mod.relations.map((relation) => ({
                        ...relation,
                        running: !!relation.id && running(relation.id),
                    })),
                    uses: mod.uses,
                    dependents: mod.dependents,
                };
            }),
            running: CATALOG.mods()
                .filter((mod) => running(mod.id))
                .map((mod) => entryOf(mod, RUNNER.runOf(mod.id))),
            interfaces: CATALOG.interfaces(),
        };
    }

    function entryOf(mod, { summary, problem }) {
        return { id: mod.id, name: mod.name, ...summary, problem };
    }

    // Any folder, since a mod may already run code in this process: restricting where it comes from guards
    // nothing. What a removal of the same id left to erase is erased first, so erasing it never reaches this one.
    async function install(from) {
        const { id } = (await CATALOG.planInstall(from)).manifest;
        if ((await CORE.request('erasure/uncleared')).includes(id)) await erase(id);
        const manifest = await CATALOG.install(from);
        await CATALOG.refresh();
        await RUNNER.whenReconciled();
        return { ...(await layer.installed(manifest.id)), ...manifest };
    }

    // What runs in its place is told before its run ends. Its run has ended, stop() and all, and its page closed,
    // before what it stored is taken, so nothing writes it back.
    async function remove(id, data) {
        const keeps = await CATALOG.remove(id);
        layer.removed(id);
        await CATALOG.refresh();
        await RUNNER.whenReconciled();
        if (!data || !keeps) return { data: false };
        await erase(id);
        return { data: true };
    }

    // A mod removed with its data, whose pages' storage or what the layer keeps of it was not cleared then, or what the
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
    // what the layers above deck keep for it, and notes it until its pages' storage and what the layer keeps of it
    // outside deck are cleared here. Each is cleared whether or not another fails; the note goes only once all are, so
    // a failure is tried again at the next start.
    async function erase(id) {
        const outcomes = await Promise.allSettled([
            CORE.request('erasure/erase', { mod: id }),
            pages.clearStorage(id),
            layer.erase(id),
        ]);
        const failed = outcomes.find(({ status }) => status === 'rejected');
        if (failed) throw failed.reason;
        await CORE.request('erasure/cleared', { mod: id });
    }

    return { start, planInstall };
}
