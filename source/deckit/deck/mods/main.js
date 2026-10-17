import * as PROTOCOL from './protocol.js';
import * as MOD_PERMISSION from '../mod/permission.js';
import * as LIFECYCLE from '../mod/lifecycle.js';

// The mods as a mod with deckit.mods manages them: what it reads of every mod, and installing, removing, launching
// again and counting what one stored.
export function createMods({ LOG, IDENTITY, INSTALL, REMOVE, CATALOG, RUNNER, SANDBOX, MANIFEST, STORAGE, EXTENSION }) {
    // MARK: - Property
    let layer = null;
    const watching = new Set(); // the pages told when what `mods` answers may have changed

    // MARK: - Initializer
    // MARK: - Public
    // What is on deck is told of a mod installed, once what runs in its place has launched, and answers what it adds
    // to what install answers (`installed(id)`, which may answer a promise), and of one removed (`removed(id)`); it is asked what it knows of a
    // mod (`facts(mod)`) and to clear the sessions it made for a mod removed with its data (`clearSessions(id)`, a
    // promise).
    function start(given) {
        layer = given;
        clearUncleared();
        listen();
    }

    // What a folder would install, asked before the person is: its manifest, and whether it replaces an installed
    // mod. Throws for a folder install refuses, with why.
    function wouldInstall(from) {
        const manifest = INSTALL.wouldInstall(from, shadowed);
        return {
            ...MANIFEST.of(manifest),
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
            // A mod id names a folder of deck's and nothing outside it.
            const problem = MANIFEST.idProblem(id);
            if (problem) throw Object.assign(new Error(problem), { kind: 'REFUSED' });
            return STORAGE.count(id);
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
        for (const name of LIFECYCLE.NOTIFICATIONS) RUNNER.observe(name, tell);
    }

    // What a mod with deckit.mods reads of every mod, loaded or not, and what each running one contributes.
    // `found`: every mod the catalog found, those that load in the person's order and then the rest, each with `installed`, whether it is a copy in deck's mods folder, and
    // `state`, its latest run's, null for one with none; `hides`: folders of the same id that are not read.
    function describe() {
        const running = (id) => RUNNER.runOf(id)?.state === 'running';
        return {
            found: [...CATALOG.mods(), ...CATALOG.found().filter((mod) => mod.problem)].map((mod) => {
                const run = RUNNER.runOf(mod.id);
                return {
                    ...MANIFEST.of(mod),
                    folder: mod.folder,
                    installed: mod.installed,
                    shipped: mod.shipped,
                    hides: mod.hides,
                    problem: mod.problem || run?.problem || null,
                    state: run?.state || null,
                    ...layer.facts(mod),
                    dependencies: mod.dependencies.map((dependency) => ({
                        ...dependency,
                        ok: dependency.ok && running(dependency.id),
                    })),
                };
            }),
            running: CATALOG.mods()
                .filter((mod) => running(mod.id))
                .map((mod) => {
                    const { summary, problem } = RUNNER.runOf(mod.id);
                    return {
                        id: mod.id,
                        name: mod.name,
                        ...summary,
                        extends: EXTENSION.pointsExtendedBy(mod.id),
                        problem,
                    };
                }),
        };
    }

    // Any folder, since a mod may already run code in this process: restricting where it comes from guards
    // nothing.
    async function install(from) {
        const manifest = INSTALL.install(from, shadowed);
        CATALOG.refresh({ installed: manifest.id });
        await RUNNER.whenClosed(manifest.id);
        return { ...(await layer.installed(manifest.id)), ...MANIFEST.of(manifest) };
    }

    // A source folder of the same id would hide the installed copy.
    function shadowed(manifest) {
        const source = CATALOG.found().find((mod) => mod.id === manifest.id && !mod.installed);
        return source ? `${manifest.id} is read from ${source.folder}, which would hide the installed copy` : '';
    }

    // Its run has ended, stop() and all, and its page closed, before what it stored is taken, so nothing writes it
    // back.
    async function remove(id, data) {
        const mod = CATALOG.found().find((candidate) => candidate.id === id);
        if (mod && !mod.installed)
            throw new Error(`${id} is read from ${mod.folder}, not installed, so it is removed there`);
        REMOVE.remove(id);
        layer.removed(id);
        CATALOG.refresh();
        await RUNNER.whenClosed(id);
        const removed = { data: data && REMOVE.eraseData(id) };
        if (removed.data) await clearSessions(id);
        return removed;
    }

    // A mod removed with its data, whose pages' storage and sessions were not cleared then: cleared here.
    function clearUncleared() {
        for (const id of REMOVE.uncleared()) {
            clearSessions(id).catch((error) => LOG.warn(`could not clear the web storage of ${id}`, error));
        }
    }

    // The record that it is to be cleared goes only once it is, so a failure is tried again at the next start.
    async function clearSessions(id) {
        await SANDBOX.clearSessions(id);
        await layer.clearSessions(id);
        REMOVE.cleared(id);
    }

    return { start, wouldInstall };
}
