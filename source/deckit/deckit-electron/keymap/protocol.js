import * as IPC from '../../deck/ipc/index.js';

// A field has the keyboard, so a chord on a text editing key is the field's.
export const typing = IPC.rendererToMain('deckit-electron:keymap-typing', { on: 'boolean' });
export const record = IPC.rendererToMain('deckit-electron:keymap-record', { on: 'boolean' });
// The chord bound now to a key of the sending mod's, or of the app's, by its action, as a person reads it.
export const chord = IPC.rendererToMain(
    'deckit-electron:keymap-chord',
    { action: 'string', app: 'boolean' },
    { reply: true, sync: true }
);
// deckit.key-map
export const bindings = IPC.rendererToMain('deckit-electron:keymap-bindings', {}, { reply: true, sync: true });
export const bind = IPC.rendererToMain(
    'deckit-electron:keymap-bind',
    { id: 'string', spec: 'string' },
    { reply: true }
);
export const reset = IPC.rendererToMain('deckit-electron:keymap-reset', { id: 'string' }, { reply: true });

// Run the sending mod's key of that action.
export const key = IPC.mainToRenderer('deckit-electron:keymap-key');
// What the key typed comes to, as the core judges it: { pending }, { error }, { spec }, { cancel } or { clear }; also
// { cancel: true } when main ended the recording.
export const recorded = IPC.mainToRenderer('deckit-electron:keymap-recorded');
// The bindings changed: a chord shown anywhere may be out of date.
export const changed = IPC.mainToRenderer('deckit-electron:keymap-changed');
