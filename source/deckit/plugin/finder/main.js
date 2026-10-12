// Every read is asynchronous: in the main process a synchronous walk of a huge folder or a slow network volume would
// freeze every window.
module.exports = ({ handle, send, files }) => {
    const fs = require('fs').promises;
    const { watch } = require('fs');
    const os = require('os');
    const path = require('path');
    const { app, shell, nativeImage, BrowserWindow } = require('electron');
    // macOS shows a folder with one of these extensions as one item, opened and not walked into.
    const PACKAGE_EXTENSIONS = new Set([
        'app',
        'xcodeproj',
        'xcworkspace',
        'playground',
        'pages',
        'numbers',
        'key',
        'rtfd',
        'photoslibrary',
        'bundle',
        'prefpane',
        'plugin',
        'kext',
        'qlgenerator',
        'mdimporter',
    ]);
    const CHANGE_SETTLE_MS = 250;
    const PRIVACY_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders';
    const watched = new Map(); // folder -> { watcher, timer }

    handle('places', async () => {
        const home = os.homedir();
        const places = [
            { id: 'home', label: path.basename(home), path: home },
            { id: 'desktop', label: 'Desktop', path: path.join(home, 'Desktop') },
            { id: 'documents', label: 'Documents', path: path.join(home, 'Documents') },
            { id: 'downloads', label: 'Downloads', path: path.join(home, 'Downloads') },
            { id: 'applications', label: 'Applications', path: '/Applications' },
        ];
        const present = await Promise.all(places.map((place) => isFolder(place.path)));
        return { home, places: places.filter((place, index) => present[index]) };
    });

    handle('list', async (given) => {
        const folder = absolute(given);
        // macOS answers EPERM for a folder it has not given the app, and a folder's own mode answers EACCES.
        const names = await fs.readdir(folder).catch((error) => {
            if (error.code === 'EACCES' || error.code === 'EPERM') throw files.refuse('NOT_PERMITTED', error.message);
            throw error;
        });
        const entries = await Promise.all(
            names.filter((name) => name !== '.DS_Store').map((name) => describe(folder, name))
        );
        return entries.filter(Boolean);
    });

    handle('mkdir', (folder) => files.fresh(absolute(folder), 'untitled folder', (made) => fs.mkdir(made)));
    handle('rename', (file, name) => files.rename(absolute(file), name));
    handle('move', (file, folder) => files.move(absolute(file), absolute(folder)));
    handle('trash', async (file) => {
        await files.trash(absolute(file));
        return true;
    });

    handle('exists', async (file) => {
        try {
            return (await fs.stat(absolute(file))).isDirectory() ? 'folder' : 'file';
        } catch {
            return null;
        }
    });

    // Every key is answered, null when the system has no icon, so the view stops asking. Scale 2 sends the 64 pixel
    // drawing, sharp at the preview's 32 points as well as a row's 16.
    handle('icons', async (wanted) => {
        const answer = {};
        await Promise.all(
            Object.entries(wanted || {}).map(async ([key, file]) => {
                try {
                    const icon = await app.getFileIcon(absolute(file), { size: 'normal' });
                    answer[key] = icon.toDataURL({ scaleFactor: 2 });
                } catch {
                    answer[key] = null;
                }
            })
        );
        return answer;
    });

    handle('thumbnail', async (file, size) => {
        const side = Math.max(16, Math.min(1024, Math.round(Number(size) || 0)));
        try {
            const image = await nativeImage.createThumbnailFromPath(absolute(file), { width: side, height: side });
            return image.isEmpty() ? null : image.toDataURL();
        } catch {
            return null;
        }
    });

    // The whole set is replaced: this half stays loaded across a panel reload, and a reloaded page never unwatches
    // the folders the page before it watched.
    handle('watch', (folders) => {
        const wanted = new Set(
            []
                .concat(folders || [])
                .filter((folder) => typeof folder === 'string' && folder)
                .map(absolute)
        );
        for (const folder of [...watched.keys()]) if (!wanted.has(folder)) stopWatching(folder);
        for (const folder of wanted) if (!watched.has(folder)) startWatching(folder);
        return [...watched.keys()];
    });

    // A fixed system address: the page names nothing to open.
    handle('privacySettings', async () => {
        await shell.openExternal(PRIVACY_SETTINGS);
        return true;
    });

    handle('quickLook', (file, name) => {
        const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!window) return false;
        window.previewFile(absolute(file), name || path.basename(file));
        return true;
    });
    handle('closeQuickLook', () => {
        for (const window of BrowserWindow.getAllWindows()) window.closeFilePreview();
        return true;
    });

    function absolute(given) {
        const file = String(given || '');
        if (!path.isAbsolute(file)) throw new Error('not an absolute path: ' + file);
        return file;
    }

    async function isFolder(file) {
        try {
            return (await fs.stat(file)).isDirectory();
        } catch {
            return false;
        }
    }

    async function describe(folder, name) {
        const file = path.join(folder, name);
        let stats;
        let link = false;
        let dangling = false;
        try {
            stats = await fs.lstat(file);
        } catch {
            return null;
        }
        if (stats.isSymbolicLink()) {
            link = true;
            try {
                stats = await fs.stat(file);
            } catch {
                dangling = true;
            }
        }
        const extension = extensionOf(name);
        const directory = !dangling && stats.isDirectory();
        return {
            name,
            path: file,
            ext: extension,
            link,
            kind: !directory ? 'file' : PACKAGE_EXTENSIONS.has(extension) ? 'package' : 'folder',
            // A dangling link's lstat size is the length of its target path.
            size: directory || dangling ? null : stats.size,
            mtime: stats.mtimeMs,
            hidden: name.startsWith('.'),
        };
    }

    function extensionOf(name) {
        const dot = name.lastIndexOf('.');
        return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
    }

    function startWatching(folder) {
        const entry = { watcher: null, timer: null };
        try {
            entry.watcher = watch(folder, () => {
                clearTimeout(entry.timer);
                entry.timer = setTimeout(() => send('changed', folder), CHANGE_SETTLE_MS);
            });
            entry.watcher.on('error', () => {
                entry.watcher?.close();
                entry.watcher = null;
                if (watched.get(folder) === entry) {
                    watched.delete(folder);
                    send('unwatched', folder);
                }
            });
        } catch {}
        if (entry.watcher) watched.set(folder, entry);
    }

    function stopWatching(folder) {
        const entry = watched.get(folder);
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.watcher?.close();
        watched.delete(folder);
    }
};
