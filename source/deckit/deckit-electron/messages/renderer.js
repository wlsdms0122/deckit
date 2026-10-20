// What carries deck's messages on a page's side, over Electron's IPC (deckit-shell/environment: PAGE.messages). What
// main tells is heard once something listens, as the page's preload runs.
import * as WIRE from './protocol.js';

// MARK: - Property
const { ipcRenderer } = require('electron');
let listening = false;

// MARK: - Initializer
// MARK: - Public
function listen({ told }) {
    if (listening) throw new Error('[deckit] main is heard already');
    listening = true;
    ipcRenderer.on(WIRE.mainTells, (_event, message) => told(message));
}

const messages = Object.freeze({
    listen,
    tell: (message) => ipcRenderer.send(WIRE.pageTells, message),
    ask: (message) => ipcRenderer.invoke(WIRE.pageAsks, message),
    askSync: (message) => ipcRenderer.sendSync(WIRE.pageAsksSync, message),
});

// MARK: - Private

export { messages };
