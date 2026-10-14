DeckitModule.define(
    'deckit/service/deck/main',
    {
        uses: [
            'deckit/service/storage',
            'deckit/service/web/session',
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/deck/install',
            'deckit/service/deck/remove',
            'deckit/service/deck/catalog',
            'deckit/service/deck/runner',
            'deckit/service/mod/manifest',
            'deckit/service/deck/main-process',
            'deckit/service/deck/record',
            'deckit/service/deck/setting',
            'deckit/service/deck/export',
            'deckit/service/deck/protocol',
        ],
        provides: ['start'],
        runs: 'main',
    },
    (
        STORAGE,
        SESSION,
        LOG,
        IDENTITY,
        INSTALL,
        REMOVE,
        CATALOG,
        RUNNER,
        MANIFEST,
        MAIN_PROCESS,
        RECORD,
        SETTING,
        EXPORT,
        PROTOCOL
    ) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // Mods run in the views `makeView()` makes. What follows their runs starts before the runner launches any.
        function start({ makeView }) {
            forgetRemoved();
            CATALOG.start();
            MAIN_PROCESS.start();
            RECORD.start();
            SETTING.start();
            EXPORT.start();
            listen();
            RUNNER.start({ makeView });
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.mods.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return describe();
            });
            PROTOCOL.pick.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return pick();
            });
            PROTOCOL.install.handle(({ from }, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return install(from);
            });
            PROTOCOL.remove.handle(({ id, data }, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return remove(id, data);
            });
            PROTOCOL.relaunch.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                RUNNER.relaunch(id);
            });
            PROTOCOL.reveal.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                const mod = CATALOG.found().find((candidate) => candidate.id === id);
                if (!mod) throw new Error('no mod ' + id);
                return require('electron').shell.openPath(mod.folder);
            });
            PROTOCOL.count.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return STORAGE.count(id);
            });
            PROTOCOL.restartPending.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, 'deckit.mods');
                return MAIN_PROCESS.restartPending();
            });
        }

        // What Settings shows about every mod, loaded or not, and what each running one contributes. `state`: its
        // latest run's, null for one with none. `starting`: it is launching. `hides`: folders of the same id that are
        // not read.
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
                        mainProcess: {
                            running: MAIN_PROCESS.started(mod.id),
                            failure: MAIN_PROCESS.failure(mod.id),
                        },
                        requirements: mod.requirements.map((requirement) => ({
                            ...requirement,
                            ok: requirement.ok && running(requirement.id),
                        })),
                    };
                }),
                running: CATALOG.mods()
                    .filter((mod) => running(mod.id))
                    .map((mod) => {
                        const { summary, problem } = RUNNER.runOf(mod.id);
                        return { id: mod.id, name: mod.name, ...summary, problem };
                    }),
            };
        }

        // Picking and installing are two calls because the person is asked in between. A refused folder is refused
        // before they are asked about it.
        async function pick() {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                title: 'Choose a mod folder',
                buttonLabel: 'Choose',
                properties: ['openDirectory'],
                message: 'Pick the folder that has manifest.toml in it',
            });
            if (result.canceled || !result.filePaths[0]) return null;
            const from = result.filePaths[0];
            const manifest = INSTALL.installable(from, shadowed);
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
            MAIN_PROCESS.restartFor(manifest.id);
            CATALOG.refresh({ installed: manifest.id });
            await RUNNER.whenClosed(manifest.id);
            return {
                ...MANIFEST.of(manifest),
                restart: MAIN_PROCESS.restartPending().some(({ id }) => id === manifest.id),
            };
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
            MAIN_PROCESS.unload(id);
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
            await SESSION.forget(id);
            REMOVE.clearForgotten(id);
        }

        return { start };
    }
);
