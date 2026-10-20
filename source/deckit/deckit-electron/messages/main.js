// What carries deck's messages on main's side, over Electron's IPC (deckit-shell/environment: MAIN.messages): a
// page's sender is the page.
import * as WIRE from './protocol.js';

// MARK: - Property
let listening = false;

// MARK: - Initializer
// MARK: - Public
function listen({ told, asked, askedSync, answered }) {
    if (listening) throw new Error('[deckit] deck is heard already');
    listening = true;
    const { ipcMain } = require('electron');
    ipcMain.on(WIRE.pageTells.channel, (event, message) => told(event.sender, message));
    ipcMain.handle(WIRE.pageAsks.channel, (event, message) => asked(event.sender, message));
    // A page asking sync waits until main has the answer, a promise's included.
    ipcMain.on(WIRE.pageAsksSync.channel, (event, message) => {
        askedSync(event.sender, message).then((result) => {
            event.returnValue = result;
        });
    });
    ipcMain.on(WIRE.pageAnswers.channel, (event, message) => answered(event.sender, message));
}

function tell(page, message) {
    if (!page.isDestroyed()) page.send(WIRE.mainTells.channel, message);
}

function ask(page, message) {
    page.send(WIRE.mainAsks.channel, message);
}

const messages = Object.freeze({ listen, tell, ask });

// MARK: - Private

export { messages };
