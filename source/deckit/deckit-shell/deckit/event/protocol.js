import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';

// An event the page's run sends of its mod, to every mod that listens to it: answered once it is sent, or refused.
export const emit = CHANNEL.pageToMain(
    'deckit-shell:event-emit',
    { run: 'number', name: 'string', args: 'array' },
    { reply: true, sync: true, guard: CHANNEL.GUARD.MOD }
);
// Every event name the page's run listens to now, each `<mod id>:<event name>`.
export const listen = CHANNEL.pageToMain(
    'deckit-shell:event-listen',
    { run: 'number', names: 'array' },
    { guard: CHANNEL.GUARD.MOD }
);
// An event the page listens to: { name, args }.
export const event = CHANNEL.mainToPage('deckit-shell:event');
