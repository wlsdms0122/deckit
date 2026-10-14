// Between a mod's page and main, about extension points and what extends them.
DeckitModule.define(
    'deck/extension/protocol',
    {
        uses: ['core/ipc'],
        provides: ['callExtension', 'extensionCalled', 'extensionsChanged'],
        runs: 'electron',
    },
    (IPC) => ({
        // An extension point's mod calls a function of what another mod extends it with.
        callExtension: IPC.rendererToMain(
            'deck:mod-call-extension',
            { run: 'number', mod: 'string', point: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        extensionCalled: IPC.mainToRenderer('deck:mod-extension-called', { reply: true }),
        // The extensions of one of the mod's points now, by its name: { name, extensions: { [mod id]: { values,
        // functions } } }.
        extensionsChanged: IPC.mainToRenderer('deck:mod-extensions-changed'),
    })
);
