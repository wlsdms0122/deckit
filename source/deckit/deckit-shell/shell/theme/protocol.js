// Between main and every page the shell draws in, about the theme it draws in.
import * as CHANNEL from '../../deck/channel/index.js';

// Answers { theme, fonts } at once: the host app's theme and the person's fonts, each null until it is there.
export const setup = CHANNEL.pageToMain('deckit-shell:theme-setup', {}, { reply: true, sync: true });

// { theme, fonts }: a new theme from the host app, or new fonts.
export const change = CHANNEL.mainToPage('deckit-shell:theme-change');
