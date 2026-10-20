// Between a mod's page and main, about extension points and what extends them.
import * as CHANNEL from '../channel/index.js';

// An extension point's mod calls a function of what another mod extends it with.
export const callExtension = CHANNEL.pageToMain(
    'deckit-shell:mod-call-extension',
    { run: 'number', mod: 'string', point: 'string', path: 'array', args: 'array' },
    { reply: true }
);
export const extensionCalled = CHANNEL.mainToPage('deckit-shell:mod-extension-called', { reply: true });
// The extensions of one of the mod's points now, by its name: { name, extensions: { [mod id]: { values,
// functions } } }.
export const extensionsChanged = CHANNEL.mainToPage('deckit-shell:mod-extensions-changed');
