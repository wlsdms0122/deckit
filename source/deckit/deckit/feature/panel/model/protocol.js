// Between main and the views that make up the panel (a plugin's each, and the switcher's), about the panel itself.
DeckitModule.define(
    'deckit/feature/panel/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'setup',
            'screen',
            'pick',
            'step',
            'reorder',
            'layout',
            'show',
            'hide',
            'played',
            'hidden',
            'state',
            'visible',
            'play',
            'look',
            'bar',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers { role: 'plugin' | 'switcher', theme, look, shown, frame, state } at once: a view is built in one pass.
        setup: IPC.rendererToMain('deckit:panel-setup', {}, { reply: true, sync: true }),
        // What the sending plugin shows: whether it has a screen, and its icon for the plugins' list.
        screen: IPC.rendererToMain('deckit:panel-screen', { content: 'boolean', icon: 'string' }),
        pick: IPC.rendererToMain('deckit:panel-pick', { id: 'string' }),
        // by: -1 back, 1 forward, through the plugins shown.
        step: IPC.rendererToMain('deckit:panel-step', { by: 'number' }),
        reorder: IPC.rendererToMain('deckit:panel-reorder', { ids: 'array' }),
        // The frame as the person left it: { width, collapsed, navHeight }, any of them.
        layout: IPC.rendererToMain('deckit:panel-layout', {
            width: 'number?',
            collapsed: 'boolean?',
            navHeight: 'number?',
        }),
        // The sending plugin asks to be on screen; or the panel to be put away.
        show: IPC.rendererToMain('deckit:panel-show', {}),
        hide: IPC.rendererToMain('deckit:panel-hide', {}),
        // A command and the fact it brings about never share a name: play is answered by played, visible by hidden.
        played: IPC.rendererToMain('deckit:panel-played', { token: 'number?' }),
        hidden: IPC.rendererToMain('deckit:panel-hidden', { token: 'number?' }),

        // { plugins: [{ id, name, icon }], current, canBack, canForward, frame: { width, collapsed, navHeight } }
        state: IPC.mainToRenderer('deckit:panel-state'),
        // { open, token }: `token` is set when main waits for the exit, and comes back with hidden.
        visible: IPC.mainToRenderer('deckit:panel-visible'),
        // { direction: 'in' | 'out', token }, around a move.
        play: IPC.mainToRenderer('deckit:panel-play'),
        // { floating, dismissible }: drawn over something, and whether Escape puts it away.
        look: IPC.mainToRenderer('deckit:panel-look'),
        // { inset }: how far the window's bar comes down over the panel.
        bar: IPC.mainToRenderer('deckit:panel-bar'),
    })
);
