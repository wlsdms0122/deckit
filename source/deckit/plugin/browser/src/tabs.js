const { canonical, isFile, placeOf } = require('./address.js');

// The open tabs, each with its page, and the session record that brings them back. A web address opens in the web
// session and a file in the files session.
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

    const saved = records.get('session', { tabs: [], active: 0, closed: [] });
    const list = [];
    const closed = [...saved.closed];
    let current = null;
    let lastId = 0;

    return {
        list: () => list,
        active: () => current,
        lastClosed: () => closed.at(-1),
        add,
        select,
        navigate,
        close,
        closeOthers,
        reopen,
        move,
        restore,
    };

    function restore() {
        if (!saved.tabs.length) return add();
        const restored = saved.tabs.map(({ url, title, icon }) => add(url, { title, icon }));
        select(restored[saved.active]);
    }

    function add(url = home(), { title = '', icon = '', background = false } = {}) {
        const page = pageFor(url);
        page.element.style.visibility = 'hidden';
        area.prepend(page.element);
        const tab = {
            id: ++lastId,
            page,
            url: canonical(url),
            title,
            icon,
            loading: true,
            canGoBack: false,
            canGoForward: false,
            // The window name the page asked for, which a later request for the same name reuses.
            target: '',
            audible: false,
            muted: false,
            capture: { microphone: false, camera: false, screen: false },
        };
        list.push(tab);
        listen(tab);
        if (background) changed();
        else select(tab);
        return tab;
    }

    function select(tab) {
        const previous = current;
        current = tab;
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
        if (at !== tab) move(tab.id, at.id);
    }

    // The tab `id` goes where the tab `toId` is.
    function move(id, toId) {
        const from = list.findIndex((tab) => tab.id === id);
        const to = list.findIndex((tab) => tab.id === toId);
        if (from < 0 || to < 0) return;
        list.splice(to, 0, list.splice(from, 1)[0]);
        changed();
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
            tabs: list.map(({ url, title, icon }) => ({ url, title, icon })),
            active: Math.max(0, list.indexOf(current)),
            closed,
        });
    }
}

// What names a tab in a line: its title, else its file or site.
function tabLabel(tab) {
    return tab.title || placeOf(tab.url) || 'New tab';
}

module.exports = { tabs, tabLabel };
