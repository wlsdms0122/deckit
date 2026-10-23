// Between main and a mod's page, about the regions it gives its children.
import * as CHANNEL from '../../deck/channel/index.js';

// The mods whose view names the sending mod as parent: [{ id, name, icon }], in the load order.
export const children = CHANNEL.pageToMain('deckit-shell:region-children', {}, { reply: true, sync: true });
// Where one of the sending page's regions is in the page: its element's rect.
export const rect = CHANNEL.pageToMain('deckit-shell:region-rect', {
    region: 'number',
    x: 'number',
    y: 'number',
    width: 'number',
    height: 'number',
});
// The child a region shows, or none: refused for a mod that is not the sender's child.
export const place = CHANNEL.pageToMain(
    'deckit-shell:region-place',
    { region: 'number', id: 'string?' },
    { reply: true }
);
// The region's element left the page.
export const end = CHANNEL.pageToMain('deckit-shell:region-end', { region: 'number' });

// { children }: as `children` answers, each time it changes.
export const childrenChanged = CHANNEL.mainToPage('deckit-shell:region-children-changed');
