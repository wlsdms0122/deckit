// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // Answers whether it was shown. `id` comes back with clicked.
        show: IPC.rendererToMain(
            'deckit:notification-show',
            { id: 'string', title: 'string', body: 'string', silent: 'boolean' },
            { reply: true }
        ),
        clicked: IPC.mainToRenderer('deckit:notification-clicked'),
    });
}
