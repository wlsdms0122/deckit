import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as OPEN_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Opening outside the app, with the system: the web in the browser, and a file in its app for a caller that may hand
// files on. `open` is the environment's.
export function createOpen({ LOG, IDENTITY, open: SYSTEM }) {
    // MARK: - Property
    // The schemes opened with the system, and what opens each.
    const SYSTEM_HANDLERS = Object.freeze({ http: 'browser', https: 'browser', file: 'file' });

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle(({ url, activates }, sender) => open(url, { activates, opensFiles: opensFiles(sender) }));
        PROTOCOL.reveal.handle(({ file }, sender) => {
            IDENTITY.modFrom(sender, OPEN_PERMISSION.FILE_HANDLERS);
            return SYSTEM.reveal(file);
        });
    }

    // Answers whether it opened: an address of another scheme opens nowhere, and a file only where the caller may
    // hand files on (`opensFiles`, a mod's system.file-handlers) and only where the file is.
    async function open(url, { activates = true, opensFiles = false } = {}) {
        const address = String(url).trim();
        const handler = SYSTEM_HANDLERS[schemeOf(address)];
        if (handler === 'browser') {
            await SYSTEM.url(address, { activate: activates });
            return true;
        }
        if (handler !== 'file' || !opensFiles) return false;
        const file = filePathOf(address);
        return !!file && (await SYSTEM.file(file));
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

    // The scheme an address is written with, lower case, or '' for none (RFC 3986).
    function schemeOf(address) {
        const scheme = address.match(/^([A-Za-z][A-Za-z0-9+.-]*):/)?.[1] ?? '';
        return scheme.toLowerCase();
    }

    function filePathOf(url) {
        try {
            const parsed = new URL(url);
            if (parsed.host && parsed.host !== 'localhost') return '';
            return decodeURIComponent(parsed.pathname);
        } catch {
            return '';
        }
    }

    return { start, open, openFrom };
}
