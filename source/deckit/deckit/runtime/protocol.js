// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        // At once: a page draws it in one pass.
        about: IPC.rendererToMain('deckit:about', {}, { reply: true, sync: true }),
        restart: IPC.rendererToMain('deckit:restart', {}, { reply: true }),
    });
}
