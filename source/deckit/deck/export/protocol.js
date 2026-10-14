// Between a mod's page and main, about what mods export to each other.
import * as IPC from '../../core/ipc/index.js';

// Answers once every mod it requires has started or failed: { requires: { [id]: { values, functions } or
// { error } }, optional: { [id]: { values, functions } or null } }.
export const dependencies = IPC.rendererToMain('deck:mod-dependencies', {}, { reply: true });
export const callExport = IPC.rendererToMain(
    'deck:mod-call-export',
    { run: 'number', mod: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const exportCalled = IPC.mainToRenderer('deck:mod-export-called', { reply: true });
// What an optional dependency exports now, launched or ending: { id, exports: { values, functions } or null }.
export const optionalChanged = IPC.mainToRenderer('deck:mod-optional-changed');
