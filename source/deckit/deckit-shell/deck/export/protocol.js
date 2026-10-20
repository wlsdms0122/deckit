// Between a mod's page and main, about what mods export to each other.
import * as CHANNEL from '../channel/index.js';

// What the page's run is given of the mods it depends on, once every mod it requires has started, and refused once
// one has ended for good: { requires: { [id]: { values, functions } }, optional: { [id]: { values, functions } or
// null } }.
export const dependencies = CHANNEL.pageToMain('deckit-shell:mod-dependencies', { run: 'number' }, { reply: true });
export const callExport = CHANNEL.pageToMain(
    'deckit-shell:mod-call-export',
    { run: 'number', mod: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const exportCalled = CHANNEL.mainToPage('deckit-shell:mod-export-called', { reply: true });
// What an optional dependency exports now, launched or ending: { id, exports: { values, functions } or null }.
export const optionalChanged = CHANNEL.mainToPage('deckit-shell:mod-optional-changed');
