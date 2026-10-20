import * as MAIN_PROCESS_PERMISSION from '../main-process/model/permission.js';
import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as OPEN_PERMISSION from './model/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// `open` is the environment's: what opens an address or a file outside the app.
export function createOpen({ LOG, IDENTITY, CORE, open: SYSTEM }) {
    // MARK: - Property
    // A handler that has not answered by then passes, so one stuck page does not hold every link.
    const OFFER_MS = 3000;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        PROTOCOL.open.handle((request, sender) => {
            IDENTITY.modFrom(sender);
            return open(request.url, {
                ...request,
                userInitiated: spendsUserActivation(sender),
            });
        });
        // Only on a person's click or key: otherwise any mod could open Finder at will, or learn which paths exist.
        PROTOCOL.reveal.handle(({ file }, sender) => {
            IDENTITY.modFrom(sender);
            return spendsUserActivation(sender) && SYSTEM.reveal(file);
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
    // opens it with by itself.
    async function open(url, { activates = true, userInitiated = false, usesDefaultApp = false, target = '' } = {}) {
        const route = await CORE.request('open/route', { url: String(url), userInitiated, usesDefaultApp });
        const options = { activates, userInitiated, target };
        if (await offer(route.handlers, route.url, options)) return true;
        return system(route.system, route.url, { activates });
    }

    // What a page asks to open outside itself, a window or an address its document leaves for, offered as `open`
    // does, a press in the page making it the person's. `options` are what `open` takes.
    function openFrom(page, url, options = {}) {
        const userInitiated = IDENTITY.consumeUserActivation(page);
        open(url, { ...options, userInitiated }).catch((error) =>
            LOG.warn(`${IDENTITY.modOf(page)?.id || 'a page'}: ${url} did not open`, error)
        );
    }

    // MARK: - Private
    // A mod with system.main-process may run its own code in this process and could open the file itself, so its word is
    // taken; any other has to show a person's press.
    function spendsUserActivation(sender) {
        const mod = IDENTITY.modFrom(sender);
        if (mod.permissions.some(({ id }) => id === MAIN_PROCESS_PERMISSION.MAIN_PROCESS)) return true;
        return IDENTITY.consumeUserActivation(sender);
    }

    // Only a plain true takes it, so a forgotten return passes it on rather than losing it.
    async function offer(handlers, url, options) {
        for (const id of handlers) {
            const page = IDENTITY.pageOf(id);
            if (!page) continue;
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
