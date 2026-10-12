module.exports = ({ folder, handle, send, files }) => {
    const fs = require('fs');
    const path = require('path');

    const ROOT = path.resolve(folder);
    const EXTENSION = '.md';
    const READ_LIMIT = 5 * 1024 * 1024;
    const DEPTH_LIMIT = 16;
    const SEARCH_LIMIT = 5000;
    const HITS_LIMIT = 200;
    const BOM = '﻿';

    let realRoot = null;
    // Modification times of the plugin's own writes, so the watcher does not report a save as a change from outside.
    const written = new Map(); // path -> mtime
    let watcher = null;
    let pending = new Set();
    let flushTimer = null;
    // The last request wins across the await in notesRoot().
    let watchRequests = 0;

    handle('root', async () => ({ root: await notesRoot() }));

    handle('tree', async () => {
        const root = await notesRoot();
        const allNotes = { name: '', path: '', folders: [], notes: [], count: 0 };
        const byPath = new Map([[root, allNotes]]);
        await walk(root, 0, async (full, entry, kind) => {
            const parent = byPath.get(path.dirname(full));
            if (kind === 'note') {
                let mtime = 0;
                try {
                    mtime = (await fs.promises.stat(full)).mtimeMs;
                } catch {}
                parent.notes.push({
                    name: entry.name.slice(0, -EXTENSION.length),
                    path: relativePath(root, full),
                    mtime,
                });
                parent.count++;
                return;
            }
            const child = { name: entry.name, path: relativePath(root, full), folders: [], notes: [], count: 0 };
            parent.folders.push(child);
            byPath.set(full, child);
        });
        sortByName(allNotes);
        return allNotes;
    });

    handle('list', async (folderPath) => {
        const { root, full: directory } = await resolveFolder(folderPath);
        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        const notes = [];
        for (const entry of entries) {
            if (!entry.isFile() || !isNote(entry.name)) continue;
            const full = path.join(directory, entry.name);
            const name = entry.name.slice(0, -EXTENSION.length);
            try {
                const stats = await fs.promises.stat(full);
                const head = await headOf(full);
                notes.push({
                    name,
                    path: relativePath(root, full),
                    mtime: stats.mtimeMs,
                    birth: stats.birthtimeMs,
                    preview: previewOf(head.startsWith(BOM) ? head.slice(1) : head, name),
                });
            } catch {
                // Gone between readdir and stat.
            }
        }
        return notes;
    });

    handle('read', async (notePath) => readText((await resolveNote(notePath)).full));

    // Written in place so the file keeps its creation date, Finder tags and links. A write cut off halfway would leave
    // the note truncated, so the old version is first copied beside it and flushed, and removed once the new text is
    // down. A backup already there is the last whole version from a failed save and is never overwritten.
    handle('write', async (notePath, text, base, { bom = false, eol = '\n' } = {}) => {
        const { full, root } = await resolveNote(notePath);
        const stats = await fs.promises.stat(full).catch(() => null);
        if (base != null) {
            if (!stats) throw files.refuse('GONE', 'the note is no longer there');
            if (Math.abs(stats.mtimeMs - base) > 1)
                throw files.refuse('CHANGED', 'the note was changed somewhere else');
        }
        let out = String(text);
        if (eol === '\r\n') out = out.replace(/\r?\n/g, '\r\n');
        if (bom) out = BOM + out;
        // Opened first, so a locked or read-only note fails with nothing touched.
        const file = await fs.promises.open(full, stats ? 'r+' : 'wx');
        try {
            const backup = stats && backupOf(full, stats.ino);
            if (backup && !(await exists(backup))) await keepBackup(full, backup);
            try {
                await putInPlace(file, Buffer.from(out, 'utf8'));
            } catch (error) {
                // TORN only when a backup exists to go back to. A file this write made (wx) is removed.
                if (backup) throw files.refuse('TORN', `saving stopped partway (${error.code || error.message})`);
                if (!stats) await fs.promises.unlink(full).catch(() => {});
                throw error;
            }
            if (backup) await fs.promises.unlink(backup).catch(() => {});
        } finally {
            await file.close().catch(() => {});
        }
        return { mtime: await noteWritten(root, full) };
    });

    handle('restore', async (notePath) => {
        const { full, root } = await resolveNote(notePath);
        const stats = await fs.promises.stat(full).catch(() => null);
        const backup = stats && backupOf(full, stats.ino);
        if (!backup || !(await exists(backup)))
            throw files.refuse('GONE', 'there is no earlier version kept for this note');
        const file = await fs.promises.open(full, 'r+');
        try {
            await putInPlace(file, await fs.promises.readFile(backup));
        } catch (error) {
            throw files.refuse('TORN', `restoring stopped partway (${error.code || error.message})`);
        } finally {
            await file.close().catch(() => {});
        }
        await fs.promises.unlink(backup).catch(() => {});
        return { mtime: await noteWritten(root, full) };
    });

    handle('create', async (folderPath) => {
        const { root, full: directory } = await resolveFolder(folderPath);
        const full = await files.fresh(
            directory,
            'Untitled',
            (candidate) => fs.promises.writeFile(candidate, '', { encoding: 'utf8', flag: 'wx' }),
            EXTENSION
        );
        const mtime = await noteWritten(root, full);
        return { path: relativePath(root, full), name: path.basename(full, EXTENSION), mtime };
    });

    handle('mkdir', async (parentPath, name) => {
        const { root, full: directory } = await resolveFolder(parentPath);
        const full = await files.fresh(directory, name ? cleanName(name) : 'New Folder', (candidate) =>
            fs.promises.mkdir(candidate)
        );
        return { path: relativePath(root, full), name: path.basename(full) };
    });

    handle('rename', async (entryPath, name) => {
        const { root, full: from, isFolder } = await resolveEntry(entryPath);
        const to = await files.rename(from, cleanName(name) + (isFolder ? '' : EXTENSION));
        if (!isFolder && to !== from) await carryBackup(from, to);
        return { path: relativePath(root, to) };
    });

    handle('move', async (entryPath, folderPath) => {
        const { root, full: from, isFolder } = await resolveEntry(entryPath);
        const { full: directory } = await resolveFolder(folderPath);
        const to = await files.move(from, directory);
        if (!isFolder && to !== from) await carryBackup(from, to);
        return { path: relativePath(root, to) };
    });

    // Only an empty note: one made and left without a word.
    handle('discard', async (notePath) => {
        const { full } = await resolveNote(notePath);
        const stats = await fs.promises.stat(full).catch(() => null);
        if (!stats || !stats.isFile() || stats.size > 0) return false;
        await fs.promises.unlink(full);
        return true;
    });

    handle('trash', async (entryPath) => {
        const { full, isFolder } = await resolveEntry(entryPath);
        const stats = isFolder ? null : await fs.promises.stat(full).catch(() => null);
        await files.trash(full);
        if (stats && (await exists(backupOf(full, stats.ino))))
            await files.trash(backupOf(full, stats.ino)).catch(() => {});
        return true;
    });

    handle('search', async (query) => {
        const root = await notesRoot();
        const words = String(query ?? '')
            .toLowerCase()
            .split(/\s+/)
            .filter(Boolean);
        if (!words.length) return { hits: [], partial: false };
        const hits = [];
        let seen = 0;
        let partial = false;
        await walk(root, 0, async (full, entry, kind) => {
            if (kind !== 'note') return;
            if (++seen > SEARCH_LIMIT) {
                partial = true;
                return 'stop';
            }
            const name = entry.name.slice(0, -EXTENSION.length);
            let read;
            try {
                read = await readText(full);
            } catch {
                return;
            }
            const lowerName = name.toLowerCase();
            const lowerText = read.text.toLowerCase();
            if (!words.every((word) => lowerName.includes(word) || lowerText.includes(word))) return;
            const flat = read.text.replace(/\s+/g, ' ');
            const at = Math.min(
                ...words.map((word) => flat.toLowerCase().indexOf(word)).filter((index) => index >= 0),
                Infinity
            );
            const snippet =
                !Number.isFinite(at) || at < 40 ? previewOf(read.text, name) : '…' + flat.slice(at - 30, at + 130);
            hits.push({
                path: relativePath(root, full),
                name,
                mtime: read.mtime,
                inName: words.every((word) => lowerName.includes(word)),
                snippet,
            });
        });
        hits.sort((one, other) => other.inName - one.inName || other.mtime - one.mtime);
        return { hits: hits.slice(0, HITS_LIMIT), partial: partial || hits.length > HITS_LIMIT };
    });

    // Asked as a state, on or off, so a page reloaded without turning it off leaves no second watcher.
    handle('watch', async (on) => {
        const request = ++watchRequests;
        stopWatching();
        if (!on) return false;
        const root = await notesRoot();
        if (request !== watchRequests) return false;
        stopWatching();
        try {
            watcher = fs.watch(root, { recursive: true }, (event, file) => {
                const changedPath = String(file || '')
                    .split(path.sep)
                    .join('/');
                if (!changedPath || changedPath.split('/').some((part) => !isVisible(part))) return;
                pending.add(changedPath);
                clearTimeout(flushTimer);
                flushTimer = setTimeout(() => {
                    reportChanges().catch(() => {});
                }, 250);
            });
            watcher.on('error', () => {
                watcher?.close();
                watcher = null;
            });
        } catch {
            watcher = null;
        }
        return !!watcher;
    });

    // Made again on every call: the folder may be deleted in Finder while the app runs.
    async function notesRoot() {
        await fs.promises.mkdir(ROOT, { recursive: true });
        if (!realRoot) realRoot = await fs.promises.realpath(ROOT);
        return realRoot;
    }

    function relativePath(root, full) {
        return path.relative(root, full).split(path.sep).join('/');
    }

    // A dot file belongs to the system or another app.
    function isVisible(name) {
        return !name.startsWith('.');
    }

    function isNote(name) {
        return isVisible(name) && name.toLowerCase().endsWith(EXTENSION);
    }

    // The nearest existing ancestor is resolved through links and must still be inside the root.
    async function locate(relative) {
        const root = await notesRoot();
        const text = String(relative ?? '');
        const parts = text.split('/').filter(Boolean);
        if (
            path.isAbsolute(text) ||
            text.includes('\\') ||
            parts.some((part) => part === '..' || part === '.' || !isVisible(part))
        ) {
            throw files.refuse('OUTSIDE', 'not a place in the notes folder: ' + text);
        }
        const full = path.join(root, ...parts);
        for (let probe = full; ; ) {
            const real = await fs.promises.realpath(probe).catch(() => null);
            if (real) {
                if (real !== root && !real.startsWith(root + path.sep))
                    throw files.refuse('OUTSIDE', 'a link out of the notes folder: ' + text);
                break;
            }
            const up = path.dirname(probe);
            if (up === probe) break;
            probe = up;
        }
        return { root, full };
    }

    async function resolveNote(notePath) {
        const place = await locate(notePath);
        if (place.full === place.root || !isNote(path.basename(place.full)))
            throw files.refuse('NOT_NOTE', 'not a note: ' + notePath);
        const stats = await fs.promises.stat(place.full).catch(() => null);
        if (stats && !stats.isFile()) throw files.refuse('NOT_NOTE', 'not a note: ' + notePath);
        return place;
    }

    async function resolveFolder(folderPath) {
        const place = await locate(folderPath);
        const stats = await fs.promises.stat(place.full).catch(() => null);
        if (!stats) throw files.refuse('GONE', 'no such folder: ' + folderPath);
        if (!stats.isDirectory()) throw files.refuse('NOT_FOLDER', 'not a folder: ' + folderPath);
        return place;
    }

    async function resolveEntry(entryPath) {
        const place = await locate(entryPath);
        if (place.full === place.root)
            throw files.refuse('OUTSIDE', 'the notes folder itself is not changed from here');
        const stats = await fs.promises.lstat(place.full).catch(() => null);
        if (!stats) throw files.refuse('GONE', 'no longer there: ' + entryPath);
        if (!stats.isDirectory() && !isNote(path.basename(place.full)))
            throw files.refuse('NOT_NOTE', 'not a note: ' + entryPath);
        return { ...place, isFolder: stats.isDirectory() };
    }

    function cleanName(raw) {
        const name = files.name(raw);
        if (!isVisible(name)) throw files.refuse('NAME', `"${name}" cannot be a name: it would be hidden`);
        return name;
    }

    async function exists(full) {
        try {
            await fs.promises.lstat(full);
            return true;
        } catch {
            return false;
        }
    }

    // Symbolic links are left alone: a Dirent reports a link as neither a folder nor a file.
    async function walk(directory, depth, visit) {
        let entries = [];
        try {
            entries = await fs.promises.readdir(directory, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (!isVisible(entry.name)) continue;
            const full = path.join(directory, entry.name);
            const kind =
                entry.isDirectory() && depth < DEPTH_LIMIT
                    ? 'folder'
                    : entry.isFile() && isNote(entry.name)
                      ? 'note'
                      : null;
            if (!kind) continue;
            const answer = await visit(full, entry, kind);
            if (answer === 'stop') return 'stop';
            if (kind === 'folder' && answer !== 'skip' && (await walk(full, depth + 1, visit)) === 'stop')
                return 'stop';
        }
    }

    function sortByName(folderNode) {
        const byName = (one, other) =>
            one.name.localeCompare(other.name, undefined, { numeric: true, sensitivity: 'base' });
        folderNode.folders.sort(byName);
        folderNode.notes.sort(byName);
        folderNode.folders.forEach(sortByName);
    }

    async function headOf(full) {
        const file = await fs.promises.open(full, 'r');
        try {
            const { buffer, bytesRead } = await file.read(Buffer.alloc(4096), 0, 4096, 0);
            return buffer.subarray(0, bytesRead).toString('utf8');
        } finally {
            await file.close();
        }
    }

    function previewOf(text, name) {
        // Fence and rule lines go before marks are stripped, or "```shell" would leave "shell".
        const lines = text
            .split(/\r?\n/)
            .filter((line) => !/^\s*(-{3,}|`{3,}.*|~{3,}.*)\s*$/.test(line))
            .map((line) =>
                line
                    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+)/, '')
                    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
                    .replace(/[*_~`]+/g, '')
                    .trim()
            )
            .filter((line) => line);
        if (lines.length && lines[0].toLowerCase() === name.toLowerCase()) lines.shift();
        return lines.join(' ').slice(0, 200);
    }

    // Named by inode as well as name: a note written in place keeps its inode, so the backup follows a rename here,
    // and one left by a rename elsewhere never attaches to a new note of that name.
    function backupOf(full, inode) {
        return path.join(path.dirname(full), `.${path.basename(full)}.${inode}.deckit-backup`);
    }

    async function keepBackup(full, backup) {
        try {
            const copy = await fs.promises.open(backup, 'w');
            try {
                await copy.writeFile(await fs.promises.readFile(full));
                await copy.sync();
            } finally {
                await copy.close();
            }
        } catch (error) {
            await fs.promises.unlink(backup).catch(() => {});
            throw files.refuse(
                'NO_ROOM',
                `the note was not changed: there is no room to keep its last version while saving (${error.code || error.message})`
            );
        }
    }

    // The backup is named after the note, so it moves with it or the note stops being torn.
    async function carryBackup(from, to) {
        const stats = await fs.promises.stat(to).catch(() => null);
        if (stats && (await exists(backupOf(from, stats.ino))))
            await fs.promises.rename(backupOf(from, stats.ino), backupOf(to, stats.ino));
    }

    // writeFile: on a full disk, write can return a short count without failing.
    async function putInPlace(file, bytes) {
        await file.truncate(0);
        await file.writeFile(bytes);
        await file.sync();
    }

    async function noteWritten(root, full) {
        const { mtimeMs } = await fs.promises.stat(full);
        written.set(relativePath(root, full), mtimeMs);
        return mtimeMs;
    }

    // The view edits "\n" text without a byte-order mark; both are put back on write. CRLF only when every break is
    // one, so mixed endings are written back as "\n". `torn`: a backup from a save that stopped partway exists. A torn
    // file may be cut inside a character, so it decodes leniently. ignoreBOM keeps the mark in the text to be found.
    async function readText(full) {
        let stats;
        try {
            stats = await fs.promises.stat(full);
        } catch (error) {
            if (error.code === 'ENOENT') throw files.refuse('GONE', 'the note is no longer there');
            throw error;
        }
        if (stats.size > READ_LIMIT) throw files.refuse('TOO_BIG', 'this note is larger than 5 MB');
        const torn = await exists(backupOf(full, stats.ino));
        const bytes = await fs.promises.readFile(full);
        let text;
        try {
            text = new TextDecoder('utf-8', { fatal: !torn, ignoreBOM: true }).decode(bytes);
        } catch {
            throw files.refuse('NOT_TEXT', 'this file is not UTF-8 text');
        }
        const bom = text.startsWith(BOM);
        if (bom) text = text.slice(1);
        const crlf = /\r\n/.test(text) && !/(^|[^\r])\n/.test(text) && !/\r(?!\n)/.test(text);
        return {
            text: text.replace(/\r\n?/g, '\n'),
            mtime: stats.mtimeMs,
            birth: stats.birthtimeMs,
            bom,
            eol: crlf ? '\r\n' : '\n',
            torn,
        };
    }

    // A path that is gone is reported: it may have been a note or a folder.
    async function reportChanges() {
        const root = await notesRoot();
        const changed = [];
        for (const changedPath of pending) {
            const stats = await fs.promises.stat(path.join(root, ...changedPath.split('/'))).catch(() => null);
            if (stats && !stats.isDirectory() && !isNote(path.basename(changedPath))) continue;
            const own = written.get(changedPath);
            if (stats && own != null && Math.abs(stats.mtimeMs - own) <= 1) continue;
            changed.push(changedPath);
        }
        pending = new Set();
        if (changed.length) send('changed', changed);
    }

    function stopWatching() {
        if (!watcher) return;
        watcher.close();
        watcher = null;
    }
};
