DeckitModule.define(
    'deckit/service/keymap/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['scope', 'typing', 'record', 'chord', 'bindings', 'bind', 'reset', 'key', 'recorded', 'changed'],
        runs: 'electron',
    },
    (IPC) => ({
        // The sending mod's keys: [{ action, key, label, global }].
        scope: IPC.rendererToMain('deckit:keymap-scope', { keys: 'array' }),
        // A field has the keyboard, so a chord on a text editing key is the field's.
        typing: IPC.rendererToMain('deckit:keymap-typing', { on: 'boolean' }),
        record: IPC.rendererToMain('deckit:keymap-record', { on: 'boolean' }),
        // The chord bound now to a binding id ("<owner>.<action>"), as a person reads it.
        chord: IPC.rendererToMain('deckit:keymap-chord', { id: 'string' }, { reply: true, sync: true }),
        // deckit.key-map
        bindings: IPC.rendererToMain('deckit:keymap-bindings', {}, { reply: true, sync: true }),
        bind: IPC.rendererToMain('deckit:keymap-bind', { id: 'string', spec: 'string' }, { reply: true }),
        reset: IPC.rendererToMain('deckit:keymap-reset', { id: 'string' }, { reply: true }),

        // Run the sending mod's key of that action.
        key: IPC.mainToRenderer('deckit:keymap-key'),
        // { code, meta, control, shift, alt } or { cancel: true } when main ended the recording.
        recorded: IPC.mainToRenderer('deckit:keymap-recorded'),
        // The bindings changed: a chord shown anywhere may be out of date.
        changed: IPC.mainToRenderer('deckit:keymap-changed'),
    })
);
