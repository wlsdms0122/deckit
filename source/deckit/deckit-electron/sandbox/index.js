import * as ORIGIN from './model/origin.js';
import { storeOf } from '../webkit/index.js';

// MARK: - Property
// Every page of deck's. What runs a mod runs in deckit's world, whose code the policy leaves alone; the page's own
// world runs only scripts from its origin, a mod's own files. What deckit's world loads the policy still holds, so a
// blob worker is named.
const PAGE = [
    '<!doctype html>',
    '<meta charset="utf-8">',
    '<title></title>',
    `<meta http-equiv="Content-Security-Policy" content="script-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'">`,
    '',
].join('\n');
// The types of the files a mod's page loads, by extension; any other is sent as bytes.
const TYPES = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
});

// MARK: - Initializer
// MARK: - Public
// Where a page of deck's keeps its storage, apart from the host app's and each from the others: one for each mod and
// one for each page that runs none, by `name`, under the environment's `id`.
export function storeFor(id, name) {
    return storeOf(`deckit:${id}:${name}`);
}

// What a mod's pages kept: their storage, taken.
export function clearStorage(WEBKIT, id, modId) {
    return WEBKIT.clear(storeFor(id, ORIGIN.originOf(modId)));
}

// Every page of deck's is the same PAGE, whichever origin it is loaded under: what it becomes is asked of main as it
// starts. Under a mod's origin the rest of the folder `folderOf(modId)` answers is served too, for its page to use:
// images, styles, data, scripts. Answers how a load of a page's scheme is answered: `answer({ url, reply })`.
export function serve({ folderOf, FOLDER }) {
    return ({ url, reply }) => {
        const { host, pathname } = new URL(url);
        if (pathname === '/') return reply({ type: 'text/html; charset=utf-8', body: PAGE });
        const folder = folderOf(ORIGIN.modOfHost(host));
        const file = folder && servedFile(FOLDER, folder, pathname);
        if (!file) return reply({ status: 404, body: '' });
        const extension = require('path').extname(file).toLowerCase();
        return reply({ file, type: TYPES[extension] || 'application/octet-stream' });
    };
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
