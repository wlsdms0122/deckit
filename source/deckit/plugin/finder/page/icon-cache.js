// The system's icons for entries, asked of main once per kind of entry, and Quick Look thumbnails for the preview.
// `onArrive()` hears icons arrive that were not there.
function iconCache({ ui, main, onArrive }) {
    // Pixels: twice the preview's room, for a Retina screen.
    const THUMBNAIL_SIZE = 480;
    const THUMBNAILS_KEPT = 24;
    const STYLE = `
        .finder-icon { flex: 0 0 auto; object-fit: contain; }
        .finder-icon-placeholder { display: flex; flex: 0 0 auto; opacity: 0.6; }
    `;
    const urls = new Map(); // icon key -> data URL, or null when the system has none
    const asking = new Set();
    // Keyed by mtime too, so a file saved again gets a new thumbnail.
    const thumbnails = new Map(); // "path|mtime" -> data URL, or null when Quick Look had none
    const thumbnailRequests = new Map();

    ui.addStyle(STYLE);

    return { request, urlOf, imageOf, thumbnail, cachedThumbnail };

    function request(entries) {
        const wanted = {};
        for (const entry of entries) {
            const key = keyOf(entry);
            if (urls.has(key) || asking.has(key)) continue;
            asking.add(key);
            wanted[key] = entry.path;
        }
        if (!Object.keys(wanted).length) return;
        main.call('icons', wanted)
            .then((answered) => {
                let arrived = false;
                for (const key of Object.keys(wanted)) {
                    asking.delete(key);
                    urls.set(key, answered[key] || null);
                    arrived = arrived || !!answered[key];
                }
                if (arrived) onArrive();
            })
            .catch(() => {
                for (const key of Object.keys(wanted)) {
                    asking.delete(key);
                    urls.set(key, null);
                }
            });
    }

    function urlOf(entry) {
        return urls.get(keyOf(entry)) || null;
    }

    function imageOf(entry, size = 16) {
        const url = urlOf(entry);
        if (url) {
            const image = ui.element('img', {
                className: 'finder-icon',
                style: { width: size + 'px', height: size + 'px' },
            });
            image.src = url;
            image.draggable = false;
            return image;
        }
        const glyph = ui.element('span', { className: 'finder-icon-placeholder' });
        glyph.innerHTML = ui.icon(kindIconOf(entry), { size: size - 1 });
        return glyph;
    }

    function thumbnail(entry) {
        const key = thumbnailKeyOf(entry);
        if (!thumbnailRequests.has(key)) {
            thumbnailRequests.set(
                key,
                main
                    .call('thumbnail', entry.path, THUMBNAIL_SIZE)
                    .catch(() => null)
                    .then((url) => {
                        thumbnailRequests.delete(key);
                        thumbnails.set(key, url || null);
                        while (thumbnails.size > THUMBNAILS_KEPT) thumbnails.delete(thumbnails.keys().next().value);
                        return url || null;
                    })
            );
        }
        return thumbnailRequests.get(key);
    }

    // The thumbnail already answered: a data URL, null when there was none, undefined when it was never asked for.
    function cachedThumbnail(entry) {
        return thumbnails.get(thumbnailKeyOf(entry));
    }

    // A package has an icon of its own; a folder or a file shares the one of its kind.
    function keyOf(entry) {
        if (entry.kind === 'package') return 'item:' + entry.path;
        return entry.kind === 'folder' ? 'folder' : 'extension:' + entry.extension;
    }

    function thumbnailKeyOf(entry) {
        return entry.path + '|' + entry.mtime;
    }
}

// The kit icon's name for an entry's kind, where the system's own icon is not at hand.
function kindIconOf(entry) {
    if (entry.kind === 'folder') return 'folder';
    return entry.kind === 'package' ? 'grid' : 'fileText';
}
