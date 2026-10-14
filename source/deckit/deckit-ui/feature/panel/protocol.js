// Between main and the pages the panel shows, about the panel itself.
DeckitModule.define(
    'deckit-ui/feature/panel/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'setup',
            'pick',
            'step',
            'reorder',
            'layout',
            'show',
            'hide',
            'floating',
            'played',
            'hidden',
            'state',
            'visible',
            'play',
            'look',
            'escape',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { look, shown, frame, state } at once: the panel's frame is built in one pass.
        setup: IPC.rendererToMain('deckit:panel-setup', {}, { reply: true, sync: true }),
        pick: IPC.rendererToMain('deckit:panel-pick', { id: 'string' }),
        // by: -1 back, 1 forward, through the mods shown.
        step: IPC.rendererToMain('deckit:panel-step', { by: 'number' }),
        reorder: IPC.rendererToMain('deckit:panel-reorder', { ids: 'array' }),
        // The frame as the person left it: { width, collapsed, navHeight }, any of them.
        layout: IPC.rendererToMain('deckit:panel-layout', {
            width: 'number?',
            collapsed: 'boolean?',
            navHeight: 'number?',
        }),
        // The sending mod asks to be on screen; or the panel to be put away.
        show: IPC.rendererToMain('deckit:panel-show', {}),
        hide: IPC.rendererToMain('deckit:panel-hide', {}),
        // Something floats in the page (a dialog, a menu), so the page answers Escape.
        floating: IPC.rendererToMain('deckit:panel-floating', { on: 'boolean' }),
        // A command and the fact it brings about never share a name: play is answered by played, visible by hidden.
        played: IPC.rendererToMain('deckit:panel-played', { token: 'number?' }),
        hidden: IPC.rendererToMain('deckit:panel-hidden', { token: 'number?' }),

        // { mods: [{ id, name, icon }], current, canBack, canForward, frame: { width, collapsed, navHeight } }
        state: IPC.mainToRenderer('deckit:panel-state'),
        // { open, token }: `token` is set when main waits for the exit, and comes back with hidden.
        visible: IPC.mainToRenderer('deckit:panel-visible'),
        // { direction: 'in' | 'out', token }, around a move.
        play: IPC.mainToRenderer('deckit:panel-play'),
        // { floating, dismissible }: drawn over something, and whether Escape puts it away.
        look: IPC.mainToRenderer('deckit:panel-look'),
        // { last }: Escape, taken in main so a web page in the page cannot keep it. `last`: nothing in the page takes it,
        // so it puts the panel away.
        escape: IPC.mainToRenderer('deckit:panel-escape'),
    })
);
