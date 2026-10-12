// Notes and folders are dragged from the sidebar and the gallery into folders: rows, cards and crumbs. What is dragged
// carries its path as read, with the relocation count it was read at.
function dragAndDrop({ ui, relocations, onMove }) {
    const KIND = 'note';

    return { describe, acceptDrops };

    function describe(item) {
        return {
            kind: KIND,
            payload: { path: item.dataset.note || item.dataset.folder, since: Number(item.dataset.seq) },
            text: item.querySelector('[data-name]').textContent,
            icon: item.dataset.note ? 'fileText' : ui.folderIcon({ open: false, size: 14 }),
        };
    }

    // `folderUnder(element)` is where a drop on it goes ({ folder, mark, since }), or null.
    function acceptDrops(zone, folderUnder) {
        ui.folderDrop(zone, {
            kind: KIND,
            path: (payload) => payload.path,
            folderAt: folderUnder,
            onDrop: (payload, target) =>
                onMove(
                    payload.path,
                    target.folder,
                    payload.since,
                    target.since ?? (target.row ? Number(target.row.el.dataset.seq) : relocations.count())
                ),
        });
    }
}
