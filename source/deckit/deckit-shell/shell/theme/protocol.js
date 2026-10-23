// Between main and every page the shell draws in, about the theme it draws in.
import * as CHANNEL from '../../deck/channel/index.js';

// Answers { theme } at once: the host app's, or null until it gives one.
export const setup = CHANNEL.pageToMain('deckit-shell:theme-setup', {}, { reply: true, sync: true });

// { theme }: the host app's new one.
export const change = CHANNEL.mainToPage('deckit-shell:theme-change');
