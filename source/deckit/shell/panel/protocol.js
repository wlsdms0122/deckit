// Between main and the pages the panel shows, about the panel itself.
DeckitModule.define(
    'shell/panel/protocol',
    {
        uses: ['core/ipc'],
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
            'pinned',
            'setPinned',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { look, shown, frame, state } at once: the panel's frame is built in one pass.
        setup: IPC.rendererToMain('shell:panel-setup', {}, { reply: true, sync: true }),
        pick: IPC.rendererToMain('shell:panel-pick', { id: 'string' }),
        // by: -1 back, 1 forward, through the mods shown.
        step: IPC.rendererToMain('shell:panel-step', { by: 'number' }),
        reorder: IPC.rendererToMain('shell:panel-reorder', { ids: 'array' }),
        // The frame as the person left it: { width, collapsed, navHeight }, any of them.
        layout: IPC.rendererToMain('shell:panel-layout', {
            width: 'number?',
            collapsed: 'boolean?',
            navHeight: 'number?',
        }),
        // The sending mod asks to be on screen; or the panel to be put away.
        show: IPC.rendererToMain('shell:panel-show', {}),
        hide: IPC.rendererToMain('shell:panel-hide', {}),
        // Something floats in the page (a dialog, a menu), so the page answers Escape.
        floating: IPC.rendererToMain('shell:panel-floating', { on: 'boolean' }),
        // A command and the fact it brings about never share a name: play is answered by played, visible by hidden.
        played: IPC.rendererToMain('shell:panel-played', { token: 'number?' }),
        hidden: IPC.rendererToMain('shell:panel-hidden', { token: 'number?' }),
        // The children the person pinned to the panel's list, asked by a mod with deckit.mods; and pinning one.
        pinned: IPC.rendererToMain('shell:panel-pinned', {}, { reply: true, sync: true }),
        setPinned: IPC.rendererToMain('shell:panel-set-pinned', { id: 'string', pinned: 'boolean' }, { reply: true }),

        // { mods: [{ id, name, icon }], current, canBack, canForward, frame: { width, collapsed, navHeight } }
        state: IPC.mainToRenderer('shell:panel-state'),
        // { open, token }: `token` is set when main waits for the exit, and comes back with hidden.
        visible: IPC.mainToRenderer('shell:panel-visible'),
        // { direction: 'in' | 'out', token }, around a move.
        play: IPC.mainToRenderer('shell:panel-play'),
        // { floating, dismissible, titleBar, region }: drawn over something, whether Escape puts it away, the window's
        // title bar over the page, and whether the page is in a region of another mod's.
        look: IPC.mainToRenderer('shell:panel-look'),
        // { last }: Escape, taken in main so a web page in the page cannot keep it. `last`: nothing in the page takes it,
        // so it puts the panel away.
        escape: IPC.mainToRenderer('shell:panel-escape'),
    })
);
