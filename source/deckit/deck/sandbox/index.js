import * as ORIGIN from './model/origin.js';

export function createSandbox({ CONFIG, IDENTITY, CATALOG, FOLDER }) {
    // MARK: - Property
    // Electron takes privileged schemes in one call to registerSchemesAsPrivileged, before the app is ready, and a
    // later call replaces an earlier one; the host app makes it, with deck's scheme beside its own.
    const SCHEME = ORIGIN.SCHEME;
    // Every page of deck's. What runs a mod runs in the preload's isolated world, whose code the policy leaves
    // alone; the page's own world runs only scripts from its origin, a mod's own files. What the isolated world
    // loads the policy still holds, so a blob worker is named.
    const PAGE = [
        '<!doctype html>',
        '<meta charset="utf-8">',
        '<title></title>',
        `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`,
        '',
    ].join('\n');
    // A page that runs no mod is named as a host is, with no dot, so its origin is never a mod's.
    const PAGE_NAME = /^[a-z][a-z0-9-]*$/;
    let preload = null;

    // MARK: - Initializer
    // MARK: - Public
    // Before any page of deck's loads, once the app is ready. `given` is the file every page loads with, which the
    // host app put together around the renderer bundles.
    function start({ preload: given }) {
        preload = given;
        serve();
    }

    // A view for a page of deck's: sandboxed, isolated, in deck's own session. `webview`: whether its page may show
    // the web. How it looks where it is shown is for whoever shows it.
    function view({ webview }) {
        const { WebContentsView } = require('electron');
        return new WebContentsView({
            webPreferences: {
                preload,
                session: session(),
                sandbox: true,
                contextIsolation: true,
                webviewTag: webview,
            },
        });
    }

    // A page that runs no mod, made for a layer on deck: at its own origin, it loads as every page of deck's does
    // and then asks main what it is.
    function page(name) {
        if (!PAGE_NAME.test(String(name)))
            throw new Error(`"${name}" is not a page name: a lower case letter, then letters, digits and -`);
        const made = view({ webview: false });
        IDENTITY.add(made.webContents, { page: name });
        made.webContents.loadURL(ORIGIN.addressOf(ORIGIN.pageOriginOf(name)));
        return made;
    }

    // What a mod's pages kept: their storage in deck's own session.
    function clearSessions(modId) {
        return session().clearStorageData({ origin: ORIGIN.originOf(modId) });
    }

    // MARK: - Private
    // The session deck's pages load in, apart from the host app's.
    function session() {
        return require('electron').session.fromPartition(`persist:${CONFIG.id}`);
    }

    // Every page of deck's is the same PAGE, whichever origin it is loaded under: what it becomes is asked of main
    // as it starts. Under a mod's origin the rest of its folder is served too, for its page to use: images, styles,
    // data, scripts.
    function serve() {
        const { net } = require('electron');
        const { pathToFileURL } = require('url');
        const missing = () => new Response('', { status: 404 });
        const own = session();
        own.protocol.handle(SCHEME.scheme, (request) => {
            const { host, pathname } = new URL(request.url);
            if (pathname === '/')
                return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
            const id = ORIGIN.modOfHost(host);
            const folder = CATALOG.mods().find((mod) => mod.id === id)?.folder;
            const file = folder && servedFile(folder, pathname);
            return file ? net.fetch(pathToFileURL(file).toString()).catch(missing) : missing();
        });
        // Electron grants every permission a session has no handler for. A mod reaches the camera, the clipboard or
        // a notification through what deck and the layers on it hand it, which hold it to its permissions, and never
        // through the web's.
        own.setPermissionRequestHandler((_webContents, _permission, answer) => answer(false));
        own.setPermissionCheckHandler(() => false);
    }

    // The file of the mod's folder a path names: a link out of the folder and a path that is not one are not
    // served.
    function servedFile(folder, pathname) {
        try {
            return FOLDER.fileIn(folder, '.' + decodeURIComponent(pathname))?.file || null;
        } catch {
            return null;
        }
    }

    return { SCHEME, start, view, page, clearSessions };
}
