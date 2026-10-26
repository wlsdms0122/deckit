import * as CHANNEL from '../../deck/channel/index.js';
import * as IPC from '../../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as CLIPBOARD_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `clipboard` is the environment's.
export function createClipboard({ IDENTITY, clipboard: CLIPBOARD }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // From main, by the permission of the mod in the page that asks.
    function start() {
        PROTOCOL.readText.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, CLIPBOARD_PERMISSION.CLIPBOARD_READ);
            return CLIPBOARD.readText();
        });
        PROTOCOL.writeText.handle(({ text }, sender) => {
            IDENTITY.modFrom(sender, CLIPBOARD_PERMISSION.CLIPBOARD_WRITE);
            CLIPBOARD.writeText(text);
        });
    }

    // MARK: - Private

    return { start };
}
