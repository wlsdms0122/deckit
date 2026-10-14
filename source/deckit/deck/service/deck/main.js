DeckitModule.define(
    'deck/service/deck/main',
    {
        uses: [
            'deck/service/storage',
            'deck/service/log/main',
            'deck/service/deck/identity',
            'deck/service/deck/install',
            'deck/service/deck/remove',
            'deck/service/deck/catalog',
            'deck/service/deck/runner',
            'deck/service/mod/manifest',
            'deck/service/deck/record',
            'deck/service/deck/setting',
            'deck/service/deck/export',
            'deck/service/deck/extension',
            'deck/service/deck/protocol',
            'deck/service/mod/permission',
            'deck/service/mod/lifecycle',
        ],
        provides: ['start', 'wouldInstall'],
        runs: 'main',
    },
    (
        STORAGE,
        LOG,
        IDENTITY,
        INSTALL,
        REMOVE,
        CATALOG,
        RUNNER,
        MANIFEST,
        RECORD,
        SETTING,
        EXPORT,
        EXTENSION,
        PROTOCOL,
        MOD_PERMISSION,
        LIFECYCLE
    ) => {
        // MARK: - Property
        let layer = null;
        const watching = new Set(); // the pages told when what `mods` answers may have changed

        // MARK: - Initializer
        // MARK: - Public
        // Mods run in the views `makeView()` makes. What follows their runs starts before the runner launches any.
        // What is on deck is told of a mod's page as it is made (`preparePage(webContents, mod)`), of a mod installed,
        // once what runs in its place has launched, and answers what it adds to what install answers
        // (`installed(id)`), and of one removed (`removed(id)`); it is asked what it knows of a mod (`describe(mod)`)
        // and to clear what it keeps of a mod removed with its data (`forget(id)`, a promise).
        function start({ makeView, preparePage, describe: facts, installed, removed, forget: clear }) {
            layer = { facts, installed, removed, clear };
            forgetRemoved();
            CATALOG.start();
            RECORD.start();
            SETTING.start();
            EXPORT.start();
            EXTENSION.start();
            listen();
            RUNNER.start({ makeView, preparePage });
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.mods.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
                return describe();
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
                RUNNER.relaunch(id);
            });
            PROTOCOL.count.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, MOD_PERMISSION.MODS);
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
        // `state`: its latest run's, null for one with none. `starting`: it is launching. `hides`: folders of the same
        // id that are not read.
        function describe() {
            const running = (id) => RUNNER.runOf(id)?.state === 'running';
            return {
                installed: CATALOG.found().map((mod) => {
                    const run = RUNNER.runOf(mod.id);
                    return {
                        ...MANIFEST.of(mod),
                        folder: mod.folder,
                        installed: mod.installed,
                        shipped: mod.shipped,
                        hides: mod.hides,
                        problem: mod.problem || run?.problem || null,
                        state: run?.state || null,
                        starting: run?.state === 'launching',
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

        // Any folder, since a mod may already run code in this process: restricting where it comes from guards
        // nothing.
        async function install(from) {
            const manifest = INSTALL.install(from, shadowed);
            CATALOG.refresh({ installed: manifest.id });
            await RUNNER.whenClosed(manifest.id);
            return { ...layer.installed(manifest.id), ...MANIFEST.of(manifest) };
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
            const removed = { data: data && REMOVE.forgetData(id) };
            if (removed.data) await forget(id);
            return removed;
        }

        // A mod removed with its data, whose pages' storage and sessions were not cleared then: cleared here.
        function forgetRemoved() {
            for (const id of REMOVE.forgotten()) {
                forget(id).catch((error) => LOG.warn(`could not clear the web storage of ${id}`, error));
            }
        }

        // The record that it is to be cleared goes only once it is, so a failure is tried again at the next start.
        async function forget(id) {
            await layer.clear(id);
            REMOVE.clearForgotten(id);
        }

        return { start, wouldInstall };
    }
);
