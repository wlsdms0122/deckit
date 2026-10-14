const { entryOf } = require('./entry.js');

// Notes and folders are dragged from the sidebar and the gallery into folders: rows, cards and crumbs. What is dragged
// carries its path as read, with the relocation count it was read at.
function dragAndDrop({ ui, relocations, onMove }) {
    const KIND = 'note';

    return { describe, acceptDrops };

    function describe(item) {
        const { kind, path, since } = entryOf(item);
        return {
            kind: KIND,
            payload: { path, since },
            text: item.querySelector('[data-name]').textContent,
            icon: kind === 'note' ? 'fileText' : ui.folderIcon({ open: false, size: 14 }),
        };
    }

    // `folderUnder(element)` is where a drop on it goes ({ folder, mark, since }), or null.
    function acceptDrops(zone, folderUnder) {
        ui.folderDrop(zone, {
            kind: KIND,
            paths: (payload) => [payload.path],
            folderAt: folderUnder,
            onDrop: (payload, target) =>
                onMove(
                    payload.path,
                    target.folder,
                    payload.since,
                    target.since ?? (target.row ? entryOf(target.row.element).since : relocations.since())
                ),
        });
    }
}

module.exports = { dragAndDrop };
