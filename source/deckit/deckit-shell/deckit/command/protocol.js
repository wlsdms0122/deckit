import * as CHANNEL from '../channel/index.js';

// Main asks the page of the mod that declared a command to run it, or to complete one of its args. `call` names a
// completion, which `abort` ends.
export const run = CHANNEL.mainToPage('deckit-shell:command-run', { reply: true });
export const complete = CHANNEL.mainToPage('deckit-shell:command-complete', { reply: true });
export const abort = CHANNEL.mainToPage('deckit-shell:command-abort');

// A mod with deckit.command-registry, as a caller: a command by its provider and its name.
export const list = CHANNEL.pageToMain('deckit-shell:command-list', {}, { reply: true });
export const runOf = CHANNEL.pageToMain(
    'deckit-shell:command-run-of',
    { provider: 'string', command: 'string', args: 'object?' },
    { reply: true }
);
export const completeOf = CHANNEL.pageToMain(
    'deckit-shell:command-complete-of',
    { call: 'number', provider: 'string', command: 'string', param: 'string', partial: 'string', args: 'object?' },
    { reply: true }
);
export const cancel = CHANNEL.pageToMain('deckit-shell:command-cancel', { call: 'number' });
export const changed = CHANNEL.mainToPage('deckit-shell:command-changed');

// A mod's command tokens: it mints one of its own commands and cancels it; whoever holds one runs it or releases it.
export const mint = CHANNEL.pageToMain(
    'deckit-shell:command-mint',
    { command: 'string', args: 'object?' },
    { reply: true }
);
export const runToken = CHANNEL.pageToMain('deckit-shell:command-run-token', { token: 'string' }, { reply: true });
export const cancelToken = CHANNEL.pageToMain(
    'deckit-shell:command-cancel-token',
    { token: 'string' },
    { reply: true }
);
export const releaseToken = CHANNEL.pageToMain(
    'deckit-shell:command-release-token',
    { token: 'string' },
    { reply: true }
);
