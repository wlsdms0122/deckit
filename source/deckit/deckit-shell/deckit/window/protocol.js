// Between main and the page of a mod with a window of its own.
import * as CHANNEL from '../../deck/channel/index.js';

export const open = CHANNEL.pageToMain('deckit-shell:window-open', {});
export const close = CHANNEL.pageToMain('deckit-shell:window-close', {});
// { on }: the window came on screen, or went.
export const shown = CHANNEL.mainToPage('deckit-shell:window-shown');
// The keyboard went from the window to another, or to another app.
export const resignKey = CHANNEL.mainToPage('deckit-shell:window-resign-key');
