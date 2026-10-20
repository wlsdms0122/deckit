// What carries deck's messages on a page's side, over Electron's IPC (deckit-shell/environment: PAGE.messages). What
// main tells and asks is heard as this loads, with the page's start, and kept until something listens.
import * as WIRE from './protocol.js';

// MARK: - Property
const { ipcRenderer } = require('electron');
let listener = null;
const early = []; // [kind, message] heard before something listens

// MARK: - Initializer
ipcRenderer.on(WIRE.mainTells.channel, (_event, message) => deliver('told', message));
ipcRenderer.on(WIRE.mainAsks.channel, (_event, message) => deliver('asked', message));

// MARK: - Public
function listen(given) {
    if (listener) throw new Error('[deckit] main is heard already');
    listener = given;
    for (const [kind, message] of early.splice(0)) listener[kind](message);
}

const messages = Object.freeze({
    listen,
    tell: (message) => ipcRenderer.send(WIRE.pageTells.channel, message),
    ask: (message) => ipcRenderer.invoke(WIRE.pageAsks.channel, message),
    askSync: (message) => ipcRenderer.sendSync(WIRE.pageAsksSync.channel, message),
    answer: (message) => ipcRenderer.send(WIRE.pageAnswers.channel, message),
});

// MARK: - Private
function deliver(kind, message) {
    if (listener) listener[kind](message);
    else early.push([kind, message]);
}

export { messages };
