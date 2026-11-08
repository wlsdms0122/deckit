// Between main and a mod's page, about the shell's own keys, which a page with deckit.shell-keys changes, and the keys
// pressed in a page that records them.
import * as CHANNEL from '../../deckit/channel/index.js';

// Answers the shell's keys at once, in the order a person reads them: `[{ id, name, defaultKeystroke, keystroke }]`,
// `keystroke` the chord it has now, or null for none.
export const list = CHANNEL.pageToMain('deckit-shell:key-list', {}, { reply: true, sync: true });
// One key given a chord, `{ code, meta, control, alt, shift }`, or none for null: answers the key as kept.
export const set = CHANNEL.pageToMain('deckit-shell:key-set', { id: 'string', keystroke: 'object?' }, { reply: true });
// One key given its default chord again: answers the key as kept.
export const reset = CHANNEL.pageToMain('deckit-shell:key-reset', { id: 'string' }, { reply: true });
// The sending page records under its `id`: each key pressed in it, taken from it, is told it with `recorded`, until
// it stops that recording, records again or ends.
export const record = CHANNEL.pageToMain('deckit-shell:key-record', { id: 'number' });
export const stopRecording = CHANNEL.pageToMain('deckit-shell:key-stop-recording', { id: 'number' });

// A key pressed in the page while it records under `id`: `{ id, keystroke: { code, meta, control, alt, shift } }`.
export const recorded = CHANNEL.mainToPage('deckit-shell:key-recorded');
