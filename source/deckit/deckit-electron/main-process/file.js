// MARK: - Property
const fs = require('fs').promises;
const path = require('path');
const { shell } = require('electron');

// MARK: - Initializer
// MARK: - Public
// A refusal a person can act on. `kind` reaches the page beside the message (deck/ipc).
function refuse(kind, message) {
    return Object.assign(new Error(message), { kind });
}

// The colon is Finder's spelling of a slash, so it is refused with the slash.
function name(raw) {
    const written = String(raw ?? '')
        .replace(/[\u0000-\u001f]/g, '')
        .trim();
    if (!written || written === '.' || written === '..' || /[/:]/.test(written)) {
        throw refuse('NAME', `"${written}" cannot be a name: no / or :`);
    }
    return written;
}

// `make(file)` refuses what is already there (a file opened "wx", a mkdir), so two made at once never
// share a name.
async function fresh(folder, base, make, extension = '') {
    for (let count = 1; count < 10000; count++) {
        const file = path.join(folder, (count === 1 ? base : `${base} ${count}`) + extension);
        try {
            await make(file);
            return file;
        } catch (error) {
            if (error.code !== 'EEXIST') throw error;
        }
    }
    throw refuse('NAME', 'no free name for ' + base);
}

function rename(from, newName) {
    return put(from, path.join(path.dirname(from), name(newName)));
}

// Into-itself is judged on real paths: a link to a folder inside it is still inside it. Another disk
// shows as the rename's EXDEV: macOS's system and data volumes report one device.
async function move(from, folder) {
    const self = await fs.lstat(from).catch(() => null);
    if (!self) throw refuse('GONE', 'it is no longer there');
    const into = await fs.realpath(folder).catch(() => null);
    if (!into) throw refuse('GONE', 'the folder is no longer there');
    const here = self.isSymbolicLink() ? from : await fs.realpath(from);
    if (into === here || into.startsWith(here + path.sep)) {
        throw refuse('INTO_ITSELF', 'a folder cannot go inside itself');
    }
    try {
        return await put(from, path.join(folder, path.basename(from)));
    } catch (error) {
        if (error.code !== 'EXDEV') throw error;
        throw refuse(
            'OTHER_DISK',
            `"${path.basename(from)}" is on another disk than that folder; copy it there with Finder`
        );
    }
}

function trash(file) {
    return shell.trashItem(file);
}

// MARK: - Private
// Another entry is told by device and inode, not by spelling: on a disk that ignores case, "readme"
// found for "README" is the file being renamed.
async function put(from, to) {
    if (to === from) return to;
    const self = await fs.lstat(from).catch(() => null);
    if (!self) throw refuse('GONE', 'it is no longer there');
    const there = await fs.lstat(to).catch(() => null);
    if (there && (there.dev !== self.dev || there.ino !== self.ino)) {
        throw refuse('EXISTS', `"${path.basename(to)}" is already there`);
    }
    await fs.rename(from, to);
    return to;
}

export { refuse, name, fresh, rename, move, trash };
