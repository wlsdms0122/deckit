// Between main and a mod's page, about the chords a mod takes, the shell's own keys, which a page with
// deckit.shell-keys changes, the keys pressed in a page that records them, and whether the app has the keyboard.
import * as CHANNEL from '../../deckit/channel/index.js';

// The sending page's mod takes a chord, `keystroke` `{ code, meta, control, alt, shift }`, under the page's own `id`,
// in `scope`, `app` or `global`. Answers whether it works where its scope says: false for a chord the system did not
// give, which works in every page of the app still.
export const take = CHANNEL.pageToMain(
    'deckit-shell:key-take',
    { id: 'number', keystroke: 'object', scope: 'string' },
    { reply: true }
);
// The sending page lets the chord it took under `id` go.
export const release = CHANNEL.pageToMain('deckit-shell:key-release', { id: 'number' });
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
// Whether the app is in front: one of its pages has the keyboard.
export const active = CHANNEL.pageToMain('deckit-shell:key-active', {}, { reply: true });

// The chord the page's mod took under `id` was pressed: `{ id }`.
export const pressed = CHANNEL.mainToPage('deckit-shell:key-pressed');
// A key pressed in the page while it records under `id`: `{ id, keystroke: { code, meta, control, alt, shift } }`.
export const recorded = CHANNEL.mainToPage('deckit-shell:key-recorded');
