const { canonical, isFile, placeOf } = require('./address.js');

// What a tab group is coloured, in the order a new group takes the first one no group has.
const GROUP_COLORS = ['blue', 'red', 'yellow', 'green', 'pink', 'purple', 'cyan', 'orange', 'grey'];

// The open tabs, each with its page, and the session record that brings them back. A web address opens in the web
// session and a file in the files session.
//
// A tab is in one group or none. A group's tabs stand together in the list, and a group goes with its last tab.
function tabs({
    web,
    records,
    area,
    webSession,
    filesSession,
    home,
    onChange,
    onSelect,
    onNavigate,
    onRelease,
    onFocus,
    onCertificateRefused,
    decidePermission,
    onNotification,
    onFound,
}) {
    const KEPT_CLOSED = 20;

    const saved = records.get('session', { tabs: [], active: 0, closed: [], groups: [] });
    const list = [];
    const closed = [...saved.closed];
    // id -> { id, title, color, collapsed }
    const groups = new Map((saved.groups || []).map((group) => [group.id, { ...group }]));
    let current = null;
    let lastId = 0;
    let lastGroupId = Math.max(0, ...groups.keys());

    return {
        list: () => list,
        active: () => current,
        lastClosed: () => closed.at(-1),
        groupOf,
        add,
        select,
        navigate,
        close,
        closeOthers,
        reopen,
        place,
        restore,
        newGroup,
        join,
        leave,
        changeGroup,
        ungroup,
        closeGroup,
    };

    // Adding a tab chooses it, which opens its group: the folds are given back once every tab is in.
    function restore() {
        if (!saved.tabs.length) return add();
        const restored = saved.tabs.map(({ url, title, icon, group }) =>
            add(url, { title, icon, group: groups.get(group) })
        );
        for (const { id, collapsed } of saved.groups || []) if (groups.has(id)) groups.get(id).collapsed = collapsed;
        select(restored[saved.active]);
    }

    function groupOf(tab) {
        return groups.get(tab.group) || null;
    }

    // In `group`, the tab goes after its last one.
    function add(url = home(), { title = '', icon = '', background = false, group = null } = {}) {
        const page = pageFor(url);
        page.element.style.visibility = 'hidden';
        area.prepend(page.element);
        const tab = {
            id: ++lastId,
            page,
            url: canonical(url),
            title,
            icon,
            group: group?.id ?? null,
            loading: true,
            canGoBack: false,
            canGoForward: false,
            // The window name the page asked for, which a later request for the same name reuses.
            target: '',
            audible: false,
            muted: false,
            capture: { microphone: false, camera: false, screen: false },
        };
        const last = group && tabsOf(group).at(-1);
        list.splice(last ? list.indexOf(last) + 1 : list.length, 0, tab);
        listen(tab);
        if (background) changed();
        else select(tab);
        return tab;
    }

    // A tab chosen in a collapsed group opens the group.
    function select(tab) {
        const previous = current;
        current = tab;
        const group = groupOf(tab);
        if (group) group.collapsed = false;
        showCurrent();
        changed();
        onSelect(tab, previous);
    }

    // A tab crossing between file and web is given a new page in the other session: a web page's history has no file
    // in it to go back to.
    function navigate(tab, address) {
        onNavigate();
        const url = canonical(address);
        if (isFile(url) === (tab.page.session === filesSession)) {
            tab.page.load(url);
            return;
        }
        const old = tab.page;
        tab.page = pageFor(url);
        old.element.before(tab.page.element);
        release(tab, old);
        Object.assign(tab, { url, title: '', icon: '', loading: true, canGoBack: false, canGoForward: false });
        listen(tab);
        showCurrent();
        changed();
    }

    function close(tab) {
        const index = list.indexOf(tab);
        if (index < 0) return;
        retire(tab);
        if (!list.length) return add();
        if (tab === current) select(list[Math.max(0, index - 1)]);
        else changed();
    }

    // Retired together: closed one at a time, each close would bring its neighbour forward on the way.
    function closeOthers(keep) {
        for (const tab of list.filter((each) => each !== keep)) retire(tab);
        if (keep !== current) select(keep);
        else changed();
    }

    function reopen() {
        const last = closed.pop();
        if (!last) return;
        const tab = add(last.url, { title: last.title, icon: last.icon });
        const at = list[Math.min(last.at, list.length - 1)];
        if (at !== tab) place(tab, at, false);
    }

    // `moving`, a tab or a group, goes beside `target`, a tab or a group: after it with `after`, before it otherwise. A
    // tab put among a group's tabs, or just after an open group's heading, is in that group, and one put anywhere else
    // is in none. A group goes beside another group, never into it.
    function place(moving, target, after) {
        const movingGroup = isGroup(moving);
        const beside = movingGroup && !isGroup(target) && groupOf(target) ? groupOf(target) : target;
        const moved = movingGroup ? tabsOf(moving) : [moving];
        if (beside === moving || moved.includes(beside)) return;
        // A group's own tabs, but the one moving: a tab alone in its group has nothing to stand beside.
        const span = isGroup(beside) ? tabsOf(beside).filter((tab) => tab !== moving) : [beside];
        if (!span.length) return;
        const opensInto = !movingGroup && isGroup(beside) && after && !beside.collapsed;
        for (const tab of moved) list.splice(list.indexOf(tab), 1);
        list.splice(opensInto || !after ? list.indexOf(span[0]) : list.indexOf(span.at(-1)) + 1, 0, ...moved);
        if (!movingGroup) {
            const left = groupOf(moving);
            moving.group = isGroup(beside) ? (opensInto ? beside.id : null) : beside.group;
            forgetIfEmpty(left);
        }
        changed();
    }

    // A group of `tab` alone, after the group it leaves.
    function newGroup(tab) {
        detach(tab);
        const used = new Set([...groups.values()].map((group) => group.color));
        const color = GROUP_COLORS.find((each) => !used.has(each)) || GROUP_COLORS[groups.size % GROUP_COLORS.length];
        const group = { id: ++lastGroupId, title: '', color, collapsed: false };
        groups.set(group.id, group);
        tab.group = group.id;
        changed();
        return group;
    }

    // The tab goes after the group's last one.
    function join(tab, group) {
        if (tab.group === group.id) return;
        const left = groupOf(tab);
        list.splice(list.indexOf(tab), 1);
        list.splice(list.indexOf(tabsOf(group).at(-1)) + 1, 0, tab);
        tab.group = group.id;
        forgetIfEmpty(left);
        changed();
    }

    function leave(tab) {
        detach(tab);
        changed();
    }

    // `change` is any of `title`, `color`, `collapsed`.
    function changeGroup(group, change) {
        Object.assign(group, change);
        changed();
    }

    // Its tabs stay where they are, in no group.
    function ungroup(group) {
        for (const tab of tabsOf(group)) tab.group = null;
        groups.delete(group.id);
        changed();
    }

    function closeGroup(group) {
        const gone = tabsOf(group);
        const index = list.indexOf(gone[0]);
        for (const tab of gone) retire(tab);
        if (!list.length) return add();
        if (gone.includes(current)) select(list[Math.max(0, index - 1)]);
        else changed();
    }

    function listen(tab) {
        const { page } = tab;
        const isCurrentPage = () => tab.page === page && list.includes(tab);
        page.delegate = {
            didChange: (state) => {
                if (tab.page !== page) return;
                if (state.url) tab.url = canonical(state.url);
                tab.title = state.title || '';
                if (state.icon || !state.loading) tab.icon = state.icon || '';
                tab.loading = state.loading;
                tab.canGoBack = state.canGoBack;
                tab.canGoForward = state.canGoForward;
                tab.audible = !!state.audible;
                tab.muted = !!state.muted;
                tab.capture = state.capture || tab.capture;
                changed();
            },
            didFocus: () => onFocus(),
            didRefuseCertificate: (info) => onCertificateRefused(info),
            decidePermission: (request) => (list.includes(tab) ? decidePermission(tab, request) : false),
            didReceiveNotification: (notification) => onNotification(tab, notification),
            didFind: (result) => {
                if (tab.page === page) onFound(tab, result);
            },
            // A file page following a link to the web: reopened here in the web session.
            shouldLeave: (url) => {
                if (isCurrentPage()) navigate(tab, url);
                return false;
            },
            didRequestClose: () => {
                if (isCurrentPage()) close(tab);
            },
        };
    }

    function retire(tab) {
        const index = list.indexOf(tab);
        if (tab.url !== 'about:blank') {
            closed.push({ url: tab.url, title: tab.title, icon: tab.icon, at: index });
            closed.splice(0, Math.max(0, closed.length - KEPT_CLOSED));
        }
        release(tab, tab.page);
        list.splice(index, 1);
        forgetIfEmpty(groupOf(tab));
    }

    // Out of its group, after the group's last tab.
    function detach(tab) {
        const group = groupOf(tab);
        if (!group) return;
        tab.group = null;
        const rest = tabsOf(group);
        if (rest.length) {
            list.splice(list.indexOf(tab), 1);
            list.splice(list.indexOf(rest.at(-1)) + 1, 0, tab);
        }
        forgetIfEmpty(group);
    }

    function forgetIfEmpty(group) {
        if (group && !tabsOf(group).length) groups.delete(group.id);
    }

    function tabsOf(group) {
        return list.filter((tab) => tab.group === group.id);
    }

    function isGroup(item) {
        return groups.get(item.id) === item;
    }

    function release(tab, page) {
        onRelease(tab);
        page.close();
    }

    function pageFor(url) {
        return web.page({ session: isFile(url) ? filesSession : webSession, url });
    }

    // Pages out of sight are hidden by visibility: a page element with nothing to draw into (display: none) comes
    // back blank or at the wrong size.
    function showCurrent() {
        for (const tab of list) tab.page.element.style.visibility = tab === current ? 'visible' : 'hidden';
    }

    function changed() {
        onChange();
        persist();
    }

    function persist() {
        records.set('session', {
            tabs: list.map(({ url, title, icon, group }) => ({ url, title, icon, group })),
            active: Math.max(0, list.indexOf(current)),
            closed,
            groups: [...groups.values()],
        });
    }
}

// What names a tab in a line: its title, else its file or site.
function tabLabel(tab) {
    return tab.title || placeOf(tab.url) || 'New tab';
}

module.exports = { GROUP_COLORS, tabs, tabLabel };
