const { folderPath } = require('../tree/tree.js');

// What a browser's star opens: a page's bookmark in a popover, its name and the folder it is in, changed by Done,
// or removed by Remove. A page not bookmarked is bookmarked at the end of the top level as it opens. Of the bookmarks
// of one address, it is the one added last.
function bookmarkEditor({ ui, bookmarks }) {
    ui.addStyle(`
        .browser-bookmark-editor-title { margin-bottom: 10px; font: 700 var(--deckit-type-medium); }
        .browser-bookmark-editor-fields {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            gap: 8px 10px;
            align-items: center;
        }
        .browser-bookmark-editor-label { color: var(--deckit-muted); font: var(--deckit-type-small); }
        .browser-bookmark-editor-fields .deckit-select { justify-self: stretch; }
        .browser-bookmark-editor-buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
    `);
    const popover = ui.popover({ width: '320px' });

    return { show, close: () => popover.close(), isOpen: () => popover.isOpen() };

    // `page` is `{ url, title, icon }`. A second show while it is open closes it, as a second press on the star does.
    function show(page, anchor) {
        if (popover.isOpen()) return popover.close();
        const tree = bookmarks.tree();
        const found = bookmarks.newest(page.url);
        const bookmark = found || bookmarks.add(page.url, page.title, page.icon);
        let folder = tree.parentOf(bookmark);

        const title = ui.element('div', {
            className: 'browser-bookmark-editor-title',
            text: found ? 'Edit bookmark' : 'Bookmark added',
        });
        const name = ui.field({ value: bookmark.title, onSubmit: done });
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
        const fields = ui.element('div', { className: 'browser-bookmark-editor-fields' });
        fields.append(label('Name'), name.element, label('Folder'), where.element);
        const buttons = ui.element('div', { className: 'browser-bookmark-editor-buttons' });
        buttons.append(
            ui.button({ label: 'Remove', onClick: remove }).element,
            ui.button({ label: 'Done', variant: 'primary', onClick: done }).element
        );
        popover.element.replaceChildren(title, fields, buttons);
        popover.show(anchor);
        name.focus();
        name.input.select();

        // An empty name keeps the one it has.
        function done() {
            const text = name.input.value.trim();
            if (text && text !== bookmark.title) bookmarks.edit(bookmark, { title: text, url: bookmark.url });
            if (folder !== tree.parentOf(bookmark)) bookmarks.place(bookmark, folder, folder.children.length);
            popover.close();
        }

        function remove() {
            bookmarks.remove(bookmark);
            popover.close();
        }
    }

    function label(text) {
        return ui.element('span', { className: 'browser-bookmark-editor-label', text });
    }
}

module.exports = { bookmarkEditor };
