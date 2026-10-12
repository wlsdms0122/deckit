// Reads, writes and searches the files the editor opens. Asynchronous throughout: in the main process, a synchronous
// read stalls every window of the app.
module.exports = ({ handle, files }) => {
    const fs = require('fs');
    const path = require('path');
    const { dialog, BrowserWindow } = require('electron');
    const { stat, readFile, writeFile, readdir, mkdir } = fs.promises;

    // Big enough for any source file, small enough that a log or a dump is not opened by mistake.
    const OPEN_LIMIT = 5 * 1024 * 1024;
    const SEARCHED_LIMIT = 1024 * 1024;
    const LISTED_LIMIT = 300000;
    const SEARCH_TIME_LIMIT_MS = 20000;
    const MATCH_LIMIT = 5000;
    const MATCH_TEXT_LIMIT = 400;
    const HIDDEN_NAMES = new Set(['.git', '.DS_Store']);
    const SKIPPED_FOLDERS = new Set([
        '.git',
        'node_modules',
        '.build',
        'build',
        'DerivedData',
        'Pods',
        'Carthage',
        '.gradle',
        'dist',
        '.next',
        '.venv',
        'venv',
        '__pycache__',
        '.idea',
        '.swiftpm',
    ]);
    // Every write is UTF-8, so a file in another encoding would come back with its bytes replaced. ignoreBOM keeps a
    // byte order mark as a character, so writing the text back writes the mark.
    const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

    // Listing a big repository takes a moment, so a listing is kept until the view asks for it `fresh`.
    const listings = new Map(); // root -> promise of { files, truncated }
    const listingsUnderWay = new Map(); // root -> the listing under way
    // The view only wants the newest answer, so a new search stops the one before it.
    const searches = new Map(); // root -> { stopped, stop() }

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
        const parent = BrowserWindow.getFocusedWindow() || undefined;
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
        const search = {
            stopped: false,
            stop() {
                this.stopped = true;
            },
        };
        searches.set(root, search);
        try {
            return await searchIn(root, query, options, search);
        } finally {
            if (searches.get(root) === search) searches.delete(root);
        }
    });

    function absolute(given) {
        const text = String(given || '');
        if (!path.isAbsolute(text)) throw new Error('not an absolute path: ' + text);
        return text;
    }

    function decodeText(buffer) {
        if (buffer.includes(0)) return null;
        try {
            return UTF8.decode(buffer);
        } catch {
            return null;
        }
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

    // A folder inside that cannot be read is passed over; the root itself refused (macOS privacy) is an error, not
    // an empty folder.
    async function* walk(root) {
        const folders = [root];
        while (folders.length) {
            const folder = folders.pop();
            let entries = [];
            try {
                entries = await readdir(folder, { withFileTypes: true });
            } catch (error) {
                if (folder === root) throw new Error('the folder could not be read: ' + error.message);
                continue;
            }
            for (const entry of entries) {
                if (SKIPPED_FOLDERS.has(entry.name) || entry.name === '.DS_Store') continue;
                const full = path.join(folder, entry.name);
                if (entry.isDirectory()) folders.push(full);
                else if (entry.isFile()) yield full;
            }
        }
    }

    async function readText(file) {
        try {
            const status = await stat(file);
            if (status.size > SEARCHED_LIMIT) return null;
            const text = decodeText(await readFile(file));
            return text === null ? null : { text, mtime: status.mtimeMs };
        } catch {
            return null;
        }
    }

    async function listFiles(root) {
        const listed = [];
        let truncated = false;
        for await (const file of walk(root)) {
            listed.push(path.relative(root, file));
            if (listed.length >= LISTED_LIMIT) {
                truncated = true;
                break;
            }
        }
        return { files: listed.sort(), truncated };
    }

    // Unicode, as the editor's find in a file reads a pattern.
    function patternOf(query, { regex = false, caseSensitive = false, word = false } = {}) {
        let source = regex ? String(query) : String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (word) source = `\\b(?:${source})\\b`;
        return new RegExp(source, caseSensitive ? 'gu' : 'giu');
    }

    // A plain name matches anywhere, a path with a slash from the top, and anything with * ? [ { is a glob as written.
    function globsOf(text) {
        return String(text || '')
            .split(',')
            .map((part) => part.trim().replace(/^\.\//, '').replace(/\/+$/, ''))
            .filter(Boolean)
            .flatMap((part) =>
                /[*?[{]/.test(part)
                    ? [part.includes('/') ? part : `**/${part}`]
                    : part.includes('/')
                      ? [part, `${part}/**`]
                      : [`**/${part}`, `**/${part}/**`]
            );
    }

    function escaped(character) {
        return character.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    }

    // A character at a time, so an escaped character is itself and no rule's output is read by the next.
    function globPattern(glob) {
        let source = '';
        for (let index = 0; index < glob.length; index++) {
            const character = glob[index];
            if (character === '\\' && index + 1 < glob.length) source += escaped(glob[++index]);
            else if (character === '*' && glob[index + 1] === '*') {
                if (glob[index + 2] === '/') {
                    source += '(?:.*/)?';
                    index += 2;
                } else {
                    source += '.*';
                    index += 1;
                }
            } else if (character === '*') source += '[^/]*';
            else if (character === '?') source += '[^/]';
            else if (character === '[') {
                const close = glob.indexOf(']', index + 1);
                if (close < 0) {
                    source += '\\[';
                    continue;
                }
                source += '[' + glob.slice(index + 1, close).replace(/^!/, '^') + ']';
                index = close;
            } else if (character === '{') {
                const close = glob.indexOf('}', index + 1);
                if (close < 0) {
                    source += '\\{';
                    continue;
                }
                const choices = glob
                    .slice(index + 1, close)
                    .split(',')
                    .map((choice) => globPattern(choice).source.slice(1, -1));
                source += '(?:' + choices.join('|') + ')';
                index = close;
            } else source += escaped(character);
        }
        return new RegExp('^' + source + '$');
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

    async function searchIn(root, query, options, search) {
        const byFile = new Map();
        let total = 0;
        let stoppedBy = '';
        const addMatch = (file, line, column, length, text) => {
            if (total >= MATCH_LIMIT) {
                stoppedBy = 'limit';
                return false;
            }
            if (!byFile.has(file)) byFile.set(file, []);
            byFile.get(file).push({
                line,
                column,
                length,
                hit: text.slice(column, column + length),
                text: text.length > MATCH_TEXT_LIMIT ? text.slice(0, MATCH_TEXT_LIMIT) : text,
            });
            total += 1;
            return true;
        };
        const include = globsOf(options.include);
        const exclude = globsOf(options.exclude);
        // Each folder is searched from inside, so include and exclude read paths relative to it.
        const { tops, warning } = await searchRootsOf(root, options.folders);
        // Taken as the search reads a file: one changed during a long search must not pass as unchanged.
        const modified = new Map(); // file -> its mtime as read
        const deadline = Date.now() + SEARCH_TIME_LIMIT_MS;
        const pattern = patternOf(query, options);
        const includes = include.map(globPattern);
        const excludes = exclude.map(globPattern);
        const candidates = async function* () {
            for (const top of tops) for await (const file of walk(top)) yield [top, file];
        };
        scan: for await (const [top, file] of candidates()) {
            if (search.stopped) break;
            if (Date.now() > deadline) {
                stoppedBy = 'time';
                break;
            }
            const inner = path.relative(top, file);
            if (includes.length && !includes.some((glob) => glob.test(inner))) continue;
            if (excludes.some((glob) => glob.test(inner))) continue;
            const read = await readText(file);
            if (read == null) continue;
            const lines = read.text.split('\n');
            for (let index = 0; index < lines.length; index++) {
                const line = lines[index].replace(/\r$/, '');
                pattern.lastIndex = 0;
                let match;
                while ((match = pattern.exec(line))) {
                    if (!match[0].length) {
                        pattern.lastIndex += 1;
                        continue;
                    }
                    modified.set(file, read.mtime);
                    if (!addMatch(file, index + 1, match.index, match[0].length, line)) break scan;
                }
            }
        }
        const found = [...byFile].map(([file, matches]) => ({ path: file, matches, mtime: modified.get(file) }));
        found.sort((left, right) => left.path.localeCompare(right.path));
        return { files: found, total, truncated: !!stoppedBy, stoppedBy, warning };
    }
};
