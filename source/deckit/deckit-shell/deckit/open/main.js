import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as OPEN_PERMISSION from './model/permission.js';
import * as REQUEST from '../request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Opening outside the app, with the system: the web in the browser, and a file in its app for a caller that may open
// files. `open` is the environment's.
export function createOpen({ IDENTITY, open: SYSTEM }) {
    // MARK: - Property
    const WEB = Object.freeze(['http:', 'https:']);

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle(({ url, activates }, sender) => open(url, { activates, opensFiles: opensFiles(sender) }));
        PROTOCOL.reveal.handle(({ file }, sender) => {
            IDENTITY.modFrom(sender, OPEN_PERMISSION.FILE_HANDLERS);
            return SYSTEM.reveal(file);
        });
    }

    // `url` read as a URL and handed the environment as it serializes, the web's to open in the browser and a file's
    // path to open in its app, either with `activates`, a file only where the caller may open files (`opensFiles`, a
    // mod's system.file-handlers): refused with NOT_PERMITTED otherwise. Refused with UNSUPPORTED_URL for what is no
    // URL, a URL of another scheme, a file on another host, or one whose path does not decode. Answers nothing once
    // it is handed on.
    async function open(url, { activates = true, opensFiles = false } = {}) {
        const address = URL.canParse(url) ? new URL(url) : null;
        const file = address?.protocol === 'file:';
        if (file && !opensFiles) {
            const why = `a file opens only for a mod with the ${OPEN_PERMISSION.FILE_HANDLERS} permission`;
            throw REQUEST.refusal('call', 'NOT_PERMITTED', why);
        }
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

    function opensFiles(page) {
        return IDENTITY.modFrom(page).granted.includes(OPEN_PERMISSION.FILE_HANDLERS);
    }

    return { start, open };
}
