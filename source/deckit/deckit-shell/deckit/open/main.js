import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as OPEN_PERMISSION from './model/permission.js';
import * as REQUEST from '../request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Opening outside the app, with the system: the web in the browser, and a file in its app for a caller that may open
// files. `open` is the environment's.
export function createOpen({ LOG, IDENTITY, open: SYSTEM }) {
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
    // URL, a URL of another scheme, or a file on another host. Answers nothing once it is handed on.
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
        if (!file || (address.host && address.host !== 'localhost'))
            throw REQUEST.refusal('call', 'UNSUPPORTED_URL', `${url} is no address opened outside the app`);
        await SYSTEM.file(decodeURIComponent(address.pathname), { activate: activates });
    }

    // What a page asks to open outside itself, a window or an address its document leaves for, opened as `open`
    // does for the mod the page runs. `options` are what `open` takes.
    function openFrom(page, url, options = {}) {
        open(url, { ...options, opensFiles: opensFiles(page) }).catch((error) =>
            LOG.warn(`${IDENTITY.modOf(page)?.id || 'a page'}: ${url} did not open`, error)
        );
    }

    // MARK: - Private
    function opensFiles(page) {
        const mod = IDENTITY.modFrom(page);
        return mod.permissions.some(({ id }) => id === OPEN_PERMISSION.FILE_HANDLERS);
    }

    return { start, open, openFrom };
}
