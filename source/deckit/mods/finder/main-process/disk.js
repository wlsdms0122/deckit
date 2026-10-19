// Every read is asynchronous: in the main process a synchronous walk of a huge folder or a slow network volume would
// freeze every window.
module.exports = ({ emit, window, files }) => {
    const fs = require('fs').promises;
    const { watch } = require('fs');
    const { execFile } = require('child_process');
    const os = require('os');
    const path = require('path');
    const { app, shell, nativeImage } = require('electron');
    const { imageSize } = require('./image-size.js');
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
    const CHANGE_SETTLE_DELAY = 250; // milliseconds
    const PRIVACY_SETTINGS = 'x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders';
    // Quick Look's server answers at once even for a kind it draws nothing for; this is for one that never answers.
    const QUICK_LOOK_LIMIT = 5000; // milliseconds
    const watched = new Map(); // folder -> { watcher, timer }
    const drawing = new Set(); // the Quick Look processes drawing a thumbnail

    return {
        async places() {
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
        },

        async list(given) {
            const folder = absolute(given);
            // macOS answers EPERM for a folder it has not given the host app, and a folder's own mode answers EACCES.
            const names = await fs.readdir(folder).catch((error) => {
                if (error.code === 'EACCES' || error.code === 'EPERM')
                    throw files.refuse('NOT_PERMITTED', error.message);
                throw error;
            });
            const entries = await Promise.all(
                names.filter((name) => name !== '.DS_Store').map((name) => describe(folder, name))
            );
            return entries.filter(Boolean);
        },

        mkdir: (folder) => files.fresh(absolute(folder), 'untitled folder', (made) => fs.mkdir(made)),
        rename: (file, name) => files.rename(absolute(file), name),
        move: (file, folder) => files.move(absolute(file), absolute(folder)),
        async trash(file) {
            await files.trash(absolute(file));
            return true;
        },

        async exists(file) {
            try {
                return (await fs.stat(absolute(file))).isDirectory() ? 'folder' : 'file';
            } catch {
                return null;
            }
        },

        // Every key is answered, null when the system has no icon, so the view stops asking. Scale 2 sends the 64 pixel
        // drawing, sharp at the preview's 32 points as well as a row's 16.
        async icons(wanted) {
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
        },

        // Electron draws the thumbnail into the box asked, whatever the file's shape, so it is asked for a picture
        // in the shape its header tells. Anything else Quick Look draws in its own shape, at most `size` on a side,
        // and a kind it draws nothing for is the kind's icon, which is square.
        async thumbnail(file, size) {
            const side = Math.max(16, Math.min(1024, Math.round(Number(size) || 0)));
            const shape = await imageSize(absolute(file)).catch(() => null);
            if (!shape?.width || !shape.height)
                return (
                    (await quickLookThumbnail(absolute(file), side)) ??
                    electronThumbnail(absolute(file), { width: side, height: side })
                );
            const scale = side / Math.max(shape.width, shape.height);
            return electronThumbnail(absolute(file), {
                width: Math.max(1, Math.round(shape.width * scale)),
                height: Math.max(1, Math.round(shape.height * scale)),
            });
        },

        // The whole set is replaced.
        watch(folders) {
            const wanted = new Set(
                []
                    .concat(folders || [])
                    .filter((folder) => typeof folder === 'string' && folder)
                    .map(absolute)
            );
            for (const folder of [...watched.keys()]) if (!wanted.has(folder)) stopWatching(folder);
            for (const folder of wanted) if (!watched.has(folder)) startWatching(folder);
            return [...watched.keys()];
        },

        // A fixed system address: the sandbox names nothing to open.
        async privacySettings() {
            await shell.openExternal(PRIVACY_SETTINGS);
            return true;
        },

        quickLook(file, name) {
            const showing = window.ofPage();
            if (!showing) return false;
            showing.previewFile(absolute(file), name || path.basename(file));
            return true;
        },
        closeQuickLook() {
            window.ofPage()?.closeFilePreview();
            return true;
        },

        // As the run that started it ends: its watchers, the thumbnails being drawn, and a preview it showed.
        dispose() {
            for (const folder of [...watched.keys()]) stopWatching(folder);
            for (const child of drawing) child.kill();
            window.ofPage()?.closeFilePreview();
        },
    };

    function absolute(given) {
        const file = String(given || '');
        if (!path.isAbsolute(file)) throw new Error('not an absolute path: ' + file);
        return file;
    }

    // A data URL, or null when Electron drew none.
    async function electronThumbnail(file, box) {
        try {
            const image = await nativeImage.createThumbnailFromPath(file, box);
            return image.isEmpty() ? null : image.toDataURL();
        } catch {
            return null;
        }
    }

    // A data URL, or null when Quick Look drew none. It writes `<name>.png` into the folder it is given.
    async function quickLookThumbnail(file, side) {
        const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'finder-thumbnail-'));
        try {
            await new Promise((resolve, reject) => {
                const child = execFile(
                    'qlmanage',
                    ['-t', '-x', '-s', String(side), '-o', folder, file],
                    { timeout: QUICK_LOOK_LIMIT },
                    (error) => {
                        drawing.delete(child);
                        if (error) reject(error);
                        else resolve();
                    }
                );
                drawing.add(child);
            });
            const drawn = await fs.readFile(path.join(folder, path.basename(file) + '.png'));
            return 'data:image/png;base64,' + drawn.toString('base64');
        } catch {
            return null;
        } finally {
            await fs.rm(folder, { recursive: true, force: true });
        }
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
            extension,
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
                entry.timer = setTimeout(() => emit('changed', folder), CHANGE_SETTLE_DELAY);
            });
            entry.watcher.on('error', () => {
                entry.watcher?.close();
                entry.watcher = null;
                if (watched.get(folder) === entry) {
                    watched.delete(folder);
                    emit('unwatched', folder);
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
