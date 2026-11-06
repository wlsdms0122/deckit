import * as CHANNEL from '../channel/index.js';

// The sending mod takes a chord, `keystroke` `{ code, meta, control, alt, shift }`, under its own `id`, in `scope`,
// `app` or `global`. Answers whether it works where its scope says: false for a chord the system did not give, which
// works in every page of the app still.
export const take = CHANNEL.pageToMain(
    'deckit-shell:keymap-take',
    { id: 'number', keystroke: 'object', scope: 'string' },
    { reply: true }
);
// The sending mod lets the chord it took under `id` go.
export const release = CHANNEL.pageToMain('deckit-shell:keymap-release', { id: 'number' });

// The chord the page's mod took under `id` was pressed.
export const key = CHANNEL.mainToPage('deckit-shell:keymap-key');
