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
        MAIN_PROCESS,
        RECORD,
        SETTING,
        EXPORT,
        PROTOCOL
    ) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // What it takes to run plugins, before the runner runs them.
        function start() {
            forgetRemoved();
            MAIN_PROCESS.start();
            RECORD.start();
            SETTING.start({ ordered: () => CATALOG.plugins().map(({ id }) => id) });
            EXPORT.start();
            CATALOG.start();
            listen();
        }

        // MARK: - Private
        function listen() {
            PROTOCOL.plugins.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return describe();
            });
            PROTOCOL.pick.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return pick();
            });
            PROTOCOL.install.handle(({ from }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return install(from);
            });
            PROTOCOL.remove.handle(({ id, data }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return remove(id, data);
            });
            PROTOCOL.reveal.handle(({ id }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                const entry = CATALOG.entries().find((candidate) => candidate.id === id);
                if (!entry) throw new Error('no plugin ' + id);
                return require('electron').shell.openPath(entry.folder);
            });
            PROTOCOL.count.handle(({ id }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return STORAGE.count(id);
            });
            PROTOCOL.restartPending.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugins');
                return MAIN_PROCESS.restartPending();
            });
        }

        // What Settings shows about every plugin, loaded or not, and what each running one contributes. `starting`: it
        // is launching. `hides`: folders of the same id that are not read.
        function describe() {
            const running = (id) => RUNNER.runOf(id)?.state === 'running';
            return {
                installed: CATALOG.entries().map((entry) => ({
                    ...CATALOG.manifestOf(entry),
                    folder: entry.folder,
                    installed: entry.installed,
                    shipped: entry.shipped,
                    hides: entry.hides,
                    problem: entry.problem || RUNNER.runOf(entry.id)?.problem || null,
                    starting: RUNNER.runOf(entry.id)?.state === 'launching',
                    mainProcess: { running: MAIN_PROCESS.running(entry.id), failure: MAIN_PROCESS.failure(entry.id) },
                    requirements: entry.requirements.map((requirement) => ({
                        ...requirement,
                        ok: requirement.ok && running(requirement.id),
                    })),
                })),
                running: CATALOG.plugins()
                    .filter((entry) => running(entry.id))
                    .map((entry) => {
                        const { summary, problem } = RUNNER.runOf(entry.id);
                        return { id: entry.id, name: entry.name, ...summary, problem };
                    }),
            };
        }

        // Picking and installing are two calls because the person is asked in between. A refused folder is refused
        // before they are asked about it.
        async function pick() {
            const { dialog } = require('electron');
            const result = await dialog.showOpenDialog({
                title: 'Choose a plugin folder',
                buttonLabel: 'Choose',
                properties: ['openDirectory'],
                message: 'Pick the folder that has manifest.toml in it',
            });
            if (result.canceled || !result.filePaths[0]) return null;
            const from = result.filePaths[0];
            const manifest = INSTALL.installable(from, shadowed);
            return {
                ...CATALOG.manifestOf(manifest),
                from,
                replaces: CATALOG.entries().some((entry) => entry.id === manifest.id && entry.installed),
            };
        }

        // Any folder, since a plugin may already run code in this process: restricting where it comes from guards
        // nothing.
        async function install(from) {
            const manifest = INSTALL.install(from, shadowed);
            MAIN_PROCESS.restartFor(manifest.id);
            CATALOG.refresh({ installed: manifest.id });
            await RUNNER.settled(manifest.id);
            return {
                ...CATALOG.manifestOf(manifest),
                restart: MAIN_PROCESS.restartPending().some(({ id }) => id === manifest.id),
            };
        }

        // A source folder of the same id would hide the installed copy.
        function shadowed(manifest) {
            const source = CATALOG.entries().find((entry) => entry.id === manifest.id && !entry.installed);
            return source ? `${manifest.id} is read from ${source.folder}, which would hide the installed copy` : '';
        }

        // Its run has ended, stop() and all, and its page closed, before what it stored is taken, so nothing writes it
        // back.
        async function remove(id, data) {
            const entry = CATALOG.entries().find((candidate) => candidate.id === id);
            if (entry && !entry.installed)
                throw new Error(`${id} is read from ${entry.folder}, not installed, so it is removed there`);
            REMOVE.remove(id);
            MAIN_PROCESS.unload(id);
            CATALOG.refresh();
            await RUNNER.settled(id);
            const removed = { data: data && REMOVE.forgetData(id) };
            if (removed.data) await forget(id);
            return removed;
        }

        // A plugin removed with its data, whose pages' storage and sessions were not cleared then: cleared here.
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
