import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import * as OPEN_PERMISSION from './model/permission.js';
import * as ORIGIN from '../runner/model/origin.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `open` is the environment's: what opens an address or a file outside the app.
export function createOpen({ LOG, IDENTITY, RUNNER, CORE, open: SYSTEM }) {
    // MARK: - Property
    // A handler that has not answered by then passes, so one stuck page does not hold every link.
    const OFFER_MS = 3000;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle((request, sender) =>
            open(request.url, { ...request, opensFiles: opensFiles(sender), by: IDENTITY.modFrom(sender).id })
        );
        PROTOCOL.reveal.handle(({ file }, sender) => {
            IDENTITY.modFrom(sender, OPEN_PERMISSION.FILE_HANDLERS);
            return SYSTEM.reveal(file);
        });
        PROTOCOL.handlerLists.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, OPEN_PERMISSION.URL_SCHEMES);
            return CORE.request('open/handlerLists');
        });
        PROTOCOL.setHandlers.handle(({ scheme, order, off }, sender) => {
            IDENTITY.modFrom(sender, OPEN_PERMISSION.URL_SCHEMES);
            return CORE.request('open/setHandlers', { scheme, order, off });
        });
    }

    // Offered to each handler the core routes it to in turn, the first to take it ending it; then opened by what deckit
    // opens it with by itself. `opensFiles` is whether the caller may hand a file on, to a mod or to the file's app:
    // the host's word, or a mod's system.file-handlers. `by` is the id of the mod that asks, if any.
    async function open(
        url,
        { activates = true, usesDefaultApp = false, target = '', opensFiles = false, by = null } = {}
    ) {
        const route = await CORE.request('open/route', { url: String(url), opensFiles, usesDefaultApp });
        if (await offer(route.handlers, route.url, { activates, target }, by)) return true;
        return system(route.system, route.url, { activates });
    }

    // What a page asks to open outside itself, a window or an address its document leaves for, offered as `open`
    // does for the mod the page runs. `options` are what `open` takes.
    function openFrom(page, url, options = {}) {
        open(url, { ...options, opensFiles: opensFiles(page), by: IDENTITY.modOf(page)?.id }).catch((error) =>
            LOG.warn(`${IDENTITY.modOf(page)?.id || 'a page'}: ${url} did not open`, error)
        );
    }

    // MARK: - Private
    function opensFiles(page) {
        const mod = IDENTITY.modFrom(page);
        return mod.permissions.some(({ id }) => id === OPEN_PERMISSION.FILE_HANDLERS);
    }

    // Only a plain true takes it, so a forgotten return passes it on rather than losing it. A handler not running is
    // launched for the address as its turn comes, and one that does not launch passes it on.
    async function offer(handlers, url, options, by) {
        for (const id of handlers) {
            const launched = await RUNNER.activate(id, ORIGIN.work({ url }, by)).catch((error) => {
                LOG.warn(`${id} could not open ${url}`, error);
                return null;
            });
            if (!launched) continue;
            const page = IDENTITY.pageOf(id);
            const taken = await PROTOCOL.offer.invoke(page, { url, options }, { timeout: OFFER_MS }).catch((error) => {
                LOG.warn(`${id} could not open ${url}`, error);
                return false;
            });
            if (taken === true) return true;
        }
        return false;
    }

    // The web goes to the system browser, and a file to its app.
    async function system(handler, url, { activates }) {
        if (handler === 'browser') {
            await SYSTEM.url(url, { activate: activates });
            return true;
        }
        if (handler !== 'file') return false;
        const file = filePathOf(url);
        return !!file && (await SYSTEM.file(file));
    }

    function filePathOf(url) {
        const parsed = new URL(url);
        if (parsed.host && parsed.host !== 'localhost') return '';
        return decodeURIComponent(parsed.pathname);
    }

    return { start, open, openFrom };
}
