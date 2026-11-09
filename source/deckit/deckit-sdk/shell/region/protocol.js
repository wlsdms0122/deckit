// Between main and a mod's page, about the regions it gives its children.
import * as CHANNEL from '../../deckit/channel/index.js';

// Interface -> the mods whose view names it as parent while the sending mod owns it: [{ id, name, icon }], in the load
// order, for each interface the sending mod provides.
export const children = CHANNEL.pageToMain('deckit-shell:region-children', {}, { reply: true, sync: true });
// Where one of the sending page's regions, for an interface its mod provides, is: the id of the window its element is
// in, or null for none, and the element's rect in that window.
export const rect = CHANNEL.pageToMain('deckit-shell:region-rect', {
    region: 'number',
    interface: 'string',
    window: 'number?',
    x: 'number',
    y: 'number',
    width: 'number',
    height: 'number',
});
// The child a region shows, or none: refused for a mod that is not the sender's child of the region's interface.
export const place = CHANNEL.pageToMain(
    'deckit-shell:region-place',
    { region: 'number', interface: 'string', id: 'string?' },
    { reply: true }
);
// The region's element left the page.
export const end = CHANNEL.pageToMain('deckit-shell:region-end', { region: 'number' });

// { open }: a child's view came on screen in a region, or left it.
export const visible = CHANNEL.mainToPage('deckit-shell:region-visible');
// { children }: as `children` answers, each time it changes.
export const childrenChanged = CHANNEL.mainToPage('deckit-shell:region-children-changed');
