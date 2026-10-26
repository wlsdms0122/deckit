// Between a mod's page and main, about what mods export to each other.
import * as CHANNEL from '../channel/index.js';

// What each mod the page's run requires exports, once every one has started, and refused once one has ended for good:
// { [id]: { values, functions } }.
export const requires = CHANNEL.pageToMain('deckit-shell:mod-requires', { run: 'number' }, { reply: true });
export const callExport = CHANNEL.pageToMain(
    'deckit-shell:mod-call-export',
    { run: 'number', mod: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const exportCalled = CHANNEL.mainToPage('deckit-shell:mod-export-called', { reply: true });
