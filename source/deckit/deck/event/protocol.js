import * as IPC from '../ipc/index.js';

// An event a mod sends of itself, to every mod that listens to it.
export const emit = IPC.rendererToMain('deck:event-emit', { name: 'string', args: 'array' });
// Every event name the page listens to now, each `<mod id>:<event name>`.
export const listen = IPC.rendererToMain('deck:event-listen', { names: 'array' });
// An event the page listens to: { name, args }.
export const event = IPC.mainToRenderer('deck:event');
