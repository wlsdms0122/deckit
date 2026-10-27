const { parseAddress, hostOf, placeOf } = require('./address/address.js');
const { bookmarkEditor } = require('./bookmark-editor/bookmark-editor.js');
const { candidatesOf, itemOf } = require('./candidates/candidates.js');
const { findInPage } = require('./find-in-page/find-in-page.js');
const { sitePrompter } = require('./site-prompter/site-prompter.js');
const { sidebar } = require('./sidebar/sidebar.js');
const { store } = require('./store/store.js');
const { switcher, inFront } = require('./switcher/switcher.js');
const { tabList, tabLabel } = require('./tabs/tab-list.js');
const { toolbar } = require('./toolbar/toolbar.js');

module.exports = {
    icon: `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
    keywords: ['브라우저', '웹', '인터넷', 'browser', 'web'],
    settings: {
        homepage: {
            label: 'Homepage',
            type: 'text',
            default: 'https://www.google.com/',
            hint: 'What a new tab opens.',
        },
        searchEngine: {
            label: 'Search engine',
            type: 'choice',
            default: 'https://www.google.com/search?q=',
            hint: 'Where words typed in the address bar are searched.',
            options: [
                { value: 'https://www.google.com/search?q=', label: 'Google' },
                { value: 'https://duckduckgo.com/?q=', label: 'DuckDuckGo' },
                { value: 'https://www.bing.com/search?q=', label: 'Bing' },
            ],
        },
    },

    start(deck) {
        const { theme, ui, storage, web, settings } = deck;
        const { values, records } = storage;

        let shown = false;

        // What floats over the page. The fill is translucent over a blur of the page: the element's opacity would let
        // the page's text show through.
        ui.addStyle(`
            .browser-floating {
                position: absolute;
                box-sizing: border-box;
                height: 36px;
                border: var(--deckit-border);
                border-radius: var(--deckit-radius-round);
                background: color-mix(in srgb, var(--deckit-background) 94%, transparent);
                backdrop-filter: blur(12px) saturate(1.4);
                box-shadow: var(--deckit-shadow-lifted);
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
        `);

        // Files get a session of their own (system.files), so a file page never holds the web's cookies.
        const webSession = web.session('web');
        const filesSession = web.session('files');
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
            onBack: goBack,
            onForward: goForward,
            onReload: reload,
            onSitePermissions: () => prompter.editSitePermissions(tabs.front().url),
            onBookmark: (star) => editor.show(tabs.front(), star),
            onSubmit: (text) =>
                tabs.navigate(
                    tabs.front(),
                    parseAddress(text) || settings.get('searchEngine') + encodeURIComponent(text)
                ),
        });
        const find = findInPage({ theme, ui, frontTab: () => tabs.front() });
        const tabs = tabList({
            web,
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
            onNotification: notify,
            onFound: (tab, result) => find.showCount(tab, result),
        });
        const sidePanel = sidebar({
            ui,
            chordOf: deck.chordOf,
            clipboard: deck.clipboard,
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
            onEditBookmark: (tab, row) => editor.show(tab, row),
        });

        area.append(find.element);
        content.append(bar.element, area);
        webSession.trust(certificates.all());
        webSession.allow(sitePermissions.all());
        tabs.restore();
        showBookmarks();

        deck.view({
            content,
            sidebar: sidePanel.element,
            didAppear() {
                shown = true;
                prompter.askPending(tabs.front());
            },
            didDisappear() {
                shown = false;
            },
        });

        deck.commands({
            'new-tab': {
                description: 'Opens a new tab, at the address given or the homepage.',
                params: { type: 'object', properties: { url: { type: 'string', title: 'Address' } } },
                run: ({ url } = {}) => newTab(url),
            },
            'reopen-tab': { description: 'Opens the tab closed last again, where it was.', run: reopenTab },
            'switch-to-tab': {
                description: 'Brings an open tab to the front.',
                params: {
                    type: 'object',
                    properties: { tab: { type: 'string', title: 'Tab' } },
                    required: ['tab'],
                },
                run: switchToTab,
                complete: (_param, partial) => candidatesOf(tabs.tree(), tabLabel, partial, deck.util),
            },
            'open-bookmark': {
                description: 'Opens a bookmark in a new tab.',
                params: {
                    type: 'object',
                    properties: { bookmark: { type: 'string', title: 'Bookmark' } },
                    required: ['bookmark'],
                },
                run: openBookmark,
                complete: (_param, partial) =>
                    candidatesOf(bookmarks.tree(), (each) => each.title || placeOf(each.url), partial, deck.util),
            },
        });

        deck.keys({
            newTab: { label: 'New Tab', key: 'mod+t', run: () => newTab() },
            reopenTab: { label: 'Reopen Closed Tab', key: 'mod+shift+t', run: reopenTab },
            find: { label: 'Find in Page', key: 'mod+f', run: openFind },
            closeTab: { label: 'Close Tab', key: 'mod+w', run: closeTab },
            address: { label: 'Edit Address', key: 'mod+l', run: editAddress },
            reload: { label: 'Reload', key: 'mod+r', run: reload },
            back: { label: 'Back', key: 'mod+[', run: goBack },
            forward: { label: 'Forward', key: 'mod+]', run: goForward },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { label: `Tab ${number}`, key: `mod+${number}`, run: () => showTab(number - 1) },
                ])
            ),
            lastTab: { label: 'Last Tab', key: 'mod+9', run: () => showTab(-1) },
        });

        deck.handleURL((url, { activates = true, target = '' } = {}) => {
            const address = parseAddress(url);
            if (!address) return false;
            if (activates) deck.show();
            tabs.open(address, { activates, target: String(target || '') });
            return true;
        });

        deck.extends.switcher({
            actions: switcher({
                ui,
                util: deck.util,
                tabs,
                bookmarks,
                show: deck.show,
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
            }),
        });

        function home() {
            return parseAddress(settings.get('homepage')) || 'about:blank';
        }

        function showTabs() {
            sidePanel.showTabs(tabs.tree(), tabs.front());
            showBar();
        }

        function showBookmarks() {
            sidePanel.showBookmarks(bookmarks.tree());
            showBar();
        }

        function showBar() {
            const tab = tabs.front();
            bar.show(tab, { bookmarked: bookmarks.has(tab.url) });
        }

        function newTab(url) {
            const address = url === undefined ? home() : parseAddress(url);
            if (!address) throw new Error(`${url} is not a web address`);
            tabs.add(address);
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

        // The bookmark editor stands by the star, which editing hides.
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

        function openFind() {
            find.show();
        }

        function notify(tab, notification) {
            const site = hostOf(tab.url);
            deck.notify({
                title: notification.title || site,
                body: notification.body ? notification.body + ' · ' + site : site,
                silent: notification.silent,
                onClick: () => {
                    if (!tabs.list().includes(tab)) return;
                    deck.show();
                    tabs.select(tab);
                    notification.click();
                },
            });
        }

        function notAnAddress(text) {
            ui.dialog({ title: 'Not a web address', message: text, confirmLabel: 'OK', cancelLabel: null });
        }
    },
};
