// Between a mod's page and main, about extension points and what extends them.
import * as IPC from '../ipc/index.js';

// An extension point's mod calls a function of what another mod extends it with.
export const callExtension = IPC.rendererToMain(
    'deckit-electron:mod-call-extension',
    { run: 'number', mod: 'string', point: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const extensionCalled = IPC.mainToRenderer('deckit-electron:mod-extension-called', { reply: true });
// The extensions of one of the mod's points now, by its name: { name, extensions: { [mod id]: { values,
// functions } } }.
export const extensionsChanged = IPC.mainToRenderer('deckit-electron:mod-extensions-changed');
