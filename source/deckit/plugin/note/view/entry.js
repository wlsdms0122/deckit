// A note or a folder drawn as a sidebar row or a gallery card: its path in `data-note` or `data-folder`, and the
// relocation count it was read at in `data-since`.
const ENTRY = '[data-note], [data-folder]';

// A drag can start on a text node, which has no closest().
function entryAt(target) {
    return target.closest?.(ENTRY) ?? null;
}

// The name label of `path`'s row or card in `container`, what a drag carries and a rename types over.
function labelIn(container, path) {
    return container.querySelector(
        `[data-note="${CSS.escape(path)}"] [data-name], [data-folder="${CSS.escape(path)}"] [data-name]`
    );
}

function markEntry(element, { kind, path, since }) {
    element.dataset[kind] = path;
    element.dataset.since = String(since);
}

// { kind: 'note' | 'folder', path, since }, as markEntry wrote it.
function entryOf(element) {
    const kind = element.dataset.note != null ? 'note' : 'folder';
    return { kind, path: element.dataset[kind], since: Number(element.dataset.since) };
}
