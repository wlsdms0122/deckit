import * as CHANNEL from '../../deck/channel/index.js';

// A field has the keyboard, so a chord a field takes is the field's.
export const typing = CHANNEL.pageToMain('deckit-shell:keymap-typing', { on: 'boolean' });
export const record = CHANNEL.pageToMain('deckit-shell:keymap-record', { on: 'boolean' });
// The chord bound now to a key of the sending mod's, or of the host `provider`, by its name, as a person reads it.
export const chord = CHANNEL.pageToMain(
    'deckit-shell:keymap-chord',
    { name: 'string', provider: 'string?' },
    { reply: true, sync: true }
);
// deckit.keymap
export const bindings = CHANNEL.pageToMain('deckit-shell:keymap-bindings', {}, { reply: true, sync: true });
export const bind = CHANNEL.pageToMain('deckit-shell:keymap-bind', { id: 'string', spec: 'string' }, { reply: true });
export const reset = CHANNEL.pageToMain('deckit-shell:keymap-reset', { id: 'string' }, { reply: true });

// The sending mod's key of that name was pressed.
export const key = CHANNEL.mainToPage('deckit-shell:keymap-key');
// What the key typed comes to, as the core judges it: { pending }, { error }, { spec }, { cancel } or { clear }; also
// { cancel: true } when main ended the recording.
export const recorded = CHANNEL.mainToPage('deckit-shell:keymap-recorded');
// The bindings changed: a chord shown anywhere may be out of date.
export const changed = CHANNEL.mainToPage('deckit-shell:keymap-changed');
