const { folderPath } = require('../tree/tree.js');

// What a browser's star opens: a page's bookmark in a dialog, its name and the folder it is in, changed by Done, or
// removed by Remove. A page not bookmarked is bookmarked at the end of the top level as it opens. Of the bookmarks of
// one address, it is the one added last.
function bookmarkEditor({ ui, bookmarks }) {
    ui.addStyle(`
        .browser-bookmark-editor-fields {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 8px 10px;
            align-items: center;
        }
        .browser-bookmark-editor-label { color: var(--deckit-muted); font: var(--deckit-type-small); }
        .browser-bookmark-editor-folder { justify-self: stretch; }
    `);
    let open = null;

    return { show, close, isOpen: () => !!open };

    // `page` is `{ url, title, icon }`.
    function show(page) {
        close();
        const tree = bookmarks.tree();
        const found = bookmarks.newest(page.url);
        const bookmark = found || bookmarks.add(page.url, page.title, page.icon);
        let folder = tree.parentOf(bookmark);

        const name = ui.field({ value: bookmark.title });
        const where = ui.select({
            options: [
                { value: tree.root, label: 'Bookmarks' },
                ...tree.folders().map((each) => ({ value: each, label: folderPath(tree, each) })),
            ],
            value: folder,
            onChange: (next) => {
                folder = next;
                where.set(next);
            },
        });
        where.element.classList.add('browser-bookmark-editor-folder');
        const fields = ui.element('div', { className: 'browser-bookmark-editor-fields' });
        fields.append(label('Name'), name.element, label('Folder'), where.element);
        open = ui.dialog({
            title: found ? 'Edit bookmark' : 'Bookmark added',
            content: fields,
            confirmLabel: 'Done',
            cancelLabel: null,
            extraLabel: 'Remove',
            onExtra: () => bookmarks.remove(bookmark),
            onConfirm: done,
            onClose: () => (open = null),
        });
        name.focus();
        name.input.select();

        // An empty name keeps the one it has.
        function done() {
            const text = name.input.value.trim();
            if (text && text !== bookmark.title) bookmarks.edit(bookmark, { title: text, url: bookmark.url });
            if (folder !== tree.parentOf(bookmark)) bookmarks.place(bookmark, folder, folder.children.length);
        }
    }

    function close() {
        open?.close();
        open = null;
    }

    function label(text) {
        return ui.element('span', { className: 'browser-bookmark-editor-label', text });
    }
}

module.exports = { bookmarkEditor };
