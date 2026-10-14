// Between a page of a mod with deckit.mods and main, about the mods.
DeckitModule.define(
    'deck/protocol',
    {
        uses: ['core/ipc'],
        provides: ['mods', 'install', 'remove', 'relaunch', 'count', 'watchMods', 'modsChanged'],
        runs: 'electron',
    },
    (IPC) => ({
        // deckit.mods
        mods: IPC.rendererToMain('deck:mods', {}, { reply: true, sync: true }),
        install: IPC.rendererToMain('deck:mods-install', { from: 'string' }, { reply: true }),
        remove: IPC.rendererToMain('deck:mods-remove', { id: 'string', data: 'boolean' }, { reply: true }),
        relaunch: IPC.rendererToMain('deck:mods-relaunch', { id: 'string' }, { reply: true }),
        count: IPC.rendererToMain('deck:mods-count', { id: 'string' }, { reply: true }),
        // The sending page hears modsChanged from then on, while it lasts.
        watchMods: IPC.rendererToMain('deck:mods-watch', {}),
        // What `mods` answers may have changed: a mod found or gone, a run that moved.
        modsChanged: IPC.mainToRenderer('deck:mods-changed'),
    })
);
