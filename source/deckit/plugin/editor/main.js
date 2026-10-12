// Reads, writes and searches the files the editor opens. Asynchronous throughout: in the main process, a synchronous
// read stalls every window of the app.
module.exports = ({ handle, window, files }) => {
    const fs = require('fs');
    const path = require('path');
    const { Worker } = require('worker_threads');
    const { dialog } = require('electron');
    const { decodeText, walk } = require('./main/text.js');
    const { stat, readFile, writeFile, readdir, mkdir } = fs.promises;

    // Big enough for any source file, small enough that a log or a dump is not opened by mistake.
    const OPEN_LIMIT = 5 * 1024 * 1024;
    const SEARCHED_LIMIT = 1024 * 1024;
    const LISTED_LIMIT = 300000;
    const SEARCH_TIME_LIMIT_MS = 20000;
    const MATCH_LIMIT = 5000;
    const MATCH_TEXT_LIMIT = 400;
    const LISTING_TIME_LIMIT_MS = 30000;
    const HIDDEN_NAMES = new Set(['.git', '.DS_Store']);

    // Listing a big repository takes a moment, so a listing is kept until the view asks for it `fresh`.
    const listings = new Map(); // root -> promise of { files, truncated }
    const listingsUnderWay = new Map(); // root -> the listing under way
    // The view only wants the newest answer, so a new search stops the one before it.
    const searches = new Map(); // root -> { stop() }

    handle('read', async (given) => {
        const file = absolute(given);
        let status;
        try {
            status = await stat(file);
        } catch {
            throw files.refuse('GONE', 'no such file');
        }
        if (!status.isFile()) throw files.refuse('NOT_TEXT', 'not a file');
        if (status.size > OPEN_LIMIT)
            throw files.refuse('NOT_TEXT', `too big to open here (${Math.round(status.size / 1024 / 1024)} MB)`);
        const text = decodeText(await readFile(file));
        if (text === null) throw files.refuse('NOT_TEXT', 'not a UTF-8 text file');
        return { text, mtime: status.mtimeMs };
    });

    handle('stat', async (given) => {
        try {
            const status = await stat(absolute(given));
            return { exists: true, mtime: status.mtimeMs };
        } catch {
            return { exists: false, mtime: 0 };
        }
    });

    // In place, not a temporary file and a rename: a rename breaks hard links and looks like a delete to watchers.
    handle('write', async (given, text, seen) => {
        const file = absolute(given);
        if (seen != null) {
            let now = null;
            try {
                now = (await stat(file)).mtimeMs;
            } catch {}
            if (now !== null && Math.abs(now - seen) > 1)
                throw files.refuse('CHANGED', 'changed on disk since it was opened');
        }
        await writeFile(file, String(text), 'utf8');
        return { mtime: (await stat(file)).mtimeMs };
    });

    handle('pick', async (what = 'file', suggested = '') => {
        const parent = window.ofPage() || undefined;
        if (what === 'save') {
            const picked = await dialog.showSaveDialog(parent, {
                defaultPath: suggested || undefined,
                properties: ['createDirectory', 'showHiddenFiles'],
            });
            return picked.canceled || !picked.filePath ? [] : [picked.filePath];
        }
        const properties =
            what === 'folder'
                ? ['openDirectory', 'createDirectory', 'showHiddenFiles']
                : ['openFile', 'multiSelections', 'showHiddenFiles'];
        const picked = await dialog.showOpenDialog(parent, { properties });
        return picked.canceled ? [] : picked.filePaths;
    });

    handle('create', (folder) =>
        files.fresh(absolute(folder), 'untitled', (full) => writeFile(full, '', { flag: 'wx' }))
    );
    handle('mkdir', (folder) => files.fresh(absolute(folder), 'untitled folder', (full) => mkdir(full)));
    handle('rename', (given, name) => files.rename(absolute(given), name));
    handle('move', (given, folder) => files.move(absolute(given), absolute(folder)));
    handle('trash', async (given) => {
        await files.trash(absolute(given));
        return true;
    });

    handle('list', async (given) => {
        const folder = absolute(given);
        let listed;
        try {
            listed = await readdir(folder, { withFileTypes: true });
        } catch (error) {
            throw /^(ENOENT|ENOTDIR)$/.test(error.code)
                ? files.refuse('GONE', 'that folder is no longer there')
                : error;
        }
        const entries = await Promise.all(
            listed.filter((entry) => !HIDDEN_NAMES.has(entry.name)).map((entry) => entryOf(folder, entry))
        );
        return entries.sort(
            (left, right) =>
                right.folder - left.folder ||
                left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' })
        );
    });

    // A fresh ask joins a listing under way: it started after whatever made the ask fresh.
    handle('files', (given, { fresh = false } = {}) => {
        const root = absolute(given);
        if (listingsUnderWay.has(root)) return listingsUnderWay.get(root);
        if (!fresh && listings.has(root)) return listings.get(root);
        const listing = listFiles(root);
        listings.set(root, listing);
        listingsUnderWay.set(root, listing);
        listing.then(
            () => listingsUnderWay.delete(root),
            () => {
                listingsUnderWay.delete(root);
                if (listings.get(root) === listing) listings.delete(root);
            }
        );
        return listing;
    });

    // Lines are 1-based, columns 0-based in characters.
    handle('search', async (given, query, options = {}) => {
        const root = absolute(given);
        searches.get(root)?.stop();
        if (!String(query || '')) return { files: [], total: 0, truncated: false, stoppedBy: '', warning: '' };
        const { tops, warning } = await searchRootsOf(root, options.folders);
        const search = searchIn(tops, query, options);
        searches.set(root, search);
        try {
            const found = await search.result;
            return { ...found, warning: [warning, found.warning].filter(Boolean).join('. ') };
        } finally {
            if (searches.get(root) === search) searches.delete(root);
        }
    });

    function absolute(given) {
        const text = String(given || '');
        if (!path.isAbsolute(text)) throw new Error('not an absolute path: ' + text);
        return text;
    }

    async function entryOf(folder, entry) {
        let isFolder = entry.isDirectory();
        if (entry.isSymbolicLink()) {
            try {
                isFolder = (await stat(path.join(folder, entry.name))).isDirectory();
            } catch {
                isFolder = false;
            }
        }
        return { name: entry.name, path: path.join(folder, entry.name), folder: isFolder };
    }

    async function listFiles(root) {
        const listed = [];
        const deadline = Date.now() + LISTING_TIME_LIMIT_MS;
        let truncated = false;
        for await (const file of walk(root)) {
            listed.push(path.relative(root, file));
            if (listed.length >= LISTED_LIMIT || Date.now() > deadline) {
                truncated = true;
                break;
            }
        }
        return { files: listed.sort(), truncated };
    }

    // A folder gone since it was picked is reported here only: refused when all are gone, a warning otherwise.
    async function searchRootsOf(root, folders) {
        const picked = [
            ...new Set(
                (Array.isArray(folders) ? folders : [])
                    .map((folder) => String(folder || '').replace(/^\/+|\/+$/g, ''))
                    .filter(Boolean)
            ),
        ].sort();
        const kept = picked.filter(
            (folder, index) => !picked.slice(0, index).some((other) => folder.startsWith(other + '/'))
        );
        const isFolder = (full) =>
            stat(full).then(
                (status) => status.isDirectory(),
                () => false
            );
        const tops = [];
        const gone = [];
        for (const folder of kept.length ? kept : [''])
            ((await isFolder(path.join(root, folder))) ? tops : gone).push(folder);
        // A path is never the first word: it is shown as a sentence, which would capitalise it.
        const goneMessage = 'No longer there: ' + gone.join(', ');
        if (!tops.length)
            throw files.refuse('GONE', kept.length ? goneMessage : "The workspace's folder is no longer there");
        return { tops: tops.map((folder) => path.join(root, folder)), warning: gone.length ? goneMessage : '' };
    }

    // The search runs in a thread of its own (main/search.js), stopped where it is when it runs out of time or a newer
    // one replaces it: what it found by then stands.
    function searchIn(tops, query, options) {
        const found = [];
        let total = 0;
        let settle = null;
        const worker = new Worker(path.join(__dirname, 'main', 'search.js'), {
            workerData: {
                tops,
                query: String(query),
                options,
                limits: { fileSize: SEARCHED_LIMIT, matches: MATCH_LIMIT, text: MATCH_TEXT_LIMIT },
            },
        });
        const result = new Promise((resolve, reject) => {
            const end = (stoppedBy, warning = '') => {
                clearTimeout(timer);
                worker.terminate();
                found.sort((left, right) => left.path.localeCompare(right.path));
                resolve({ files: found, total, truncated: !!stoppedBy, stoppedBy, warning });
            };
            const timer = setTimeout(() => end('time'), SEARCH_TIME_LIMIT_MS);
            settle = end;
            worker.on('message', (message) => {
                if (message.type === 'file') {
                    found.push({ path: message.path, matches: message.matches, mtime: message.mtime });
                    total += message.matches.length;
                } else if (message.type === 'done') {
                    const unreadable = message.unreadable.length
                        ? 'Some folders could not be read: ' + message.unreadable.join('; ')
                        : '';
                    end(message.stoppedBy, unreadable);
                } else if (message.type === 'error') {
                    clearTimeout(timer);
                    worker.terminate();
                    reject(new Error(message.message));
                }
            });
            worker.on('error', (error) => {
                clearTimeout(timer);
                reject(error);
            });
        });
        return { result, stop: () => settle?.('') };
    }
};
