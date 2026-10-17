const { parseAddress } = require('./address.js');
const { favicon } = require('./favicon.js');
const { outline, inkOf } = require('./outline.js');
const { tabLabel } = require('./tab-list.js');
const { FOLDER_COLORS, isFolder } = require('./tree.js');

// The sidebar: the open tabs, in their folders, and the bookmarks, each a section that folds.
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
}) {
    const CAPTURES = [
        ['microphone', 'mic', 'Using your microphone'],
        ['camera', 'video', 'Using your camera'],
        ['screen', 'monitor', 'Sharing your screen'],
    ];

    let tabTree = null;
    let frontTab = null;
    const tabRows = new WeakMap(); // row element -> { row, icon, label, captures, mute }
    const bookmarkOf = new WeakMap(); // row element -> bookmark

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
        createItem: tabRow,
        updateItem: updateTabRow,
        onPlace: onPlaceTab,
        onToggle: (folder) => onChangeTabFolder(folder, { collapsed: !folder.collapsed }),
    });
    const bookmarkList = ui.list({ key: (bookmark) => bookmark.url, create: bookmarkRow, animated: true });
    const tabSection = ui.section({
        label: 'Tabs',
        icon: ui.icon('window', { size: 16 }),
        actions: [
            { icon: ui.icon('folderPlus', { size: 16 }), title: 'New folder', run: () => onNewTabFolder() },
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
        actions: [{ title: 'Add bookmark', run: () => add() }],
        collapsed: !!values.get('folds', {}).bookmarks,
        onToggle: (on) => {
            bookmarkSection.setCollapsed(on);
            fold('bookmarks', on);
        },
    });
    tabSection.body.append(tabOutline.element);
    bookmarkSection.body.append(bookmarkList.element);
    element.append(tabSection.element, bookmarkSection.element);

    ui.sortable(bookmarkList, { onReorder: (url, toUrl) => bookmarks.move(url, toUrl) });
    ui.contextMenu(tabOutline.element, {
        rowAt: (target) => target.closest('.browser-outline-row'),
        items: (row) => {
            const node = row && tabOutline.nodeAt(row);
            return node && (isFolder(node) ? tabFolderMenu(node) : tabMenu(node));
        },
    });
    ui.contextMenu(bookmarkList.element, {
        rowAt: (target) => target.closest('.browser-bookmark'),
        items: (row) => row && bookmarkMenu(bookmarkOf.get(row)),
    });

    return {
        element,
        showTabs(tree, front) {
            tabTree = tree;
            frontTab = front;
            tabOutline.set(tree, front);
        },
        showBookmarks: (list) => bookmarkList.set(list),
        renameFolder,
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

    // An empty name leaves the folder untitled.
    function renameFolder(folder, onChange) {
        ui.dialog({
            title: 'Name folder',
            fields: [{ key: 'title', label: 'Name', value: folder.title, placeholder: 'optional' }],
            confirmLabel: 'Name',
            onConfirm: ({ title }) => onChange(folder, { title: title.trim() }),
        });
    }

    function bookmarkRow(bookmark) {
        const row = ui.row();
        row.element.classList.add('browser-bookmark');
        const label = ui.element('span', { className: 'browser-row-label', text: bookmark.label });
        label.title = bookmark.url;
        const editAction = ui.rowAction({
            icon: ui.icon('pencil'),
            title: 'Edit name and address',
            onClick: () => edit(bookmark),
        });
        const removeAction = ui.rowAction({
            icon: ui.icon('x'),
            title: 'Remove',
            onClick: () => bookmarks.remove(bookmark.url),
        });
        row.element.append(favicon({ ui, page: bookmark }).element, label, editAction.element, removeAction.element);
        row.element.addEventListener('click', () => onOpenBookmark(bookmark));
        bookmarkOf.set(row.element, bookmark);
        return row.element;
    }

    function tabMenu(tab) {
        const parent = tabTree.parentOf(tab);
        const others = tabTree.folders().filter((folder) => folder !== parent);
        return [
            { label: 'Reload', icon: 'reload', hint: chordOf('reload'), run: () => tab.page.reload() },
            {
                label: 'Duplicate',
                icon: 'window',
                run: () => onNewTab(tab.url, { title: tab.title, icon: tab.icon, ...beside(tab) }),
            },
            {
                label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
                icon: tab.muted ? 'volume' : 'volumeOff',
                run: () => tab.page.mute(!tab.muted),
            },
            '-',
            {
                label: 'Move to New Folder',
                icon: 'folderPlus',
                run: () => onNewTabFolder(parent, parent.children.indexOf(tab), tab),
            },
            {
                label: 'Move to Folder',
                disabled: !others.length,
                items: others.map((folder) => ({
                    label: pathOf(folder),
                    run: () => onPlaceTab(tab, folder, folder.children.length),
                })),
            },
            {
                label: 'Remove from Folder',
                disabled: parent === tabTree.root,
                run: () => {
                    const outside = beside(parent);
                    onPlaceTab(tab, outside.parent, outside.index);
                },
            },
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
            { label: 'New Folder in Folder', icon: 'folderPlus', run: () => onNewTabFolder(folder) },
            { label: 'Rename Folder…', icon: 'pencil', run: () => renameFolder(folder, onChangeTabFolder) },
            { label: 'Color', items: colorItems(folder, onChangeTabFolder) },
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

    // Right after `node`, in its folder: `{ parent, index }`.
    function beside(node) {
        const parent = tabTree.parentOf(node);
        return { parent, index: parent.children.indexOf(node) + 1 };
    }

    // A folder by the folders it is in and its own name.
    function pathOf(folder) {
        return [...tabTree.ancestorsOf(folder).reverse(), folder]
            .map((each) => each.title || 'Untitled Folder')
            .join(' / ');
    }

    function bookmarkMenu(bookmark) {
        return [
            { label: 'Open', icon: 'globe', run: () => onOpenBookmark(bookmark) },
            {
                label: 'Open in New Tab',
                icon: 'window',
                run: () => onNewTab(bookmark.url, { title: bookmark.label, icon: bookmark.icon }),
            },
            '-',
            { label: 'Copy Link', icon: 'link', run: () => clipboard.writeText(bookmark.url).catch(() => {}) },
            { label: 'Edit…', icon: 'pencil', run: () => edit(bookmark) },
            { label: 'Remove', icon: 'x', run: () => bookmarks.remove(bookmark.url) },
        ];
    }

    function add() {
        ui.dialog({
            title: 'Add bookmark',
            fields: [
                { key: 'label', label: 'Name', placeholder: 'optional' },
                { key: 'url', label: 'Address', value: frontTab.url },
            ],
            confirmLabel: 'Add',
            onConfirm: ({ label, url }) => {
                const address = parseAddress(url);
                if (address) bookmarks.add(address, label.trim());
                else notAnAddress(url.trim());
            },
        });
    }

    function edit(bookmark) {
        ui.dialog({
            title: 'Edit bookmark',
            fields: [
                { key: 'label', label: 'Name', value: bookmark.label },
                { key: 'url', label: 'Address', value: bookmark.url },
            ],
            onConfirm: ({ label, url }) => {
                const address = parseAddress(url);
                if (!address) return notAnAddress(url.trim());
                if (bookmarks.edit(bookmark.url, { label: label.trim() || bookmark.label, url: address })) return;
                ui.dialog({ title: 'Already a bookmark', message: address, confirmLabel: 'OK', cancelLabel: 'Close' });
            },
        });
    }

    function fold(key, on) {
        values.set('folds', { ...values.get('folds', {}), [key]: on });
    }
}

module.exports = { sidebar };
