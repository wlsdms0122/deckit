import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../mod/permission.js';
import * as LIFECYCLE from '../mod/lifecycle.js';

const PROTOCOL = IPC.bindAll(DECLARED);

// The mods as a mod with deckit.mods manages them: what it reads of every mod, and installing, removing, launching
// again and counting what one stored.
export function createMods({ CORE, LOG, IDENTITY, CATALOG, RUNNER, SANDBOX, STORAGE, RECORD, EXTENSION }) {
    // MARK: - Property
    let layer = null;
    const TRANSITIONS = ['launching', 'terminating']; // a run's states between running and not
    const watching = new Set(); // the pages told when what `mods` answers may have changed

    // MARK: - Initializer
    // MARK: - Public
    // What is on deck is told of a mod installed, once what runs in its place has launched, and answers what it adds
    // to what install answers (`installed(id)`, which may answer a promise), and of one removed (`removed(id)`). It
    // is asked what it knows of a mod (`facts(mod)`), and tells when that may have changed (`onFactsChange(tell)`),
    // and to clear the sessions it made for a mod removed with its data (`clearSessions(id)`, a promise).
    function start(given) {
        layer = given;
        eraseUncleared();
        listen();
    }

    // What a folder would install, asked before the person is: its manifest, and whether it replaces an installed
    // mod. Refused with why for a folder install refuses.
    async function wouldInstall(from) {
        const manifest = await CATALOG.wouldInstall(from);
        return {
            ...manifest,
            from,
            replaces: CATALOG.found().some((mod) => mod.id === manifest.id && mod.installed),
        };
    }

    // MARK: - Private
    function listen() {
        PROTOCOL.mods.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return describe();
        });
        // What a mod installed may do is granted as it installs, so the person installs it: during their click or key.
        PROTOCOL.install.handle(({ from }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            if (!IDENTITY.consumeUserActivation(sender))
                throw Object.assign(new Error('a mod is installed during a click or a key of the person'), {
                    kind: 'REFUSED',
                });
            return install(from);
        });
        PROTOCOL.remove.handle(({ id, data }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return remove(id, data);
        });
        PROTOCOL.relaunch.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return RUNNER.relaunch(id);
        });
        PROTOCOL.count.handle(({ id }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
            return stored(id);
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

    // What a mod with deckit.mods reads of every mod, loaded or not, and what each running one contributes.
    // `found`: every mod the catalog found, those that load in the person's order and then the rest, each with
    // `installed`, whether it is a copy in deck's mods folder, `state`, its latest run's, null for one with none,
    // `hides`, folders of the same id that are not read, and `launched`, while it starts or stops again, what its
    // latest run that launched contributed, as `running` lists it.
    function describe() {
        const running = (id) => RUNNER.runOf(id)?.state === 'running';
        return {
            found: [...CATALOG.mods(), ...CATALOG.found().filter((mod) => mod.problem)].map((mod) => {
                const run = RUNNER.runOf(mod.id);
                return {
                    ...mod.manifest,
                    folder: mod.folder,
                    installed: mod.installed,
                    shipped: mod.shipped,
                    hides: mod.hides,
                    problem: mod.problem || run?.problem || null,
                    state: run?.state || null,
                    launched:
                        TRANSITIONS.includes(run?.state) && RUNNER.launchedOf(mod.id)
                            ? entryOf(mod, RUNNER.launchedOf(mod.id))
                            : null,
                    ...layer.facts(mod),
                    dependencies: mod.dependencies.map((dependency) => ({
                        ...dependency,
                        ok: dependency.ok && running(dependency.id),
                    })),
                };
            }),
            running: CATALOG.mods()
                .filter((mod) => running(mod.id))
                .map((mod) => entryOf(mod, RUNNER.runOf(mod.id))),
        };
    }

    function entryOf(mod, { summary, problem }) {
        return { id: mod.id, name: mod.name, ...summary, extends: EXTENSION.pointsExtendedBy(mod.id), problem };
    }

    // Any folder, since a mod may already run code in this process: restricting where it comes from guards
    // nothing. What a removal of the same id left to erase is erased first, so erasing it never reaches this one.
    async function install(from) {
        const { id } = await CATALOG.wouldInstall(from);
        if ((await CORE.request('erasure/uncleared')).includes(id)) await erase(id);
        const manifest = await CATALOG.install(from);
        await CATALOG.refresh();
        await RUNNER.whenClosed(manifest.id);
        return { ...(await layer.installed(manifest.id)), ...manifest };
    }

    // What runs in its place is told before its run ends. Its run has ended, stop() and all, and its page closed,
    // before what it stored is taken, so nothing writes it back.
    async function remove(id, data) {
        const keeps = await CATALOG.remove(id);
        layer.removed(id);
        await CATALOG.refresh();
        await RUNNER.whenClosed(id);
        if (!data || !keeps) return { data: false };
        await erase(id);
        return { data: true };
    }

    // What a mod stored, in its data folder and its records: `{ count, capped, hidden }`.
    async function stored(id) {
        const [data, records] = await Promise.all([STORAGE.count(id), RECORD.count(id)]);
        return { count: data.count + records.count, capped: data.capped, hidden: data.hidden || records.hidden };
    }

    // A mod removed with its data, whose pages' storage and sessions were not cleared then, or what the core keeps of
    // it not erased: erased here.
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
    // its settings, and notes it until its pages' storage and its sessions are cleared here. Each is cleared whether
    // or not another fails; the note goes only once all are, so a failure is tried again at the next start.
    async function erase(id) {
        const outcomes = await Promise.allSettled([
            CORE.request('erasure/erase', { mod: id }),
            SANDBOX.clearSessions(id),
            layer.clearSessions(id),
        ]);
        const failed = outcomes.find(({ status }) => status === 'rejected');
        if (failed) throw failed.reason;
        await CORE.request('erasure/cleared', { mod: id });
    }

    return { start, wouldInstall };
}
