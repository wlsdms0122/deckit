const { canonical, isFile, placeOf } = require('./address.js');
const { tree, isFolder, folderOf } = require('./tree.js');

// The open tabs, each with its page, in a tree of folders (`tree.js`), and the session record that brings them back.
// A web address opens in the web session and a file in the files session. A folder stands until it is deleted, empty
// or not.
function tabList({
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

    const saved = records.get('session', { tabs: [], front: 0, closed: [] });
    const closed = [...saved.closed];
    // Past every folder a closed tab still names, so reopening one never finds its folder in a newer one.
    const nodes = tree([], Math.max(0, ...closed.map((tab) => tab.parent || 0)));
    let front = null;

    return {
        tree: () => nodes,
        list: () => nodes.items(),
        front: () => front,
        lastClosed: () => closed.at(-1),
        add,
        open,
        select,
        navigate,
        close,
        closeOthers,
        reopen,
        place,
        restore,
        newFolder,
        changeFolder,
        ungroup,
        closeTabsIn,
        deleteFolder,
        openBookmarks,
    };

    // Choosing a tab opens its folders: the folds are given back once the tabs are in and the one in front is chosen.
    function restore() {
        const folds = [];
        const build = (parent, children) => {
            for (const node of children) {
                if (isFolder(node)) {
                    const folder = { ...node, children: [] };
                    folds.push([folder, folder.collapsed]);
                    nodes.insert(folder, parent);
                    build(folder, node.children);
                } else nodes.insert(tabOf(node.url, node), parent);
            }
        };
        build(nodes.root, saved.tabs);
        const tabs = nodes.items();
        if (!tabs.length) return add();
        select(tabs.find((tab) => tab.id === saved.front) || tabs[0]);
        for (const [folder, collapsed] of folds) folder.collapsed = collapsed;
        changed();
    }

    // At `index` in `parent`, the end of the top level by default.
    function add(url = home(), { title = '', icon = '', background = false, parent = nodes.root, index } = {}) {
        const tab = tabOf(url, { title, icon });
        nodes.insert(tab, parent, index);
        if (background) changed();
        else select(tab);
        return tab;
    }

    // `target` is the window the page named: a second request for it reuses the tab that answered the first. A tab
    // opened by another goes after it, and after the tabs it opened just before, in its folder.
    function open(url, { activates = true, target = '', opener = null } = {}) {
        const named = target && nodes.items().find((tab) => tab.target === target);
        if (named) {
            navigate(named, url);
            if (activates) select(named);
            return;
        }
        if (!opener) return Object.assign(add(url, { background: !activates }), { target });
        const { children } = nodes.parentOf(opener);
        let after = opener;
        while (children[children.indexOf(after) + 1]?.opener === opener) after = children[children.indexOf(after) + 1];
        Object.assign(add(url, { background: !activates, ...beside(after) }), { target, opener });
    }

    // A tab chosen in a folded folder opens it, and the folders it is in.
    function select(tab) {
        const previous = front;
        front = tab;
        for (const folder of nodes.ancestorsOf(tab)) folder.collapsed = false;
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
        if (nodes.items().includes(tab)) closeTabs([tab]);
    }

    function closeOthers(keep) {
        closeTabs(nodes.items().filter((each) => each !== keep));
    }

    // Back in its folder, where it was, while the folder stands; else at the end of the top level.
    function reopen() {
        const last = closed.pop();
        if (!last) return;
        const folder = last.parent === null ? nodes.root : nodes.find(last.parent);
        const where = folder ? { parent: folder, index: Math.min(last.index, folder.children.length) } : {};
        add(last.url, { title: last.title, icon: last.icon, ...where });
    }

    // A tab or a folder goes to `index` in `parent`, read with it still where it was.
    function place(node, parent, index) {
        nodes.move(node, parent, index);
        changed();
    }

    // An empty folder at `index` in `parent`, holding `node` when one is given.
    function newFolder(parent = nodes.root, index = parent.children.length, node = null) {
        const folder = nodes.folder();
        nodes.insert(folder, parent, index);
        if (node) nodes.move(node, folder, 0);
        changed();
        return folder;
    }

    // `change` is any of `title`, `color`, `collapsed`.
    function changeFolder(folder, change) {
        Object.assign(folder, change);
        changed();
    }

    // What it holds takes its place.
    function ungroup(folder) {
        const { parent, index } = nodes.remove(folder);
        folder.children.forEach((node, at) => nodes.insert(node, parent, index + at));
        changed();
    }

    // It stays, empty of tabs.
    function closeTabsIn(folder) {
        closeTabs(nodes.items(folder));
    }

    // A bookmark, or a folder of bookmarks with what it holds, opened at the end of `parent`, and its first tab chosen.
    function openBookmarks(node, parent = nodes.root) {
        const opened = (each, into) => {
            if (!isFolder(each))
                return [add(each.url, { title: each.title, icon: each.icon, background: true, parent: into })];
            const folder = { ...folderOf(each), id: nodes.newId(), children: [] };
            nodes.insert(folder, into);
            return each.children.flatMap((child) => opened(child, folder));
        };
        const [first] = opened(node, parent);
        if (first) select(first);
        else changed();
    }

    // Its tabs closed, and it gone with what it holds.
    function deleteFolder(folder) {
        closeTabs(nodes.items(folder));
        nodes.remove(folder);
        changed();
    }

    // Retired together: closed one at a time, each close would bring its neighbour forward on the way. The tab in
    // front, closed, gives way to the nearest one before it, else after it.
    function closeTabs(tabs) {
        const order = nodes.items();
        const at = order.indexOf(front);
        const stays = (tab) => !tabs.includes(tab);
        const next = stays(front) ? front : order.slice(0, at).reverse().find(stays) || order.slice(at).find(stays);
        for (const tab of tabs) retire(tab);
        if (!next) return add();
        if (next !== front) select(next);
        else changed();
    }

    function listen(tab) {
        const { page } = tab;
        const isCurrentPage = () => tab.page === page && nodes.items().includes(tab);
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
            decidePermission: (request) => (nodes.items().includes(tab) ? decidePermission(tab, request) : false),
            didReceiveNotification: (notification) => onNotification(tab, notification),
            didFind: (result) => {
                if (tab.page === page) onFound(tab, result);
            },
            // A file page following a link to the web: reopened here in the web session.
            shouldLeave: (url) => {
                if (isCurrentPage()) navigate(tab, url);
                return false;
            },
            shouldOpenWindow: (url, { activates, target }) => {
                if (isCurrentPage()) open(url, { activates, target, opener: tab });
                return false;
            },
            didRequestClose: () => {
                if (isCurrentPage()) close(tab);
            },
        };
    }

    function retire(tab) {
        const { parent, index } = nodes.remove(tab);
        if (tab.url !== 'about:blank') {
            const { url, title, icon } = tab;
            closed.push({ url, title, icon, parent: parent === nodes.root ? null : parent.id, index });
            closed.splice(0, Math.max(0, closed.length - KEPT_CLOSED));
        }
        release(tab, tab.page);
    }

    function release(tab, page) {
        onRelease(tab);
        page.close();
    }

    // Right after `node`, in its folder.
    function beside(node) {
        const parent = nodes.parentOf(node);
        return { parent, index: parent.children.indexOf(node) + 1 };
    }

    // A tab for `url`, its page made and listened to, in no folder yet.
    function tabOf(url, { id = nodes.newId(), title = '', icon = '' }) {
        const page = pageFor(url);
        page.element.style.visibility = 'hidden';
        area.prepend(page.element);
        const tab = {
            id,
            page,
            url: canonical(url),
            title,
            icon,
            loading: true,
            canGoBack: false,
            canGoForward: false,
            // The window name the page asked for, which a later request for the same name reuses.
            target: '',
            // The tab whose page opened this one.
            opener: null,
            audible: false,
            muted: false,
            capture: { microphone: false, camera: false, screen: false },
        };
        listen(tab);
        return tab;
    }

    // Every tab's page fills the area, one over another; only the front one is shown.
    function pageFor(url) {
        const page = web.page({ session: isFile(url) ? filesSession : webSession, url });
        Object.assign(page.element.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
        return page;
    }

    // Pages out of sight are hidden by visibility: a page element with nothing to draw into (display: none) comes
    // back blank or at the wrong size.
    function showCurrent() {
        for (const tab of nodes.items()) tab.page.element.style.visibility = tab === front ? 'visible' : 'hidden';
    }

    function changed() {
        onChange();
        persist();
    }

    function persist() {
        records.set('session', { tabs: nodes.root.children.map(recordOf), front: front.id, closed });
    }
}

// What the session record keeps of a node.
function recordOf(node) {
    if (!isFolder(node)) return { id: node.id, url: node.url, title: node.title, icon: node.icon };
    return { ...folderOf(node), children: node.children.map(recordOf) };
}

// What names a tab in a line: its title, else its file or site.
function tabLabel(tab) {
    return tab.title || placeOf(tab.url) || 'New tab';
}

module.exports = { tabList, tabLabel };
