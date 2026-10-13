const { parseAddress } = require('./address.js');
const { favicon } = require('./favicon.js');
const { GROUP_COLORS, tabLabel } = require('./tabs.js');

// The sidebar: the open tabs, in their groups, and the bookmarks, each a section that folds.
function sidebar({
    theme,
    ui,
    chordOf,
    clipboard,
    values,
    bookmarks,
    notAnAddress,
    onNewTab,
    onSelectTab,
    onCloseTab,
    onPlaceTab,
    onPlaceGroup,
    onCloseOtherTabs,
    onNewGroup,
    onJoinGroup,
    onLeaveGroup,
    onChangeGroup,
    onUngroup,
    onCloseGroup,
    onOpenBookmark,
}) {
    const CAPTURES = [
        ['microphone', 'mic', 'Using your microphone'],
        ['camera', 'video', 'Using your camera'],
        ['screen', 'monitor', 'Sharing your screen'],
    ];
    // Each group colour as it reads on a dark ground and on a light one.
    const GROUP_INKS = {
        blue: ['#8ab4f8', '#1a73e8'],
        red: ['#f28b82', '#d93025'],
        yellow: ['#fdd663', '#e37400'],
        green: ['#81c995', '#1e8e3e'],
        pink: ['#ff8bcb', '#d01884'],
        purple: ['#c58af9', '#9334e6'],
        cyan: ['#78d9ec', '#007b83'],
        orange: ['#fcad70', '#fa7b17'],
        grey: ['#bdc1c6', '#5f6368'],
    };

    let shownTabs = [];
    let shownRows = [];
    let activeTab = null;
    let groupOf = () => null;
    const tabRows = new WeakMap(); // row element -> { tab, row, icon, label, captures, mute }
    const groupRows = new WeakMap(); // row element -> { group, row, label, count }
    const bookmarkOf = new WeakMap(); // row element -> bookmark

    ui.addStyle(`
        .browser-sidebar { display: flex; flex-direction: column; min-height: 0; flex: 1 1 auto; }
        .browser-row-label { flex: 1 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .browser-tab-icon { display: flex; flex: 0 0 auto; }
        .browser-tab-indicators { display: flex; align-items: center; gap: 3px; flex: 0 0 auto; }
        .browser-tab-capture { display: flex; color: var(--deckit-alert); }
        .browser-tab [hidden] { display: none; }
        .browser-tab[data-grouped] { position: relative; padding-left: 30px; }
        .browser-tab[data-grouped]::before {
            content: '';
            position: absolute;
            top: 5px;
            bottom: 5px;
            left: 14px;
            width: 2px;
            border-radius: var(--deckit-radius-round);
            background: var(--browser-group-ink);
        }
        .browser-group-caret { display: flex; flex: 0 0 auto; color: var(--deckit-muted); transition: transform var(--deckit-fast) var(--deckit-easing); }
        .browser-group[data-collapsed] .browser-group-caret { transform: rotate(-90deg); }
        .browser-group-dot { flex: 0 0 auto; width: 10px; height: 10px; border-radius: var(--deckit-radius-round); background: var(--browser-group-ink); }
        .browser-group-label[data-untitled] { color: var(--deckit-muted); }
        .browser-group-count { flex: 0 0 auto; color: var(--deckit-muted); font: var(--deckit-type-small); }
    `);
    const element = ui.element('div', { className: 'browser-sidebar' });
    // A row is a tab or a group's heading. A collapsed group shows its heading only.
    const tabList = ui.list({ key: keyOf, create: tabOrGroupRow, update: updateTabOrGroupRow, animated: true });
    const bookmarkList = ui.list({ key: (bookmark) => bookmark.url, create: bookmarkRow, animated: true });
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

    // Moved down, a row goes after the one it is let go on; moved up, before it. A tab let go just under an open
    // group's heading is the group's first.
    ui.sortable(tabList, {
        onReorder: (key, toKey) => {
            const from = shownRows.findIndex((each) => keyOf(each) === key);
            let to = shownRows.findIndex((each) => keyOf(each) === toKey);
            if (from < 0 || to < 0) return;
            let after = to > from;
            const moving = shownRows[from];
            if (moving.tab && !shownRows[to].tab && after && !shownRows[to].group.collapsed) {
                to += 1;
                after = false;
            }
            const target = shownRows[to].tab || shownRows[to].group;
            if (moving.tab) onPlaceTab(moving.tab, target, after);
            else onPlaceGroup(moving.group, target, after);
        },
    });
    ui.sortable(bookmarkList, { onReorder: (url, toUrl) => bookmarks.move(url, toUrl) });
    ui.contextMenu(tabList.element, {
        rowAt: (target) => target.closest('.browser-tab, .browser-group'),
        items: (row) => row && (tabRows.has(row) ? tabMenu(tabRows.get(row).tab) : groupMenu(groupRows.get(row).group)),
    });
    ui.contextMenu(bookmarkList.element, {
        rowAt: (target) => target.closest('.browser-bookmark'),
        items: (row) => row && bookmarkMenu(bookmarkOf.get(row)),
    });

    return {
        element,
        showTabs(tabs, active, groupOfTab) {
            shownTabs = tabs;
            activeTab = active;
            groupOf = groupOfTab;
            shownRows = rowsOf(tabs);
            tabList.set(shownRows);
        },
        showBookmarks: (list) => bookmarkList.set(list),
        renameGroup,
    };

    // Each group's heading before its first tab.
    function rowsOf(tabs) {
        const rows = [];
        let last = null;
        for (const tab of tabs) {
            const group = groupOf(tab);
            if (group && group !== last)
                rows.push({ group, size: tabs.filter((each) => groupOf(each) === group).length });
            last = group;
            if (!group?.collapsed) rows.push({ tab, group });
        }
        return rows;
    }

    function keyOf(row) {
        return row.tab ? 'tab:' + row.tab.id : 'group:' + row.group.id;
    }

    function tabOrGroupRow(row) {
        return row.tab ? tabRow(row) : groupRow(row);
    }

    function updateTabOrGroupRow(element, row) {
        if (row.tab) updateTabRow(element, row);
        else updateGroupRow(element, row);
    }

    function groupRow(shown) {
        const row = ui.row();
        row.element.classList.add('browser-group');
        const caret = ui.element('span', { className: 'browser-group-caret' });
        caret.innerHTML = ui.icon('chevronDown', { size: 14 });
        const dot = ui.element('span', { className: 'browser-group-dot' });
        const label = ui.element('span', { className: 'browser-row-label browser-group-label' });
        const count = ui.element('span', { className: 'browser-group-count' });
        row.element.append(caret, dot, label, count);
        row.element.addEventListener('click', () => {
            const { group } = groupRows.get(row.element);
            onChangeGroup(group, { collapsed: !group.collapsed });
        });
        groupRows.set(row.element, { group: shown.group, row, label, count });
        updateGroupRow(row.element, shown);
        return row.element;
    }

    // A collapsed group holding the active tab is marked as the tab would be.
    function updateGroupRow(rowElement, { group, size }) {
        const { row, label, count } = groupRows.get(rowElement);
        rowElement.style.setProperty('--browser-group-ink', inkOf(group.color));
        rowElement.toggleAttribute('data-collapsed', group.collapsed);
        rowElement.title = group.collapsed ? 'Expand group' : 'Collapse group';
        label.textContent = group.title || (size === 1 ? '1 tab' : `${size} tabs`);
        label.toggleAttribute('data-untitled', !group.title);
        count.textContent = group.title && group.collapsed ? String(size) : '';
        row.setActive(group.collapsed && groupOf(activeTab) === group);
    }

    // An empty name leaves the group untitled.
    function renameGroup(group) {
        ui.dialog({
            title: 'Name group',
            fields: [{ key: 'title', label: 'Name', value: group.title, placeholder: 'optional' }],
            confirmLabel: 'Name',
            onConfirm: ({ title }) => onChangeGroup(group, { title: title.trim() }),
        });
    }

    function inkOf(color) {
        return (GROUP_INKS[color] || GROUP_INKS.grey)[theme.dark ? 0 : 1];
    }

    function tabRow({ tab, group }) {
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
        updateTabRow(row.element, { tab, group });
        return row.element;
    }

    function updateTabRow(rowElement, { tab, group }) {
        const { row, icon, label, captures, mute } = tabRows.get(rowElement);
        rowElement.toggleAttribute('data-grouped', !!group);
        if (group) rowElement.style.setProperty('--browser-group-ink', inkOf(group.color));
        icon.replaceChildren(favicon({ ui, page: tab }).element);
        label.textContent = tabLabel(tab);
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
            { label: 'Reload', icon: 'reload', hint: chordOf('reload'), run: () => tab.page.reload() },
            {
                label: 'Duplicate',
                icon: 'window',
                run: () => onNewTab(tab.url, { title: tab.title, icon: tab.icon, group: groupOf(tab) }),
            },
            {
                label: tab.muted ? 'Unmute Tab' : 'Mute Tab',
                icon: tab.muted ? 'volume' : 'volumeOff',
                run: () => tab.page.mute(!tab.muted),
            },
            '-',
            { label: 'Add to New Group', icon: 'layers', run: () => onNewGroup(tab) },
            {
                label: 'Add to Group',
                disabled: !otherGroups(tab).length,
                items: otherGroups(tab).map((group) => ({
                    label: group.title || 'Untitled Group',
                    run: () => onJoinGroup(tab, group),
                })),
            },
            { label: 'Remove from Group', disabled: !groupOf(tab), run: () => onLeaveGroup(tab) },
            '-',
            { label: 'Copy Link', icon: 'link', run: () => clipboard.writeText(tab.url).catch(() => {}) },
            {
                label: bookmarks.has(tab.url) ? 'Remove Bookmark' : 'Add Bookmark',
                icon: 'bookmark',
                run: () => bookmarks.toggle(tab),
            },
            '-',
            { label: 'Close Tab', icon: 'x', hint: chordOf('closeTab'), run: () => onCloseTab(tab) },
            { label: 'Close Other Tabs', disabled: shownTabs.length < 2, run: () => onCloseOtherTabs(tab) },
        ];
    }

    function groupMenu(group) {
        return [
            { label: 'New Tab in Group', icon: 'plus', run: () => onNewTab(undefined, { group }) },
            { label: 'Rename Group…', icon: 'pencil', run: () => renameGroup(group) },
            {
                label: 'Color',
                items: GROUP_COLORS.map((color) => ({
                    label: color[0].toUpperCase() + color.slice(1),
                    checked: group.color === color,
                    run: () => onChangeGroup(group, { color }),
                })),
            },
            '-',
            { label: 'Ungroup', run: () => onUngroup(group) },
            { label: 'Close Group', icon: 'x', run: () => onCloseGroup(group) },
        ];
    }

    // The groups a tab can join, in the order they stand.
    function otherGroups(tab) {
        const groups = [...new Set(shownTabs.map(groupOf).filter(Boolean))];
        return groups.filter((group) => group !== groupOf(tab));
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

module.exports = { sidebar };
