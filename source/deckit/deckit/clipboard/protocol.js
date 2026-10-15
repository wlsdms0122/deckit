// Its channels, on the transport its package's root hands it.
export function createProtocol({ IPC }) {
    return Object.freeze({
        readText: IPC.rendererToMain('deckit:clipboard-read', {}, { reply: true }),
        writeText: IPC.rendererToMain('deckit:clipboard-write', { text: 'string' }, { reply: true }),
    });
}
