// Between a mod's page and main, about what mods export to each other.
DeckitModule.define(
    'deck/export/protocol',
    {
        uses: ['core/ipc'],
        provides: ['dependencies', 'callExport', 'exportCalled', 'optionalChanged'],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers once every mod it requires has started or failed: { requires: { [id]: { values, functions } or
        // { error } }, optional: { [id]: { values, functions } or null } }.
        dependencies: IPC.rendererToMain('deck:mod-dependencies', {}, { reply: true }),
        callExport: IPC.rendererToMain(
            'deck:mod-call-export',
            { run: 'number', mod: 'string', path: 'array', args: 'array' },
            { reply: true }
        ),
        exportCalled: IPC.mainToRenderer('deck:mod-export-called', { reply: true }),
        // What an optional dependency exports now, launched or ending: { id, exports: { values, functions } or null }.
        optionalChanged: IPC.mainToRenderer('deck:mod-optional-changed'),
    })
);
