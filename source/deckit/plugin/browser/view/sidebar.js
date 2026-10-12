// The sidebar: the open tabs and the bookmarks, each a section that folds.
function sidebar({
    ui,
    host,
    values,
    bookmarks,
    notAnAddress,
    onNewTab,
    onSelectTab,
    onCloseTab,
    onMoveTab,
    onCloseOtherTabs,
    onOpenBookmark,
}) {
    const CAPTURES = [
        ['microphone', 'mic', 'Using your microphone'],
        ['camera', 'video', 'Using your camera'],
        ['screen', 'monitor', 'Sharing your screen'],
    ];

    let shownTabs = [];
    let activeTab = null;
    const tabRows = new WeakMap(); // row element -> { tab, row, icon, label, captures, mute }
    const bookmarkOf = new WeakMap(); // row element -> bookmark

    ui.addStyle(`
        .browser-sidebar { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
        .browser-row-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .browser-tab-icon { display: flex; flex: 0 0 auto; }
        .browser-tab-indicators { display: flex; align-items: center; gap: 3px; flex: 0 0 auto; }
        .browser-tab-capture { display: flex; color: var(--deckit-alert); }
        .browser-tab [hidden] { display: none; }
    `);
    const element = ui.element('div', { className: 'browser-sidebar' });
    const tabList = ui.list({ key: (tab) => tab.id, create: tabRow, update: updateTabRow, exit: true });
    const bookmarkList = ui.list({ key: (bookmark) => bookmark.url, create: bookmarkRow, exit: true });
    const tabSection = ui.section({
        label: 'Tabs',
        icon: ui.icon('window', { size: 16 }),
        actions: [{ title: 'New tab', run: () => onNewTab() }],
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
    tabSection.body.append(tabList.element);
    bookmarkSection.body.append(bookmarkList.element);
    element.append(tabSection.element, bookmarkSection.element);

    ui.sortable(tabList.element, { onReorder: onMoveTab });
    ui.sortable(bookmarkList.element, { onReorder: (from, to) => bookmarks.move(from, to) });
    ui.contextMenu(tabList.element, {
        rowAt: (target) => target.closest('.browser-tab'),
        items: (row) => row && tabMenu(tabRows.get(row).tab),
    });
    ui.contextMenu(bookmarkList.element, {
        rowAt: (target) => target.closest('.browser-bookmark'),
        items: (row) => row && bookmarkMenu(bookmarkOf.get(row)),
    });

    return {
        element,
        showTabs(tabs, active) {
            shownTabs = tabs;
            activeTab = active;
            tabList.set(tabs);
        },
        showBookmarks: (list) => bookmarkList.set(list),
    };

    function tabRow(tab) {
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
        tabRows.set(row.element, { tab, row, icon, label, captures, mute });
        updateTabRow(row.element, tab);
        return row.element;
    }

    function updateTabRow(rowElement, tab) {
        const { row, icon, label, captures, mute } = tabRows.get(rowElement);
        icon.replaceChildren(favicon({ ui, page: tab }).element);
        label.textContent = tab.title || placeOf(tab.url) || 'New tab';
        label.title = tab.url;
        for (const { kind, indicator } of captures) indicator.hidden = !tab.capture[kind];
        mute.element.hidden = !tab.audible && !tab.muted;
        mute.element.title = tab.muted ? 'Unmute tab' : 'Mute tab';
        mute.setIcon(ui.icon(tab.muted ? 'volumeOff' : 'volume', { size: 13 }));
        row.setActive(tab === activeTab);
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
        return [
            { label: 'Reload', icon: 'reload', hint: host.chordOf('reload'), run: () => tab.page.reload() },
            { label: 'Duplicate', icon: 'window', run: () => onNewTab(tab.url, { title: tab.title, icon: tab.icon }) },
            {
                label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
                icon: tab.muted ? 'volume' : 'volumeOff',
                run: () => tab.page.mute(!tab.muted),
            },
            '-',
            { label: 'Copy Link', icon: 'link', run: () => host.clipboard.writeText(tab.url).catch(() => {}) },
            {
                label: bookmarks.has(tab.url) ? 'Remove Bookmark' : 'Add Bookmark',
                icon: 'bookmark',
                run: () => bookmarks.toggle(tab),
            },
            '-',
            { label: 'Close Tab', icon: 'x', hint: host.chordOf('closeTab'), run: () => onCloseTab(tab) },
            { label: 'Close Other Tabs', disabled: shownTabs.length < 2, run: () => onCloseOtherTabs(tab) },
        ];
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
            { label: 'Copy Link', icon: 'link', run: () => host.clipboard.writeText(bookmark.url).catch(() => {}) },
            { label: 'Edit…', icon: 'pencil', run: () => edit(bookmark) },
            { label: 'Remove', icon: 'x', run: () => bookmarks.remove(bookmark.url) },
        ];
    }

    function add() {
        ui.dialog({
            title: 'Add bookmark',
            fields: [
                { key: 'label', label: 'Name', placeholder: 'optional' },
                { key: 'url', label: 'Address', value: activeTab.url },
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
