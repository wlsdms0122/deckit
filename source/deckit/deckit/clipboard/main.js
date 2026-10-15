import * as CLIPBOARD_PERMISSION from './model/permission.js';

export function createClipboard({ PROTOCOL, IDENTITY }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // From main: a page reaches the clipboard only while it has focus, and a command picked in a page of the shell
    // runs in a mod's page while that page has it. Copying is everyone's; reading what was copied is
    // system.clipboard.
    function start() {
        const { clipboard } = require('electron');
        PROTOCOL.readText.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, CLIPBOARD_PERMISSION.CLIPBOARD);
            return clipboard.readText();
        });
        // Copying replaces what the person copied, so it is their act: during their click or key in the page.
        PROTOCOL.writeText.handle(({ text }, sender) => {
            IDENTITY.modFrom(sender);
            if (!IDENTITY.consumeUserActivation(sender)) return false;
            clipboard.writeText(text);
            return true;
        });
    }

    // MARK: - Private

    return { start };
}
