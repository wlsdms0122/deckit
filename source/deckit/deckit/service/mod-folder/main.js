DeckitModule.define(
    'deckit/service/mod-folder/main',
    {
        uses: [
            'deck/service/deck/identity',
            'deck/service/deck/catalog',
            'deck/service/deck/main',
            'deckit/service/mod-folder/protocol',
            'deck/service/mod/permission',
        ],
        provides: ['start'],
        runs: 'main',
    },
    (IDENTITY, CATALOG, DECK, PROTOCOL, PERMISSION) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.pick.handle((_payload, sender) => {
                IDENTITY.modFrom(sender, PERMISSION.MODS);
                return pick();
            });
            PROTOCOL.reveal.handle(({ id }, sender) => {
                IDENTITY.modFrom(sender, PERMISSION.MODS);
                const mod = CATALOG.found().find((candidate) => candidate.id === id);
                if (!mod) throw new Error('no mod ' + id);
                require('electron').shell.showItemInFolder(mod.folder);
            });
        }

        // MARK: - Private
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
            return DECK.wouldInstall(result.filePaths[0]);
        }

        return { start };
    }
);
