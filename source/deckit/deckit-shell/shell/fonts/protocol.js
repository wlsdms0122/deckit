// Between main and a mod's page with deckit.fonts, about the person's fonts.
import * as CHANNEL from '../../deck/channel/index.js';

// Answers the fonts at once: { font, mono, size }, each null for the default.
export const current = CHANNEL.pageToMain('deckit-shell:fonts-current', {}, { reply: true, sync: true });
// Any of { font, mono, size }, null for the default: answers the fonts as kept.
export const set = CHANNEL.pageToMain(
    'deckit-shell:fonts-set',
    { font: 'string?', mono: 'string?', size: 'number?' },
    { reply: true }
);
