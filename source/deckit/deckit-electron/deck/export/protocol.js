// Between a mod's page and main, about what mods export to each other.
import * as IPC from '../ipc/index.js';

// What the page's run is given of the mods it depends on, once every mod it requires has started, and refused once
// one has ended for good: { requires: { [id]: { values, functions } }, optional: { [id]: { values, functions } or
// null } }.
export const dependencies = IPC.rendererToMain('deckit-electron:mod-dependencies', { run: 'number' }, { reply: true });
export const callExport = IPC.rendererToMain(
    'deckit-electron:mod-call-export',
    { run: 'number', mod: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const exportCalled = IPC.mainToRenderer('deckit-electron:mod-export-called', { reply: true });
// What an optional dependency exports now, launched or ending: { id, exports: { values, functions } or null }.
export const optionalChanged = IPC.mainToRenderer('deckit-electron:mod-optional-changed');
