// Between main and a mod's page with deckit.shell-keys, about the shell's own keys.
import * as CHANNEL from '../../deckit/channel/index.js';

// Answers the shell's keys at once, in the order a person reads them: `[{ id, name, defaultKeystroke, keystroke }]`,
// `keystroke` the chord it has now, or null for none.
export const list = CHANNEL.pageToMain('deckit-shell:key-list', {}, { reply: true, sync: true });
// One key given a chord, `{ code, meta, control, alt, shift }`, or none for null: answers the key as kept.
export const set = CHANNEL.pageToMain('deckit-shell:key-set', { id: 'string', keystroke: 'object?' }, { reply: true });
// One key given its default chord again: answers the key as kept.
export const reset = CHANNEL.pageToMain('deckit-shell:key-reset', { id: 'string' }, { reply: true });
