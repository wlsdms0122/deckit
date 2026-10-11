// Between a plugin's view and main, about the web pages it shows. `name` is a session's name within the plugin;
// `id` is a page's webContents id, which main hands out and holds.
DeckitModule.define(
    'deckit/service/web/model/protocol',
    {
        uses: ['deckit/module/ipc'],
        provides: [
            'window',
            'fetchText',
            'clear',
            'trust',
            'allow',
            'revoke',
            'load',
            'navigate',
            'state',
            'mute',
            'find',
            'stopFind',
            'close',
            'clickNotification',
            'permit',
            'changed',
            'refused',
            'found',
            'leaving',
            'opening',
            'asking',
            'notified',
            'closed',
        ],
        runs: 'electron',
    },
    (IPC) => ({
        // Answers the new window page's id, or 0 when it may not be shown.
        window: IPC.rendererToMain(
            'deckit:web-window',
            { name: 'string', url: 'string', title: 'string' },
            { reply: true }
        ),
        fetchText: IPC.rendererToMain('deckit:web-fetch-text', { name: 'string', url: 'string' }, { reply: true }),
        clear: IPC.rendererToMain('deckit:web-clear', { name: 'string' }, { reply: true }),
        // entries: [{ host, fingerprint }]
        trust: IPC.rendererToMain('deckit:web-trust', { name: 'string', entries: 'array' }, { reply: true }),
        // entries: [{ origin, permission }]
        allow: IPC.rendererToMain('deckit:web-allow', { name: 'string', entries: 'array' }, { reply: true }),
        revoke: IPC.rendererToMain('deckit:web-revoke', { name: 'string', entries: 'array' }, { reply: true }),

        load: IPC.rendererToMain('deckit:page-load', { id: 'number', url: 'string' }),
        // to: back, forward, reload, stop
        navigate: IPC.rendererToMain('deckit:page-navigate', { id: 'number', to: 'string' }),
        state: IPC.rendererToMain('deckit:page-state', { id: 'number' }),
        mute: IPC.rendererToMain('deckit:page-mute', { id: 'number', on: 'boolean' }),
        find: IPC.rendererToMain('deckit:page-find', {
            id: 'number',
            text: 'string',
            start: 'boolean',
            back: 'boolean',
            matchCase: 'boolean',
        }),
        stopFind: IPC.rendererToMain('deckit:page-stop-find', { id: 'number', keepSelection: 'boolean' }),
        close: IPC.rendererToMain('deckit:page-close', { id: 'number' }),
        clickNotification: IPC.rendererToMain('deckit:page-click-notification', {
            id: 'number',
            notification: 'number',
        }),
        // Answers the `asking` of that number.
        permit: IPC.rendererToMain('deckit:page-permit', { ask: 'number', allow: 'boolean' }),

        changed: IPC.mainToRenderer('deckit:page-changed'),
        // certificate: { url, host, error, fingerprint, subject, issuer }
        refused: IPC.mainToRenderer('deckit:page-certificate-refused'),
        found: IPC.mainToRenderer('deckit:page-found'),
        // A file page's link to the web, not followed in place.
        leaving: IPC.mainToRenderer('deckit:page-leaving'),
        opening: IPC.mainToRenderer('deckit:page-opening'),
        // Permissions, or opening an app (`app`, `url`); answered with permit.
        asking: IPC.mainToRenderer('deckit:page-asking'),
        notified: IPC.mainToRenderer('deckit:page-notified'),
        closed: IPC.mainToRenderer('deckit:page-closed'),
    })
);
