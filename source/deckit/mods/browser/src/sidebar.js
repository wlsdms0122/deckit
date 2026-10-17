const { parseAddress } = require('./address.js');
const { favicon } = require('./favicon.js');
const { outline, inkOf } = require('./outline.js');
const { tabLabel } = require('./tab-list.js');
const { FOLDER_COLORS, isFolder, folderLabel } = require('./tree.js');

// The sidebar: the open tabs and the bookmarks, each a tree of folders in a section that folds.
function sidebar({
    ui,
    chordOf,
    clipboard,
    values,
    bookmarks,
    notAnAddress,
    onNewTab,
    onSelectTab,
    onCloseTab,
    onCloseOtherTabs,
    onPlaceTab,
    onNewTabFolder,
    onChangeTabFolder,
    onUngroupTabs,
    onCloseTabsIn,
    onDeleteTabFolder,
    onOpenBookmark,
    onOpenBookmarks,
}) {
    // What a row drawn out of one section into the other is carried as.
    const TAB = 'browser-tab';
    const BOOKMARK = 'browser-bookmark';
    const CAPTURES = [
        ['microphone', 'mic', 'Using your microphone'],
        ['camera', 'video', 'Using your camera'],
        ['screen', 'monitor', 'Sharing your screen'],
    ];

    let tabTree = null;
    let frontTab = null;
    const tabRows = new WeakMap(); // row element -> { row, icon, label, captures, mute }
    const bookmarkRows = new WeakMap(); // row element -> { row, label }

    ui.addStyle(`
        .browser-sidebar { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
        .browser-tab-icon { display: flex; flex: 0 0 auto; }
        .browser-tab-indicators { display: flex; align-items: center; gap: 3px; flex: 0 0 auto; }
        .browser-tab-capture { display: flex; color: var(--deckit-alert); }
        .browser-tab [hidden] { display: none; }
    `);
    const element = ui.element('div', { className: 'browser-sidebar' });
    const tabOutline = outline({
        ui,
        describe: (node) => ({
            kind: TAB,
            payload: node,
            text: isFolder(node) ? folderLabel(node) : tabLabel(node),
            icon: isFolder(node) ? 'folder' : 'window',
        }),
        createItem: tabRow,
        updateItem: updateTabRow,
        nameOf: tabLabel,
        choose: onSelectTab,
        // A tab has no name of its own to change: it is its page's title.
        onRename: (node) => isFolder(node) && renameTabFolder(node),
        onOpen: onSelectTab,
        onPlace: onPlaceTab,
        onToggle: (folder) => onChangeTabFolder(folder, { collapsed: !folder.collapsed }),
    });
    const bookmarkOutline = outline({
        ui,
        describe: (node) => ({
            kind: BOOKMARK,
            payload: node,
            text: isFolder(node) ? folderLabel(node) : node.title,
            icon: isFolder(node) ? 'folder' : 'bookmark',
        }),
        createItem: bookmarkRow,
        updateItem: updateBookmarkRow,
        nameOf: (bookmark) => bookmark.title,
        onRename: renameBookmark,
        onOpen: onOpenBookmark,
        onPlace: bookmarks.place,
        onToggle: (folder) => bookmarks.changeFolder(folder, { collapsed: !folder.collapsed }),
    });
    const tabSection = ui.section({
        label: 'Tabs',
        icon: ui.icon('window', { size: 16 }),
        actions: [
            { icon: ui.icon('folderPlus', { size: 16 }), title: 'New folder', run: () => newTabFolder() },
            { title: 'New tab', run: () => onNewTab() },
        ],
        collapsed: !!values.get('folds', {}).tabs,
        onToggle: (on) => {
            tabSection.setCollapsed(on);
            fold('tabs', on);
        },
    });
    const bookmarkSection = ui.section({
        label: 'Bookmarks',
        icon: ui.icon('bookmark', { size: 16 }),
        actions: [
            { icon: ui.icon('folderPlus', { size: 16 }), title: 'New folder', run: () => newBookmarkFolder() },
            { title: 'Add bookmark', run: () => add() },
        ],
        collapsed: !!values.get('folds', {}).bookmarks,
        onToggle: (on) => {
            bookmarkSection.setCollapsed(on);
            fold('bookmarks', on);
        },
    });
    tabSection.body.append(tabOutline.element);
    bookmarkSection.body.append(bookmarkOutline.element);
    element.append(tabSection.element, bookmarkSection.element);

    // A tab or a folder of tabs let go in the bookmarks is bookmarked there, and a bookmark or a folder of them let go
    // in the tabs is opened there; each stays where it came from. A drop on a section off its rows, its heading too,
    // goes to its top level.
    ui.dropTarget(bookmarkSection.element, {
        kind: TAB,
        placeAt: (under) => dropPlace(bookmarkOutline, bookmarkSection, under),
        onDrop: (node, { parent }) => bookmarks.addTabs(node, parent),
    });
    ui.dropTarget(tabSection.element, {
        kind: BOOKMARK,
        placeAt: (under) => dropPlace(tabOutline, tabSection, under),
        onDrop: (node, { parent }) => onOpenBookmarks(node, parent),
    });
    ui.contextMenu(tabOutline.element, {
        rowAt: (target) => target.closest('.browser-outline-row'),
        items: (row) => {
            const node = row && tabOutline.nodeAt(row);
            return node && (isFolder(node) ? tabFolderMenu(node) : tabMenu(node));
        },
    });
    ui.contextMenu(bookmarkOutline.element, {
        rowAt: (target) => target.closest('.browser-outline-row'),
        items: (row) => {
            const node = row && bookmarkOutline.nodeAt(row);
            return node && (isFolder(node) ? bookmarkFolderMenu(node) : bookmarkMenu(node));
        },
    });

    return {
        element,
        showTabs(tree, front) {
            tabTree = tree;
            frontTab = front;
            tabOutline.set(tree, front);
        },
        showBookmarks: (tree) => bookmarkOutline.set(tree),
    };

    function tabRow(shown) {
        const { node: tab } = shown;
        const row = ui.row();
        row.element.classList.add('browser-tab');
        const icon = ui.element('span', { className: 'browser-tab-icon' });
        const label = ui.element('span', { className: 'browser-row-label' });
        const indicators = ui.element('span', { className: 'browser-tab-indicators' });
        const captures = CAPTURES.map(([kind, name, title]) => {
            const indicator = ui.element('span', { className: 'browser-tab-capture' });
            indicator.innerHTML = ui.icon(name, { size: 13 });
            indicator.title = title;
            return { kind, indicator };
        });
        const mute = ui.iconButton({
            icon: '',
            title: '',
            onClick: (event) => {
                event.stopPropagation();
                tab.page.mute(!tab.muted);
            },
            size: 'small',
            muted: true,
        });
        indicators.append(...captures.map(({ indicator }) => indicator), mute.element);
        const close = ui.rowAction({ icon: ui.icon('x'), title: 'Close tab', onClick: () => onCloseTab(tab) });
        row.element.append(icon, label, indicators, close.element);
        row.element.addEventListener('click', () => onSelectTab(tab));
        tabRows.set(row.element, { row, icon, label, captures, mute });
        updateTabRow(row.element, shown);
        return row.element;
    }

    function updateTabRow(rowElement, { node: tab, active }) {
        const { row, icon, label, captures, mute } = tabRows.get(rowElement);
        icon.replaceChildren(favicon({ ui, page: tab }).element);
        label.textContent = tabLabel(tab);
        label.title = tab.url;
        for (const { kind, indicator } of captures) indicator.hidden = !tab.capture[kind];
        mute.element.hidden = !tab.audible && !tab.muted;
        mute.element.title = tab.muted ? 'Unmute tab' : 'Mute tab';
        mute.setIcon(ui.icon(tab.muted ? 'volumeOff' : 'volume', { size: 13 }));
        row.setActive(active);
    }

    function bookmarkRow(shown) {
        const { node: bookmark } = shown;
        const row = ui.row();
        row.element.classList.add('browser-bookmark');
        const label = ui.element('span', { className: 'browser-row-label' });
        const editAction = ui.rowAction({
            icon: ui.icon('pencil'),
            title: 'Edit name and address',
            onClick: () => edit(bookmark),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x'),
            title: 'Remove',
            onClick: () => bookmarks.remove(bookmark),
        });
        row.element.append(favicon({ ui, page: bookmark }).element, label, editAction.element, removeAction.element);
        row.element.addEventListener('click', () => onOpenBookmark(bookmark));
        bookmarkRows.set(row.element, { row, label });
        updateBookmarkRow(row.element, shown);
        return row.element;
    }

    // Marked while the keys stand on it.
    function updateBookmarkRow(rowElement, { node: bookmark, active }) {
        const { row, label } = bookmarkRows.get(rowElement);
        row.setActive(active);
        label.textContent = bookmark.title;
        label.title = bookmark.url;
    }

    function tabMenu(tab) {
        return [
            { label: 'Reload', icon: 'reload', hint: chordOf('reload'), run: () => tab.page.reload() },
            {
                label: 'Duplicate',
                icon: 'window',
                run: () => onNewTab(tab.url, { title: tab.title, icon: tab.icon, ...tabTree.beside(tab) }),
            },
            {
                label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
                icon: tab.muted ? 'volume' : 'volumeOff',
                run: () => tab.page.mute(!tab.muted),
            },
            '-',
            ...moveItems(tabTree, tab, { onPlace: onPlaceTab, onNewFolder: newTabFolder }),
            '-',
            { label: 'Copy Link', icon: 'link', run: () => clipboard.writeText(tab.url).catch(() => {}) },
            {
                label: bookmarks.has(tab.url) ? 'Remove Bookmark' : 'Add Bookmark',
                icon: 'bookmark',
                run: () => bookmarks.toggle(tab),
            },
            '-',
            { label: 'Close Tab', icon: 'x', hint: chordOf('closeTab'), run: () => onCloseTab(tab) },
            {
                label: 'Close Other Tabs',
                disabled: tabTree.items().length < 2,
                run: () => onCloseOtherTabs(tab),
            },
        ];
    }

    function tabFolderMenu(folder) {
        return [
            { label: 'New Tab in Folder', icon: 'plus', run: () => onNewTab(undefined, { parent: folder }) },
            { label: 'New Folder in Folder', icon: 'folderPlus', run: () => newTabFolder(folder) },
            { label: 'Rename Folder…', icon: 'pencil', run: () => renameTabFolder(folder) },
            { label: 'Color', items: colorItems(folder, onChangeTabFolder) },
            '-',
            { label: 'Add Folder to Bookmarks', icon: 'bookmark', run: () => bookmarks.addTabs(folder) },
            '-',
            { label: 'Ungroup', run: () => onUngroupTabs(folder) },
            {
                label: 'Close Tabs in Folder',
                disabled: !tabTree.items(folder).length,
                run: () => onCloseTabsIn(folder),
            },
            { label: 'Delete Folder', icon: 'trash', run: () => onDeleteTabFolder(folder) },
        ];
    }

    function colorItems(folder, onChange) {
        return [
            ...FOLDER_COLORS.map((color) => ({
                label: color[0].toUpperCase() + color.slice(1),
                checked: folder.color === color,
                run: () => onChange(folder, { color }),
            })),
            '-',
            {
                label: 'Custom…',
                checked: !FOLDER_COLORS.includes(folder.color),
                run: () =>
                    ui.colorPicker({
                        title: 'Folder colour',
                        value: inkOf(folder.color),
                        onPick: (color) => onChange(folder, { color }),
                    }),
            },
        ];
    }

    function bookmarkMenu(bookmark) {
        return [
            { label: 'Open', icon: 'globe', run: () => onOpenBookmark(bookmark) },
            {
                label: 'Open in New Tab',
                icon: 'window',
                run: () => onNewTab(bookmark.url, { title: bookmark.title, icon: bookmark.icon }),
            },
            '-',
            ...moveItems(bookmarks.tree(), bookmark, {
                onPlace: bookmarks.place,
                onNewFolder: newBookmarkFolder,
            }),
            '-',
            { label: 'Copy Link', icon: 'link', run: () => clipboard.writeText(bookmark.url).catch(() => {}) },
            { label: 'Edit…', icon: 'pencil', run: () => edit(bookmark) },
            { label: 'Remove', icon: 'x', run: () => bookmarks.remove(bookmark) },
        ];
    }

    function bookmarkFolderMenu(folder) {
        return [
            { label: 'Open Folder as Tabs', icon: 'window', run: () => onOpenBookmarks(folder) },
            '-',
            { label: 'New Folder in Folder', icon: 'folderPlus', run: () => newBookmarkFolder(folder) },
            { label: 'Rename Folder…', icon: 'pencil', run: () => renameBookmark(folder) },
            { label: 'Color', items: colorItems(folder, bookmarks.changeFolder) },
            '-',
            { label: 'Ungroup', run: () => bookmarks.ungroup(folder) },
            { label: 'Delete Folder', icon: 'trash', run: () => bookmarks.remove(folder) },
        ];
    }

    // An empty folder at `index` in `parent`, holding `node` when one is given, and named.
    function newTabFolder(parent, index, node) {
        renameTabFolder(onNewTabFolder(parent, index, node));
    }

    function newBookmarkFolder(parent, index, node) {
        renameBookmark(bookmarks.newFolder(parent, index, node));
    }

    // A name is typed over its row, its section unfolded to show it.
    function renameTabFolder(folder) {
        unfold(tabSection, 'tabs');
        tabOutline.rename(folder, (title) => onChangeTabFolder(folder, { title }));
    }

    // A bookmark's name only: its address is changed in Edit.
    function renameBookmark(node) {
        unfold(bookmarkSection, 'bookmarks');
        bookmarkOutline.rename(node, (title) =>
            isFolder(node) ? bookmarks.changeFolder(node, { title }) : bookmarks.edit(node, { title, url: node.url })
        );
    }

    // Moving `node` of `tree` into a new folder at its place, into another folder, or out of the one it is in.
    function moveItems(tree, node, { onPlace, onNewFolder }) {
        const parent = tree.parentOf(node);
        const others = tree.folders().filter((folder) => folder !== parent);
        return [
            {
                label: 'Move to New Folder',
                icon: 'folderPlus',
                run: () => onNewFolder(parent, parent.children.indexOf(node), node),
            },
            {
                label: 'Move to Folder',
                disabled: !others.length,
                items: others.map((folder) => ({
                    label: pathOf(tree, folder),
                    run: () => onPlace(node, folder, folder.children.length),
                })),
            },
            {
                label: 'Remove from Folder',
                disabled: parent === tree.root,
                run: () => {
                    const outside = tree.beside(parent);
                    onPlace(node, outside.parent, outside.index);
                },
            },
        ];
    }

    // The place in a section a thing from the other one lands, lit by its folder's row, or for the top level by the
    // whole section.
    function dropPlace(view, section, under) {
        const { parent, mark } = view.dropAt(under);
        return { parent, mark: mark || section.element };
    }

    // A folder by the folders it is in and its own name.
    function pathOf(tree, folder) {
        return [...tree.ancestorsOf(folder).reverse(), folder].map(folderLabel).join(' / ');
    }

    function add() {
        ui.dialog({
            title: 'Add bookmark',
            fields: [
                { key: 'title', label: 'Name', placeholder: 'optional' },
                { key: 'url', label: 'Address', value: frontTab.url },
            ],
            confirmLabel: 'Add',
            onConfirm: ({ title, url }) => {
                const address = parseAddress(url);
                if (address) bookmarks.add(address, title.trim());
                else notAnAddress(url.trim());
            },
        });
    }

    function edit(bookmark) {
        ui.dialog({
            title: 'Edit bookmark',
            fields: [
                { key: 'title', label: 'Name', value: bookmark.title },
                { key: 'url', label: 'Address', value: bookmark.url },
            ],
            onConfirm: ({ title, url }) => {
                const address = parseAddress(url);
                if (!address) return notAnAddress(url.trim());
                bookmarks.edit(bookmark, { title: title.trim() || bookmark.title, url: address });
            },
        });
    }

    function unfold(section, key) {
        if (!section.isCollapsed()) return;
        section.setCollapsed(false);
        fold(key, false);
    }

    function fold(key, on) {
        values.set('folds', { ...values.get('folds', {}), [key]: on });
    }
}

module.exports = { sidebar };
