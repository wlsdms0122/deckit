const { parentOf } = require('./path.js');

// What `disk` listed of each folder on screen, read again when it says a folder changed. No listing means the folder
// is loading; an earlier one stays while it is read again. `isShown(folder)` says whether a listing is still wanted;
// `onRead(folder)` hears one kept.
function listingCache({ about, disk, isShown, onRead }) {
    const listings = new Map(); // folder -> { entries, failure }
    const reads = new Map(); // folder -> { again, done }
    let watched; // the folders last sent to `disk`, as JSON; undefined lets the next set through

    disk.on('changed', (folder) => {
        if (isShown(folder)) load(folder);
    });
    disk.on('unwatched', (folder) => {
        watched = undefined;
        if (isShown(folder)) load(folder);
    });

    return { of, has, entryAt, load, request, keepOnly, relocate, watch };

    function of(folder) {
        return listings.get(folder) || null;
    }

    function has(folder) {
        return listings.has(folder);
    }

    function entryAt(path) {
        if (!path) return null;
        return of(parentOf(path))?.entries.find((entry) => entry.path === path) || null;
    }

    // A read asked for during another is not answered by it (the folder may have changed since): the folder is read
    // again when it ends, so what comes back is no older than the asking.
    function load(folder) {
        const running = reads.get(folder);
        if (running) {
            running.again = true;
            return running.done;
        }
        const read = { again: false, done: null };
        read.done = (async () => {
            do {
                read.again = false;
                const listing = await readFolder(folder);
                if (isShown(folder)) {
                    listings.set(folder, listing);
                    onRead(folder);
                }
            } while (read.again);
            reads.delete(folder);
        })();
        reads.set(folder, read);
        return read.done;
    }

    // Loads a folder that has no listing and is not being read.
    function request(folder) {
        if (!listings.has(folder) && !reads.has(folder)) load(folder);
    }

    function keepOnly(folders) {
        for (const folder of listings.keys()) if (!folders.has(folder)) listings.delete(folder);
    }

    // Applied at once, before the folders are read again, so a draw in between (the rename field letting go) finds the
    // new name and keeps the selection. An entry moved into another folder joins that folder's listing.
    function relocate(follow) {
        const movedAway = [];
        for (const [folder, listing] of [...listings]) {
            listings.delete(folder);
            const to = follow(folder);
            if (!to) continue;
            const entries = [];
            for (const entry of listing.entries) {
                const path = follow(entry.path);
                if (!path) continue;
                const moved = {
                    ...entry,
                    path,
                    name: path === entry.path ? entry.name : path.slice(path.lastIndexOf('/') + 1),
                };
                if (parentOf(path) === to) entries.push(moved);
                else movedAway.push(moved);
            }
            listings.set(to, { ...listing, entries });
        }
        for (const entry of movedAway) {
            const listing = listings.get(parentOf(entry.path));
            if (listing && !listing.entries.some((other) => other.path === entry.path))
                listings.set(parentOf(entry.path), { ...listing, entries: [...listing.entries, entry] });
        }
    }

    // `disk` replaces its whole set with `folders`, or stops with null. `renew` asks again for the same set, renewing a
    // watch that died. A set it could not fully watch is forgotten, so the next call asks again.
    function watch(folders, { renew = false } = {}) {
        const key = JSON.stringify(folders || []);
        if (renew) watched = undefined;
        if (key === watched) return;
        watched = key;
        const forget = () => {
            if (watched === key) watched = undefined;
        };
        disk.watch(folders).then((watching) => {
            if (watching.length !== (folders || []).length) forget();
        }, forget);
    }

    async function readFolder(folder) {
        try {
            return { entries: await disk.list(folder), failure: null };
        } catch (error) {
            return { entries: [], failure: readFailureOf(error) };
        }
    }

    function readFailureOf(error) {
        if (error.kind === 'NOT_PERMITTED')
            return {
                title: about().name + ' cannot read this folder',
                hint: 'macOS gives an app a folder in System Settings › Privacy & Security › Files and Folders.',
                permission: true,
            };
        return { title: 'Could not read this folder', hint: error.message, permission: false };
    }
}

module.exports = { listingCache };
