// Between a mod's page and main, about mod folders on this Mac: deckit.mods.
export function createProtocol({ IPC }) {
    return Object.freeze({
        pick: IPC.rendererToMain('deckit:mod-folder-pick', {}, { reply: true }),
        reveal: IPC.rendererToMain('deckit:mod-folder-reveal', { id: 'string' }, { reply: true }),
    });
}
