import * as CHANNEL from '../../deckit-shell/channel/index.js';

// A field has the keyboard, so a chord on a text editing key is the field's.
export const typing = CHANNEL.pageToMain('deckit-electron:keymap-typing', { on: 'boolean' });
export const record = CHANNEL.pageToMain('deckit-electron:keymap-record', { on: 'boolean' });
// The chord bound now to a key of the sending mod's, or of the app's, by its action, as a person reads it.
export const chord = CHANNEL.pageToMain(
    'deckit-electron:keymap-chord',
    { action: 'string', app: 'boolean' },
    { reply: true, sync: true }
);
// deckit.key-map
export const bindings = CHANNEL.pageToMain('deckit-electron:keymap-bindings', {}, { reply: true, sync: true });
export const bind = CHANNEL.pageToMain(
    'deckit-electron:keymap-bind',
    { id: 'string', spec: 'string' },
    { reply: true }
);
export const reset = CHANNEL.pageToMain('deckit-electron:keymap-reset', { id: 'string' }, { reply: true });

// Run the sending mod's key of that action.
export const key = CHANNEL.mainToPage('deckit-electron:keymap-key');
// What the key typed comes to, as the core judges it: { pending }, { error }, { spec }, { cancel } or { clear }; also
// { cancel: true } when main ended the recording.
export const recorded = CHANNEL.mainToPage('deckit-electron:keymap-recorded');
// The bindings changed: a chord shown anywhere may be out of date.
export const changed = CHANNEL.mainToPage('deckit-electron:keymap-changed');
