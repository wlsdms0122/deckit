DeckitModule.define(
    'deckit/service/keymap/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'overrides',
            'setOverrides',
            'globals',
            'record',
            'recorded',
            'chords',
            'typing',
            'floating',
            'key',
            'escape',
        ],
        runs: 'electron',
    },
    (IPC) =>
        Object.freeze({
            // { "<owner>.<action>": spec, or "" for switched off }.
            overrides: IPC.ask('deckit:keymap', {}, { now: true }),
            setOverrides: IPC.ask('deckit:keymap-set', { overrides: 'object' }),
            // `host`: chords main runs itself. `page`: plugins' global keys, run in the page that sends this.
            globals: IPC.report('deckit:keymap-globals', { host: 'object', page: 'object' }),
            record: IPC.report('deckit:keymap-record', { on: 'boolean' }),
            // `cancel`: main ended the recording on its own.
            recorded: IPC.tell('deckit:keymap-recorded', {
                code: 'string?',
                meta: 'boolean?',
                control: 'boolean?',
                shift: 'boolean?',
                alt: 'boolean?',
                cancel: 'boolean?',
            }),
            // Replaces the page's previous list.
            chords: IPC.report('deckit:keys', { chords: 'array' }),
            typing: IPC.report('deckit:typing', { on: 'boolean' }),
            // Something floats in the page (a dialog, a menu), so that page answers Escape.
            floating: IPC.report('deckit:escape-owner', { on: 'boolean' }),
            key: IPC.tell('deckit:key', { id: 'string' }),
            // `last`: main already decided Escape's last stop (putting the panel away) applies here.
            escape: IPC.tell('deckit:escape', { last: 'boolean' }),
        })
);
