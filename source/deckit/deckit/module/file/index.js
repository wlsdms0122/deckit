DeckitModule.define(
    'deckit/module/file',
    {
        uses: [],
        provides: ['name', 'fresh', 'rename', 'move', 'trash'],
        runs: 'main',
    },
    () => {
        const fsp = require('fs').promises;
        const path = require('path');
        const { shell } = require('electron');
        // The kind leads the message: only the message crosses to the view, which reads it back as `kind`.
        const fail = (kind, message) => new Error(kind + ': ' + message);

        // The colon is Finder's spelling of a slash, so it is refused with the slash.
        const name = (raw) => {
            const n = String(raw ?? '')
                .replace(/[\u0000-\u001f]/g, '')
                .trim();
            if (!n || n === '.' || n === '..' || /[/:]/.test(n))
                throw fail('NAME', `"${n}" cannot be a name: no / or :`);
            return n;
        };

        /* `make(full)` must refuse what is already there (a file opened "wx", a mkdir), so two made at
     once never share a name. */
        const fresh = async (dir, base, make, ext = '') => {
            for (let n = 1; n < 10000; n++) {
                const full = path.join(dir, (n === 1 ? base : `${base} ${n}`) + ext);
                try {
                    await make(full);
                    return full;
                } catch (e) {
                    if (e.code !== 'EEXIST') throw e;
                }
            }
            throw fail('NAME', 'no free name for ' + base);
        };

        /* Another entry is told by device and inode, not by spelling: on a case-insensitive disk "readme"
     found for "README" is the same file being renamed. */
        const put = async (from, to) => {
            if (to === from) return to;
            const self = await fsp.lstat(from).catch(() => null);
            if (!self) throw fail('GONE', 'it is no longer there');
            const there = await fsp.lstat(to).catch(() => null);
            if (there && (there.dev !== self.dev || there.ino !== self.ino))
                throw fail('EXISTS', `"${path.basename(to)}" is already there`);
            await fsp.rename(from, to);
            return to;
        };
        const rename = (from, newName) => put(from, path.join(path.dirname(from), name(newName)));
        /* Into-itself is checked on real paths: a link to a folder inside it is still inside it. Another
     disk is detected by the rename's EXDEV, not by comparing devices beforehand: macOS's system
     and data volumes report one device. */
        const move = async (from, dir) => {
            const self = await fsp.lstat(from).catch(() => null);
            if (!self) throw fail('GONE', 'it is no longer there');
            const into = await fsp.realpath(dir).catch(() => null);
            if (!into) throw fail('GONE', 'the folder is no longer there');
            const here = self.isSymbolicLink() ? from : await fsp.realpath(from);
            if (into === here || into.startsWith(here + path.sep))
                throw fail('INTO_ITSELF', 'a folder cannot go inside itself');
            try {
                return await put(from, path.join(dir, path.basename(from)));
            } catch (e) {
                if (e.code === 'EXDEV')
                    throw fail(
                        'OTHER_DISK',
                        `"${path.basename(from)}" is on another disk than that folder; copy it there with Finder`
                    );
                throw e;
            }
        };

        const trash = (full) => shell.trashItem(full);

        return Object.freeze({ name, fresh, rename, move, trash });
    }
);
