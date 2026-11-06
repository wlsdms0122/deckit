import * as CHANNEL from '../channel/index.js';

// An event the page's run sends of its mod, to every mod that listens to it.
export const emit = CHANNEL.pageToMain('deckit-shell:event-emit', { run: 'number', name: 'string', args: 'array' });
// Every event name the page's run listens to now, each `<mod id>:<event name>`.
export const listen = CHANNEL.pageToMain('deckit-shell:event-listen', { run: 'number', names: 'array' });
// An event the page listens to: { name, args }.
export const event = CHANNEL.mainToPage('deckit-shell:event');
