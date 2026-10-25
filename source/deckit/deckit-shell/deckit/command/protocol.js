import * as CHANNEL from '../../deck/channel/index.js';

// Main asks the page of the mod that declared a command to run it, or to complete one of its args. `call` names a
// completion, which `abort` ends.
export const run = CHANNEL.mainToPage('deckit-shell:command-run', { reply: true });
export const complete = CHANNEL.mainToPage('deckit-shell:command-complete', { reply: true });
export const abort = CHANNEL.mainToPage('deckit-shell:command-abort');

// A mod with deckit.command-registry, as a caller: a command by its owner, `mod`, and its name.
export const list = CHANNEL.pageToMain('deckit-shell:command-list', {}, { reply: true });
export const runOf = CHANNEL.pageToMain(
    'deckit-shell:command-run-of',
    { mod: 'string', command: 'string', args: 'object?', activates: 'boolean' },
    { reply: true }
);
export const completeOf = CHANNEL.pageToMain(
    'deckit-shell:command-complete-of',
    { call: 'number', mod: 'string', command: 'string', param: 'string', partial: 'string', args: 'object?' },
    { reply: true }
);
export const cancel = CHANNEL.pageToMain('deckit-shell:command-cancel', { call: 'number' });
export const changed = CHANNEL.mainToPage('deckit-shell:command-changed');
