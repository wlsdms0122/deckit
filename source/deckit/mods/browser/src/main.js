const { parseAddress, hostOf } = require('./address/address.js');
const { bookmarkEditor } = require('./bookmark-editor/bookmark-editor.js');
const { itemOf } = require('./candidates/candidates.js');
const { downloadList } = require('./downloads/downloads.js');
const { findInPage } = require('./find-in-page/find-in-page.js');
const { onScreen } = require('./screen/on-screen.js');
const { settingsOf } = require('./settings/settings.js');
const { sitePrompter } = require('./site-prompter/site-prompter.js');
const { sidebar } = require('./sidebar/sidebar.js');
const { startPage } = require('./start-page/start-page.js');
const { store } = require('./store/store.js');
const { switcher, inFront } = require('./switcher/switcher.js');
const { START, tabList } = require('./tabs/tab-list.js');
const { toolbar } = require('./toolbar/toolbar.js');
const { viewKeys } = require('./keys/keys.js');

// The sites' notifications kept for a press, the latest.
const NOTICES_KEPT = 100;

class Browser {
    // What the view has put on screen for the commands and the addresses to reach, while it is attached.
    screen = onScreen('Browser');

    // The commands its manifest declares to `deckit/commands`, and the `http` and `https` addresses it declares to
    // `deckit/urls`, each taken from the exports for its id and run on the view. A command run while the Browser has
    // no view open says so, and an address that comes then is passed on.
    start(deckit) {
        const commands = {
            'new-tab': async ({ url }) => (await this.screen.reach()).newTab(url),
            'reopen-tab': async () => (await this.screen.reach()).reopenTab(),
            'show-notification': async (args) => (await this.screen.reach()).showNotification(args),
            'switch-to-tab': async (args) => (await this.screen.reach()).switchToTab(args),
            'open-bookmark': async (args) => (await this.screen.reach()).openBookmark(args),
        };
        deckit.exports.register({
            connect: () => ({
                runCommand: async (id, args) => {
                    if (!Object.hasOwn(commands, id)) throw new Error(`Browser has no command ${id}`);
                    await commands[id](args ?? {});
                },
                openURL: async (url, { activates }) => {
                    const address = parseAddress(url);
                    if (!address) return false;
                    const screen = await this.screen.reach().catch(() => null);
                    return !!screen && screen.openURL(address, { activates });
                },
            }),
        });
    }

