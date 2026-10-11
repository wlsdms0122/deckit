module.exports = ({ handle, send, files }) => {
    const fs = require('fs');
    const fsp = fs.promises;
    const os = require('os');
    const path = require('path');
    const { app, shell, nativeImage, BrowserWindow } = require('electron');
    // Every read is asynchronous: in the main process a synchronous walk of a huge folder or a slow
    // network volume would freeze every window.

    const absolute = (p) => {
        const s = String(p || '');
        if (!path.isAbsolute(s)) throw new Error('not an absolute path: ' + s);
        return s;
    };
    const isFolder = async (p) => {
        try {
            return (await fsp.stat(p)).isDirectory();
        } catch {
            return false;
        }
    };

    handle('places', async () => {
        const home = os.homedir();
        const places = [
            { id: 'home', label: path.basename(home), path: home },
            { id: 'desktop', label: 'Desktop', path: path.join(home, 'Desktop') },
            { id: 'documents', label: 'Documents', path: path.join(home, 'Documents') },
            { id: 'downloads', label: 'Downloads', path: path.join(home, 'Downloads') },
            { id: 'applications', label: 'Applications', path: '/Applications' },
        ];
        const there = await Promise.all(places.map((p) => isFolder(p.path)));
        return { home, places: places.filter((_, i) => there[i]) };
    });

    // Folders macOS treats as a file: shown as one item and opened, not walked into.
    const PACKAGES = new Set([
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
    const extOf = (name) => {
        const i = name.lastIndexOf('.');
        return i > 0 ? name.slice(i + 1).toLowerCase() : '';
    };

    const describe = async (at, name) => {
        const full = path.join(at, name);
        let st,
            link = false,
            dead = false;
        try {
            st = await fsp.lstat(full);
        } catch {
            return null;
        }
        if (st.isSymbolicLink()) {
            link = true;
            try {
                st = await fsp.stat(full);
            } catch {
                dead = true;
            }
        }
        const ext = extOf(name);
        const directory = !dead && st.isDirectory();
        return {
            name,
            path: full,
            ext,
            link,
            kind: !directory ? 'file' : PACKAGES.has(ext) ? 'package' : 'folder',
            // A dangling link's lstat size is the length of its target path, not worth showing.
            size: directory || dead ? null : st.size,
            mtime: st.mtimeMs,
            hidden: name.startsWith('.'),
        };
    };
    handle('list', async (dir) => {
        const at = absolute(dir);
        // macOS answers EPERM for a folder it has not given the app, and a folder's own mode answers EACCES.
        const names = await fsp.readdir(at).catch((error) => {
            if (error.code === 'EACCES' || error.code === 'EPERM') throw files.refuse('NOT_PERMITTED', error.message);
            throw error;
        });
        return (await Promise.all(names.filter((n) => n !== '.DS_Store').map((n) => describe(at, n)))).filter(Boolean);
    });

    handle('mkdir', (dir) => files.fresh(absolute(dir), 'untitled folder', (full) => fsp.mkdir(full)));
    handle('rename', (p, name) => files.rename(absolute(p), name));
    handle('move', (p, dir) => files.move(absolute(p), absolute(dir)));
    handle('trash', async (p) => {
        await files.trash(absolute(p));
        return true;
    });

    handle('exists', async (p) => {
        try {
            return (await fsp.stat(absolute(p))).isDirectory() ? 'folder' : 'file';
        } catch {
            return null;
        }
    });

    // Every key is answered, null when the system has no icon, so the view stops asking. Scale 2
    // sends the 64 pixel drawing, sharp at the preview's 32 points as well as a row's 16.
    handle('icons', async (wanted) => {
        const out = {};
        await Promise.all(
            Object.entries(wanted || {}).map(async ([key, p]) => {
                try {
                    out[key] = (await app.getFileIcon(absolute(p), { size: 'normal' })).toDataURL({ scaleFactor: 2 });
                } catch {
                    out[key] = null;
                }
            })
        );
        return out;
    });

    handle('thumbnail', async (p, size) => {
        const side = Math.max(16, Math.min(1024, Math.round(Number(size) || 0)));
        try {
            const image = await nativeImage.createThumbnailFromPath(absolute(p), { width: side, height: side });
            return image.isEmpty() ? null : image.toDataURL();
        } catch {
            return null;
        }
    });

    // watch(dirs) replaces the whole set rather than adding to it: this half outlives the page
    // (it stays loaded across a panel reload), and a reloaded page never unwatches the old one's.
    const watched = new Map(); // dir -> { watcher, timer }
    const stopWatching = (at) => {
        const entry = watched.get(at);
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.watcher?.close();
        watched.delete(at);
    };
    const startWatching = (at) => {
        const entry = { watcher: null, timer: null };
        try {
            entry.watcher = fs.watch(at, () => {
                clearTimeout(entry.timer);
                entry.timer = setTimeout(() => send('changed', at), 250);
            });
            entry.watcher.on('error', () => {
                entry.watcher?.close();
                entry.watcher = null;
                if (watched.get(at) === entry) {
                    watched.delete(at);
                    send('unwatched', at);
                }
            });
        } catch {}
        if (entry.watcher) watched.set(at, entry);
    };
    handle('watch', (dirs) => {
        const want = new Set(
            []
                .concat(dirs || [])
                .filter((d) => typeof d === 'string' && d)
                .map(absolute)
        );
        for (const at of [...watched.keys()]) if (!want.has(at)) stopWatching(at);
        for (const at of want) if (!watched.has(at)) startWatching(at);
        return [...watched.keys()];
    });

    // A fixed system address, never one a page supplies.
    handle('privacySettings', async () => {
        await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders');
        return true;
    });

    handle('quickLook', (p, name) => {
        const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
        if (!win) return false;
        win.previewFile(absolute(p), name || path.basename(p));
        return true;
    });
    handle('closeQuickLook', () => {
        for (const w of BrowserWindow.getAllWindows()) w.closeFilePreview();
        return true;
    });
};
