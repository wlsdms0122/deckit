// Channels between main and a page, carried by Electron's IPC: deck's and deckit's own, each under its own name
// (bind.js), and a layer's on deck, over channels of their own (layer.js).
export { bind } from './bind.js';
export { channels } from './layer.js';
