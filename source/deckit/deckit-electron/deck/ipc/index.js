// Channels between main and a page, carried by Electron's IPC over the channels in protocol.js (router.js):
// `ownChannels` binds deckit-electron's own, and `layerChannels`, handed to a layer on deck, binds the layer's.
export { ownChannels, layerChannels } from './router.js';
