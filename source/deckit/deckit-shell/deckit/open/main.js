import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from '../../../deckit-sdk/deckit/open/protocol.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Opening outside the app, with the system: the web in the browser, and a file in its app. `open` is the
// environment's; what may open a file is held to system.file-handlers before it asks (open/protocol.js: open).
export function createOpen({ open: SYSTEM }) {
    // MARK: - Property
    const WEB = Object.freeze(['http:', 'https:']);

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle(({ url, activates }) => open(url, { activates }));
    }

    // `url` read as a URL and handed the environment as it serializes, the web's to open in the browser and a file's
    // path to open in its app, either with `activates`. Refused with UNSUPPORTED_URL for what is no URL, a URL of
    // another scheme, a file on another host, or one whose path does not decode. Answers nothing once it is handed on.
    async function open(url, { activates = true } = {}) {
        const address = URL.canParse(url) ? new URL(url) : null;
        const file = address?.protocol === 'file:';
        if (WEB.includes(address?.protocol)) {
            await SYSTEM.url(address.href, { activate: activates });
            return;
        }
        const path = file && !address.host ? decoded(address.pathname) : null;
        if (path === null)
            throw REQUEST.refusal('call', 'UNSUPPORTED_URL', `${url} is no address opened outside the app`);
        await SYSTEM.file(path, { activate: activates });
    }

    // MARK: - Private
    // A path percent-decoded, its bytes read as UTF-8, or null where a `%` is not two hexadecimal digits or the bytes
    // are not UTF-8.
    function decoded(path) {
        try {
            return decodeURIComponent(path);
        } catch {
            return null;
        }
    }

    return { start, open };
}
