import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as CLIPBOARD_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `clipboard` is the environment's.
export function createClipboard({ IDENTITY, clipboard: CLIPBOARD }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // From main: a page reaches the clipboard only while it has focus, and a command picked in a page of the shell
    // runs in a mod's page while that page has it. Copying is everyone's; reading what was copied is
    // system.clipboard.
    function start() {
        PROTOCOL.readText.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, CLIPBOARD_PERMISSION.CLIPBOARD);
            return CLIPBOARD.readText();
        });
        // Copying replaces what the person copied, so it is their act: during their click or key in the page.
        PROTOCOL.writeText.handle(({ text }, sender) => {
            IDENTITY.modFrom(sender);
            if (!IDENTITY.consumeUserActivation(sender)) return false;
            CLIPBOARD.writeText(text);
            return true;
        });
    }

    // MARK: - Private

    return { start };
}
