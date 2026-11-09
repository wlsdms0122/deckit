// Between main and a mod's page with deckit.fonts, about the person's fonts.
import * as CHANNEL from '../../deckit/channel/index.js';
import * as FONTS_PERMISSION from './model/permission.js';

// Answers the fonts at once: { text, size }, each null for the default.
export const current = CHANNEL.pageToMain(
    'deckit-shell:fonts-current',
    {},
    { reply: true, sync: true, guard: FONTS_PERMISSION.FONTS }
);
// Any of { text, size }, null for the default: answers the fonts as kept.
export const set = CHANNEL.pageToMain(
    'deckit-shell:fonts-set',
    { text: 'string?', size: 'number?' },
    { reply: true, guard: FONTS_PERMISSION.FONTS }
);
// Answers the fonts installed at once, to any page: { families, monospaced }, the families by name and those of them
// whose faces are fixed-width.
export const installed = CHANNEL.pageToMain(
    'deckit-shell:fonts-installed',
    {},
    { reply: true, sync: true, guard: CHANNEL.GUARD.ANY }
);