    attach(shell, deckit) {
        const { theme, ui } = shell;
        const { storage } = deckit;
        const { values, records } = storage;
        const settings = settingsOf();
        deckit.dependencies.onConnect('deckit/configuration', (configuration) => settings.connect(configuration));

        let shown = false;
        // The owner of deckit/notifications while one is connected, and the sites' notifications posted to it, by the
        // key a press names, the latest kept.
        let notifications = null;
        const notices = new Map();
        let noticeSequence = 0;
        deckit.dependencies.onConnect('deckit/notifications', (connected) => {
            notifications = connected;
            return () => (notifications = null);
        });

        // Files get a session of their own (system.files), so a file page never holds the web's cookies.
        const webSession = deckit.web.session('web');
        const filesSession = deckit.web.session('files');
        const { bookmarks, certificates, sitePermissions } = store({ records, onBookmarksChange: showBookmarks });
        const editor = bookmarkEditor({ ui, bookmarks });
        // The view is the toolbar over the area of pages.
        const content = ui.element('div', {
            style: { display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' },
        });
        const area = ui.element('div', { style: { position: 'relative', flex: '1 1 auto', overflow: 'hidden' } });
        const prompter = sitePrompter({
            ui,
            webSession,
            certificates,
            sitePermissions,
            isShown: () => shown,
            listTabs: () => tabs.list(),
            onAsk: (tab) => {
                if (tab !== tabs.front()) tabs.select(tab);
            },
        });
        const bar = toolbar({
            theme,
            ui,
            trailing: downloadList({ theme, ui, downloads: deckit.web.downloads }).element,
            onBack: goBack,
            onForward: goForward,
            onReload: reload,
            onSitePermissions: () => prompter.editSitePermissions(tabs.front().url),
            onBookmark: () => editor.show(tabs.front()),
            onSubmit: go,
        });
        const find = findInPage({ theme, ui, area, frontTab: () => tabs.front() });
        const start = startPage({ ui, onOpen: (bookmark) => go(bookmark.url) });
        const tabs = tabList({
            web: shell.web,
            records,
            area,
            webSession,
            filesSession,
            home,
            onChange: showTabs,
            onSelect: (tab, previous) => {
                if (tab !== previous) find.hide();
                prompter.askPending(tab);
            },
            onNavigate: () => prompter.clearAskedCertificates(),
            onRelease: (tab) => {
                prompter.release(tab);
                find.release(tab);
            },
            // A press in a page reaches this document only as the page taking the focus.
            onFocus: () => {
                editor.close();
            },
            onCertificateRefused: (info) => prompter.askCertificate(info),
            decidePermission: (tab, request) => prompter.askPermission(tab, request),
            shouldDownload: (tab, download) => prompter.askDownload(tab, download),
            onNotification: notify,
            onFound: (tab, result) => find.showCount(tab, result),
        });
        const sidePanel = sidebar({
            ui,
            chordOf: (name) => keys.chordOf(name),
            clipboard: deckit.clipboard,
            values,
            bookmarks,
            notAnAddress,
            onNewTab: (url, options) => tabs.add(url, options),
            onSelectTab: (tab) => tabs.select(tab),
            onCloseTab: (tab) => tabs.close(tab),
            onCloseOtherTabs: (tab) => tabs.closeOthers(tab),
            onPlaceTab: (node, parent, index) => tabs.place(node, parent, index),
            onNewTabFolder: (parent, index, node) => tabs.newFolder(parent, index, node),
            onChangeTabFolder: (folder, change) => tabs.changeFolder(folder, change),
            onUngroupTabs: (folder) => tabs.ungroup(folder),
            onCloseTabsIn: (folder) => tabs.closeTabsIn(folder),
            onDeleteTabFolder: (folder) => tabs.deleteFolder(folder),
            onOpenBookmark: (bookmark) => tabs.navigate(tabs.front(), bookmark.url),
            onOpenBookmarks: (node, parent) => tabs.openBookmarks(node, parent),
            onEditBookmark: (tab) => editor.show(tab),
        });

        area.append(start.element);
        content.append(bar.element, area);
        webSession.trust(certificates.all());
        webSession.allow(sitePermissions.all());
        tabs.restore();
        showBookmarks();

        // The view's own keys, while it is in front.
        const keys = viewKeys(
            {
                newTab: { key: 'mod+t', run: () => newTab() },
                reopenTab: { key: 'mod+shift+t', run: reopenTab },
                find: { key: 'mod+f', run: openFind },
                closeTab: { key: 'mod+w', run: closeTab },
                address: { key: 'mod+l', run: editAddress },
                reload: { key: 'mod+r', run: reload },
                back: { key: 'mod+[', run: goBack },
                forward: { key: 'mod+]', run: goForward },
                ...Object.fromEntries(
                    [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                        `tab${number}`,
                        { key: `mod+${number}`, run: () => showTab(number - 1) },
                    ])
                ),
                lastTab: { key: 'mod+9', run: () => showTab(-1) },
            },
            { log: 'browser' }
        );
        this.endKeys = () => keys.listen(false);

        shell.view.register({
            content,
            sidebar: sidePanel.element,
            didAppear() {
                shown = true;
                keys.listen(true);
                prompter.askPending(tabs.front());
            },
            didDisappear() {
                shown = false;
                keys.listen(false);
            },
        });

        const actions = switcher({
            ui,
            util: deckit.util,
            tabs,
            bookmarks,
            show: shell.show,
            does: inFront({
                'new-tab': ({ url }) => newTab(url),
                'reopen-tab': reopenTab,
                'switch-to-tab': switchToTab,
                'open-bookmark': openBookmark,
                'close-tab': closeTab,
                'find-in-page': openFind,
                'edit-address': editAddress,
                reload,
                back: goBack,
                forward: goForward,
            }),
        });
        deckit.dependencies.onConnect('switcher/actions', (quickSwitcher) => quickSwitcher.setActions(actions));
        this.screen.set({ newTab, reopenTab, showNotification, switchToTab, openBookmark, openURL });

        function home() {
            return parseAddress(settings.get('homepage')) || START;
        }

        function showTabs() {
            sidePanel.showTabs(tabs.tree(), tabs.front());
            start.setShown(tabs.atStart(tabs.front()));
            showBar();
        }

        function showBookmarks() {
            sidePanel.showBookmarks(bookmarks.tree());
            start.show(bookmarks.tree());
            showBar();
        }

        function showBar() {
            const tab = tabs.front();
            bar.show(tab, { bookmarked: bookmarks.has(tab.url) });
        }

        // One opened at no address given has its address edited.
        function newTab(url) {
            const address = url === undefined ? home() : parseAddress(url);
            if (!address) throw new Error(`${url} is not a web address`);
            tabs.add(address);
            if (url === undefined) editAddress();
        }

        function reopenTab() {
            if (!tabs.lastClosed()) throw new Error('No tab was closed');
            tabs.reopen();
        }

        function switchToTab({ tab }) {
            const found = itemOf(tabs.tree(), tab);
            if (!found) throw new Error(`There is no tab ${tab}`);
            tabs.select(found);
        }

        function openBookmark({ bookmark }) {
            const found = itemOf(bookmarks.tree(), bookmark);
            if (!found) throw new Error(`There is no bookmark ${bookmark}`);
            tabs.add(found.url);
        }

        // Counted from 0, or from the end when negative; a number past the last tab shows none.
        function showTab(index) {
            const tab = tabs.list().at(index);
            if (tab) tabs.select(tab);
        }

        function closeTab() {
            tabs.close(tabs.front());
        }

        // An address another mod asked to open, in a new tab, in front unless `activates` is false.
        function openURL(address, { activates }) {
            const front = activates !== false;
            if (front) shell.show();
            tabs.open(address, { activates: front });
            return true;
        }

        // The page goes to the address typed, or searches for the text, and takes the keyboard. Words typed before the
        // settings are read are searched nowhere.
        function go(text) {
            const tab = tabs.front();
            const address = parseAddress(text);
            const engine = settings.get('searchEngine');
            if (!address && !engine) return;
            tabs.navigate(tab, address || engine + encodeURIComponent(text));
            tab.page.focus();
        }

        // The address is edited with the bookmark editor gone.
        function editAddress() {
            editor.close();
            bar.edit();
        }

        function goBack() {
            tabs.front().page.back();
        }

        function goForward() {
            tabs.front().page.forward();
        }

        // A deliberate retry asks about a certificate again.
        function reload() {
            prompter.clearAskedCertificates();
            tabs.front().page.reload();
        }

        // A tab at the start has no page to find in.
        function openFind() {
            if (!tabs.atStart(tabs.front())) find.show();
        }

        // A site's notification, posted while an owner of deckit/notifications is connected and dropped while none is.
        async function notify(tab, notification) {
            if (!notifications) return;
            const site = hostOf(tab.url);
            const key = String(++noticeSequence);
            notices.set(key, notification);
            for (const old of [...notices.keys()].slice(0, -NOTICES_KEPT)) notices.delete(old);
            try {
                await notifications.post({
                    title: notification.title || site,
                    body: notification.body ? notification.body + ' · ' + site : site,
                    silent: notification.silent,
                    command: 'show-notification',
                    args: { tab: String(tab.id), notification: key },
                });
            } catch {
                notices.delete(key);
            }
        }

        // A press on a site's notification: its tab comes forward, and the site hears the press.
        function showNotification({ tab, notification }) {
            const found = tabs.list().find((each) => String(each.id) === tab);
            if (!found) throw new Error('The tab the notification came from is closed');
            shell.show();
            tabs.select(found);
            notices.get(notification)?.click();
            notices.delete(notification);
        }

        function notAnAddress(text) {
            ui.dialog({ title: 'Not a web address', message: text, confirmLabel: 'OK', cancelLabel: null });
        }
    }

    detach() {
        this.screen.set(null);
        this.endKeys?.();
        this.endKeys = null;
    }
}

module.exports = Browser;
