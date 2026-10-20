import * as CHANNEL from '../channel/index.js';

// The page may finish loading after the chord that opened it.
export const ready = CHANNEL.pageToMain('deckit-shell:switcher-ready', {});
export const open = CHANNEL.mainToPage('deckit-shell:switcher-open');
export const close = CHANNEL.pageToMain('deckit-shell:switcher-close', {});
// The list is put away: answered once its exit has played.
export const dismiss = CHANNEL.mainToPage('deckit-shell:switcher-dismiss', { reply: true });
// { number }: ⌘1 to ⌘9 pressed in the list.
export const number = CHANNEL.mainToPage('deckit-shell:switcher-number');

// The list's entries.
export const need = CHANNEL.pageToMain('deckit-shell:switcher-need', {});
export const supply = CHANNEL.mainToPage('deckit-shell:switcher-supply');
// `now` is sent again on its own as a slow source answers.
export const now = CHANNEL.mainToPage('deckit-shell:switcher-now');
// `submenu`: the entry whose submenu was typed in, or absent for the list.
export const query = CHANNEL.pageToMain('deckit-shell:switcher-query', { raw: 'string', submenu: 'string?' });
export const resolved = CHANNEL.mainToPage('deckit-shell:switcher-resolved');
export const pick = CHANNEL.pageToMain('deckit-shell:switcher-pick', { id: 'string' });
