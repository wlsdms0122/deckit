import * as IPC from '../../deck/ipc/index.js';

// The sending mod's keys: [{ action, key, label, global }].
export const scope = IPC.rendererToMain('deckit:keymap-scope', { keys: 'array' });
// A field has the keyboard, so a chord on a text editing key is the field's.
export const typing = IPC.rendererToMain('deckit:keymap-typing', { on: 'boolean' });
export const record = IPC.rendererToMain('deckit:keymap-record', { on: 'boolean' });
// The chord bound now to a binding id ("<owner>.<action>"), as a person reads it.
export const chord = IPC.rendererToMain('deckit:keymap-chord', { id: 'string' }, { reply: true, sync: true });
// deckit.key-map
export const bindings = IPC.rendererToMain('deckit:keymap-bindings', {}, { reply: true, sync: true });
export const bind = IPC.rendererToMain('deckit:keymap-bind', { id: 'string', spec: 'string' }, { reply: true });
export const reset = IPC.rendererToMain('deckit:keymap-reset', { id: 'string' }, { reply: true });

// Run the sending mod's key of that action.
export const key = IPC.mainToRenderer('deckit:keymap-key');
// { code, meta, control, shift, alt } or { cancel: true } when main ended the recording.
export const recorded = IPC.mainToRenderer('deckit:keymap-recorded');
// The bindings changed: a chord shown anywhere may be out of date.
export const changed = IPC.mainToRenderer('deckit:keymap-changed');
