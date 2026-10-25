const { addressBar } = require('./address-bar/address-bar.js');
const { parseAddress, hostOf, placeOf } = require('./address/address.js');
const { bookmarkEditor } = require('./bookmark-editor/bookmark-editor.js');
const { candidatesOf, itemOf } = require('./candidates/candidates.js');
const { findInPage } = require('./find-in-page/find-in-page.js');
const { sitePrompter } = require('./site-prompter/site-prompter.js');
const { sidebar } = require('./sidebar/sidebar.js');
const { store } = require('./store/store.js');
const { switcher } = require('./switcher/switcher.js');
const { tabList, tabLabel } = require('./tabs/tab-list.js');

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
        const content = ui.element('div', {
            style: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
        });
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
        const bar = addressBar({
            theme,
            ui,
            values,
            area: content,
            onBack: goBack,
            onForward: goForward,
            onReload: reload,
            onSitePermissions: () => prompter.editSitePermissions(tabs.front().url),
            onBookmark: (star) => editor.show(tabs.front(), star),
            isEditingBookmark: editor.isOpen,
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
            area: content,
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
                bar.close();
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

        content.append(find.element, bar.element);
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
                label: 'New Tab',
                description: 'Opens a new tab, at the address given or the homepage.',
                keywords: ['웹', '웹페이지', '열기', '주소', '새탭', 'url', 'open', 'web', 'address', 'new tab'],
                params: { type: 'object', properties: { url: { type: 'string', title: 'Address' } } },
                run: ({ url } = {}, { activates }) => {
                    const address = url === undefined ? home() : parseAddress(url);
                    if (!address) throw new Error(`${url} is not a web address`);
                    if (activates) deck.show();
                    tabs.add(address);
                },
            },
            'reopen-tab': {
                label: 'Reopen Closed Tab',
                description: 'Opens the tab closed last again, where it was.',
                keywords: ['닫은탭', '다시열기', '복구', 'reopen', 'undo', 'closed tab'],
                run: (_args, { activates }) => {
                    if (!tabs.lastClosed()) throw new Error('No tab was closed');
                    if (activates) deck.show();
                    tabs.reopen();
                },
            },
            'close-tab': {
                label: 'Close Tab',
                description: 'Closes the tab in front.',
                run: () => tabs.close(tabs.front()),
            },
            'show-tab': {
                label: 'Show Tab',
                description: 'Brings the tab at an index to the front, counted from 0, or from the end when negative.',
                params: { type: 'object', properties: { index: { type: 'integer' } }, required: ['index'] },
                run: ({ index }, { activates }) => {
                    const tab = tabs.list().at(index);
                    if (!tab) throw new Error(`There is no tab at ${index}`);
                    if (activates) deck.show();
                    tabs.select(tab);
                },
            },
            'switch-to-tab': {
                label: 'Switch to Tab',
                description: 'Brings an open tab to the front.',
                keywords: ['탭', 'tabs'],
                params: {
                    type: 'object',
                    properties: { tab: { type: 'string', title: 'Tab' } },
                    required: ['tab'],
                },
                run: ({ tab }, { activates }) => {
                    const found = itemOf(tabs.tree(), tab);
                    if (!found) throw new Error(`There is no tab ${tab}`);
                    if (activates) deck.show();
                    tabs.select(found);
                },
                complete: (_param, partial) => candidatesOf(tabs.tree(), tabLabel, partial, deck.util),
            },
            'open-bookmark': {
                label: 'Open Bookmark',
                description: 'Opens a bookmark in a new tab.',
                keywords: ['북마크', '즐겨찾기', 'bookmarks'],
                params: {
                    type: 'object',
                    properties: { bookmark: { type: 'string', title: 'Bookmark' } },
                    required: ['bookmark'],
                },
                run: ({ bookmark }, { activates }) => {
                    const found = itemOf(bookmarks.tree(), bookmark);
                    if (!found) throw new Error(`There is no bookmark ${bookmark}`);
                    if (activates) deck.show();
                    tabs.add(found.url);
                },
                complete: (_param, partial) =>
                    candidatesOf(bookmarks.tree(), (each) => each.title || placeOf(each.url), partial, deck.util),
            },
            'find-in-page': showing({
                label: 'Find in Page',
                description: 'Opens the find bar over the page in front.',
                run: openFind,
            }),
            'edit-address': showing({
                label: 'Edit Address',
                description: 'Opens the address bar to type an address or words to search.',
                run: () => bar.edit(),
            }),
            reload: showing({ label: 'Reload', description: 'Loads the page in front again.', run: reload }),
            back: showing({ label: 'Back', description: 'Goes back in the history of the tab in front.', run: goBack }),
            forward: showing({
                label: 'Forward',
                description: 'Goes forward in the history of the tab in front.',
                run: goForward,
            }),
        });

        deck.keys({
            newTab: { command: 'new-tab', key: 'mod+t' },
            reopenTab: { command: 'reopen-tab', key: 'mod+shift+t' },
            find: { command: 'find-in-page', key: 'mod+f' },
            closeTab: { command: 'close-tab', key: 'mod+w' },
            address: { command: 'edit-address', key: 'mod+l' },
            reload: { command: 'reload', key: 'mod+r' },
            back: { command: 'back', key: 'mod+[' },
            forward: { command: 'forward', key: 'mod+]' },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { command: 'show-tab', args: { index: number - 1 }, label: `Tab ${number}`, key: `mod+${number}` },
                ])
            ),
            lastTab: { command: 'show-tab', args: { index: -1 }, label: 'Last Tab', key: 'mod+9' },
        });

        deck.handleURL((url, { activates = true, target = '' } = {}) => {
            const address = parseAddress(url);
            if (!address) return false;
            if (activates) deck.show();
            tabs.open(address, { activates, target: String(target || '') });
            return true;
        });

        deck.extend({ 'switcher:rows': switcher({ ui, lastClosedTab: () => tabs.lastClosed() }) });

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

        // The find bar takes the top right corner, or the top left when the address bar is there.
        function openFind() {
            find.show({ left: bar.isInTopRight() });
        }

        // A command that does `run` on screen: a person running it brings the Browser to the front.
        function showing({ label, description, run }) {
            return {
                label,
                description,
                run: (_args, { activates }) => {
                    if (activates) deck.show();
                    run();
                },
            };
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
