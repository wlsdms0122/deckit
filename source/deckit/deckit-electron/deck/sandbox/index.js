import * as ORIGIN from './model/origin.js';

// MARK: - Property
// Every page of deck's. What runs a mod runs in the preload's isolated world, whose code the policy leaves alone; the
// page's own world runs only scripts from its origin, a mod's own files. What the isolated world loads the policy still
// holds, so a blob worker is named.
const PAGE = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<title></title>',
    `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`,
    '',
].join('\n');

// MARK: - Initializer
// MARK: - Public
// A view for a page of deck's: sandboxed, isolated, in deck's own session for `id`, loading with `preload`, with what is
// added to its `webPreferences`. How it looks where it is shown is for whoever shows it.
export function makeView({ id, preload, webPreferences = {} }) {
    const { WebContentsView } = require('electron');
    return new WebContentsView({
        webPreferences: {
            ...webPreferences,
            preload,
            session: sessionOf(id),
            sandbox: true,
            contextIsolation: true,
        },
    });
}

// The page runs at full speed off screen too. Chromium takes the preference back at each load, so it is given again as
// each one finishes. `guard` adds the listener.
export function keepDrawing(webContents, guard) {
    guard(webContents, 'did-finish-load', () => webContents.setBackgroundThrottling(false));
}

// What a mod's pages kept: their storage in deck's own session.
export function clearStorage(id, modId) {
    return sessionOf(id).clearStorageData({ origin: ORIGIN.originOf(modId) });
}

// Every page of deck's is the same PAGE, whichever origin it is loaded under: what it becomes is asked of main as it
// starts. Under a mod's origin the rest of the folder `folderOf(modId)` answers is served too, for its page to use:
// images, styles, data, scripts. Once the app is ready, before any page of deck's loads.
export function serve({ id, folderOf, FOLDER }) {
    const { net } = require('electron');
    const { pathToFileURL } = require('url');
    const missing = () => new Response('', { status: 404 });
    const own = sessionOf(id);
    own.protocol.handle(ORIGIN.SCHEME.scheme, (request) => {
        const { host, pathname } = new URL(request.url);
        if (pathname === '/') return new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } });
        const folder = folderOf(ORIGIN.modOfHost(host));
        const file = folder && servedFile(FOLDER, folder, pathname);
        return file ? net.fetch(pathToFileURL(file).toString()).catch(missing) : missing();
    });
    // Electron grants every permission a session has no handler for. A mod reaches the camera, the clipboard or a
    // notification through what deck and the layers on it hand it, which hold it to its permissions, and never through
    // the web's.
    own.setPermissionRequestHandler((_webContents, _permission, answer) => answer(false));
    own.setPermissionCheckHandler(() => false);
}

// MARK: - Private
// The file of the mod's folder a path names: a link out of the folder and a path that is not one are not served.
function servedFile(FOLDER, folder, pathname) {
    try {
        return FOLDER.fileIn(folder, '.' + decodeURIComponent(pathname))?.file || null;
    } catch {
        return null;
    }
}

// The session deck's pages load in, apart from the host app's.
function sessionOf(id) {
    return require('electron').session.fromPartition(`persist:${id}`);
}
