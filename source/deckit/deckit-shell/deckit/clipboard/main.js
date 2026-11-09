import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from '../../../deckit-sdk/deckit/clipboard/protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `clipboard` is the environment's.
export function createClipboard({ clipboard: CLIPBOARD }) {
    // MARK: - Property
    // MARK: - Initializer
    // MARK: - Public
    // From main, for the mod in the page that asks, as the channels' guards let it.
    function start() {
        PROTOCOL.readText.handle(() => CLIPBOARD.readText());
        PROTOCOL.writeText.handle(({ text }) => {
            CLIPBOARD.writeText(text);
        });
    }

    // MARK: - Private

    return { start };
}
