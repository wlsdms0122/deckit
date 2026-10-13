// The folders opened lately, the latest first, kept in the records. A folder is in the list once: two can move onto
// one path when a folder is renamed to the name of one deleted since.
function recentFolders({ records, isOpen }) {
    const KEPT = 10;

    return { list, unopened, add, follow };

    function list() {
        return records.get('recent-folders', []);
    }

    function unopened() {
        return list().filter((path) => !isOpen(path));
    }

    function add(path) {
        records.set('recent-folders', [path, ...list().filter((other) => other !== path)].slice(0, KEPT));
    }

    function follow(move) {
        const folders = list();
        if (folders.some((path) => move(path) !== path))
            records.set('recent-folders', [...new Set(folders.map(move).filter(Boolean))]);
    }
}

module.exports = { recentFolders };
