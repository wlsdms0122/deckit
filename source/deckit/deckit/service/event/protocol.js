DeckitModule.define(
    'deckit/service/event/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: ['emit', 'listen', 'event'],
        runs: 'electron',
    },
    (IPC) => ({
        // An event a mod sends of itself, to every mod that listens to it.
        emit: IPC.rendererToMain('deckit:event-emit', { name: 'string', args: 'array' }),
        // Every event name the page listens to now, each `<mod id>:<event name>`.
        listen: IPC.rendererToMain('deckit:event-listen', { names: 'array' }),
        // An event the page listens to: { name, args }.
        event: IPC.mainToRenderer('deckit:event'),
    })
);
