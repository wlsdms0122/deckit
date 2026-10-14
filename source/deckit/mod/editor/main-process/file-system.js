// The editor's main process module: reads, writes and searches the files the editor opens. Asynchronous throughout:
// in the main process, a synchronous read stalls every window of the host app.
module.exports = ({ window, files }) => {
    const fs = require('fs');
    const path = require('path');
    const { Worker } = require('worker_threads');
    const { dialog } = require('electron');
    const { patternOf } = require('./pattern.js');
    const { decodeText, walk } = require('./text.js');
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

    const listingsUnderWay = new Map(); // root -> { listing, next }
    // The view only wants the newest answer, so a new search stops the one before it.
    const searches = new Map(); // root -> { stop() }

    return {
        async read(given) {
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
        },

        async stat(given) {
            try {
                const status = await stat(absolute(given));
                return { exists: true, mtime: status.mtimeMs };
            } catch {
                return { exists: false, mtime: 0 };
            }
        },

        // In place, not a temporary file and a rename: a rename breaks hard links and looks like a delete to watchers.
        async write(given, text, seen) {
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
        },

        async pick(what = 'file', suggested = '') {
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
        },

        create(folder) {
            return files.fresh(absolute(folder), 'untitled', (full) => writeFile(full, '', { flag: 'wx' }));
        },
        mkdir(folder) {
            return files.fresh(absolute(folder), 'untitled folder', (full) => mkdir(full));
        },
        rename(given, name) {
            return files.rename(absolute(given), name);
        },
        move(given, folder) {
            return files.move(absolute(given), absolute(folder));
        },
        async trash(given) {
            await files.trash(absolute(given));
            return true;
        },

        async list(given) {
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
        },

        // A fresh ask while a listing runs gets the next one, started when that one ends: the walk under way may have
        // passed a folder changed since. Fresh asks made in the meantime share that next listing.
        files(given, { fresh = false } = {}) {
            const root = absolute(given);
            const underWay = listingsUnderWay.get(root);
            if (underWay && !fresh) return underWay.listing;
            if (underWay) {
                underWay.next ??= underWay.listing.catch(() => {}).then(() => startListing(root));
                return underWay.next;
            }
            return startListing(root);
        },

        // Lines are 1-based, columns 0-based in characters.
        async search(given, query, options = {}) {
            const root = absolute(given);
            searches.get(root)?.stop();
            if (!String(query || '')) return { files: [], total: 0, truncated: false, stoppedBy: '', warning: '' };
            const search = {
                stopped: false,
                stop() {
                    this.stopped = true;
                },
            };
            searches.set(root, search);
            try {
                const { tops, warning } = await searchRootsOf(root, options.folders);
                if (search.stopped) return { files: [], total: 0, truncated: true, stoppedBy: 'stopped', warning: '' };
                const found = await searchIn(tops, query, options, search);
                return { ...found, warning: [warning, found.warning].filter(Boolean).join('. ') };
            } finally {
                if (searches.get(root) === search) searches.delete(root);
            }
        },
    };

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

    function startListing(root) {
        const underWay = { listing: listFiles(root), next: null };
        listingsUnderWay.set(root, underWay);
        const end = () => {
            if (!underWay.next) listingsUnderWay.delete(root);
        };
        underWay.listing.then(end, end);
        return underWay.listing;
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

    // The search runs in a thread of its own (search.js), stopped where it is when it runs out of time or a newer
    // one replaces it (`search.stop()`): what it found by then stands.
    function searchIn(tops, query, options, search) {
        const found = [];
        let total = 0;
        const pattern = patternOf(query, options);
        const worker = new Worker(path.join(__dirname, 'search.js'), {
            workerData: {
                tops,
                pattern,
                options,
                limits: { fileSize: SEARCHED_LIMIT, matches: MATCH_LIMIT, text: MATCH_TEXT_LIMIT },
            },
        });
        return new Promise((resolve, reject) => {
            const end = (stoppedBy, warning = '') => {
                clearTimeout(timer);
                worker.terminate();
                found.sort((left, right) => left.path.localeCompare(right.path));
                resolve({ files: found, total, truncated: !!stoppedBy, stoppedBy, warning, pattern });
            };
            const timer = setTimeout(() => end('time'), SEARCH_TIME_LIMIT_MS);
            search.stop = () => end('stopped');
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
    }
};
