const { addressBar } = require('./address-bar.js');
const { parseAddress, hostOf } = require('./address.js');
const { findInPage } = require('./find-in-page.js');
const { prompts } = require('./prompts.js');
const { sidebar } = require('./sidebar.js');
const { store } = require('./store.js');
const { switcher } = require('./switcher.js');
const { tabs } = require('./tabs.js');

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
        const { bookmarks, certificates, grants } = store({ records, onBookmarksChange: showBookmarks });
        const content = ui.element('div', {
            style: { position: 'relative', width: '100%', height: '100%', overflow: 'hidden' },
        });
        const sitePrompts = prompts({
            ui,
            webSession,
            certificates,
            grants,
            isShown: () => shown,
            listTabs: () => openTabs.list(),
            onAsk: (tab) => {
                if (tab !== openTabs.active()) openTabs.select(tab);
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
            onSitePermissions: () => sitePrompts.editSitePermissions(openTabs.active().url),
            onBookmark: () => bookmarks.toggle(openTabs.active()),
            onSubmit: (text) =>
                openTabs.navigate(
                    openTabs.active(),
                    parseAddress(text) || settings.get('searchEngine') + encodeURIComponent(text)
                ),
        });
        const find = findInPage({ theme, ui, activeTab: () => openTabs.active() });
        const openTabs = tabs({
            web,
            records,
            area: content,
            webSession,
            filesSession,
            home,
            onChange: showTabs,
            onSelect: (tab, previous) => {
                if (tab !== previous) find.hide();
                sitePrompts.askPending(tab);
            },
            onNavigate: () => sitePrompts.clearAskedCertificates(),
            onRelease: (tab) => {
                sitePrompts.release(tab);
                find.release(tab);
            },
            // A press in a page reaches this document only as the page taking the focus.
            onFocus: () => bar.close(),
            onCertificateRefused: (info) => sitePrompts.askCertificate(info),
            decidePermission: (tab, request) => sitePrompts.askPermission(tab, request),
            onNotification: notify,
            onFound: (tab, result) => find.showCount(tab, result),
        });
        const sidePanel = sidebar({
            theme,
            ui,
            chordOf: deck.chordOf,
            clipboard: deck.clipboard,
            values,
            bookmarks,
            notAnAddress,
            onNewTab: (url, options) => openTabs.add(url, options),
            onSelectTab: (tab) => openTabs.select(tab),
            onCloseTab: (tab) => openTabs.close(tab),
            onPlaceTab: (tab, target, after) => openTabs.placeTab(tab, target, after),
            onPlaceGroup: (group, target, after) => openTabs.placeGroup(group, target, after),
            onCloseOtherTabs: (tab) => openTabs.closeOthers(tab),
            onNewGroup: (tab) => sidePanel.renameGroup(openTabs.newGroup(tab)),
            onJoinGroup: (tab, group) => openTabs.join(tab, group),
            onLeaveGroup: (tab) => openTabs.leave(tab),
            onChangeGroup: (group, change) => openTabs.changeGroup(group, change),
            onUngroup: (group) => openTabs.ungroup(group),
            onCloseGroup: (group) => openTabs.closeGroup(group),
            onOpenBookmark: (bookmark) => openTabs.navigate(openTabs.active(), bookmark.url),
        });
        const { resolve, commands } = switcher({
            ui,
            show: deck.show,
            bookmarks,
            listTabs: () => openTabs.list(),
            lastClosedTab: () => openTabs.lastClosed(),
            onNewTab: (url) => openTabs.add(url),
            onReopenTab: () => openTabs.reopen(),
            onSelectTab: (tab) => openTabs.select(tab),
        });

        content.append(find.element, bar.element);
        webSession.trust(certificates.all());
        webSession.allow(grants.all());
        openTabs.restore();
        showBookmarks();

        deck.view({
            content,
            sidebar: sidePanel.element,
            didAppear() {
                shown = true;
                sitePrompts.askPending(openTabs.active());
            },
            didDisappear() {
                shown = false;
            },
        });

        deck.keys({
            newTab: { key: 'mod+t', label: 'New tab', run: () => openTabs.add() },
            reopenTab: { key: 'mod+shift+t', label: 'Reopen closed tab', run: () => openTabs.reopen() },
            find: { key: 'mod+f', label: 'Find in page', run: openFind },
            closeTab: { key: 'mod+w', label: 'Close tab', run: () => openTabs.close(openTabs.active()) },
            address: { key: 'mod+l', label: 'Address', run: () => bar.edit() },
            reload: { key: 'mod+r', label: 'Reload', run: reload },
            back: { key: 'mod+[', label: 'Back', run: goBack },
            forward: { key: 'mod+]', label: 'Forward', run: goForward },
            ...Object.fromEntries(
                [1, 2, 3, 4, 5, 6, 7, 8].map((number) => [
                    `tab${number}`,
                    { key: `mod+${number}`, label: `Tab ${number}`, run: () => selectTab(number - 1) },
                ])
            ),
            lastTab: { key: 'mod+9', label: 'Last tab', run: () => selectTab(openTabs.list().length - 1) },
        });

        // `target` is the window the page named: a second request for it reuses the tab that answered the first.
        deck.handleURL((url, { activates = true, target = '' } = {}) => {
            const address = parseAddress(url);
            if (!address) return false;
            const name = String(target || '');
            const named = name && openTabs.list().find((tab) => tab.target === name);
            if (activates) deck.show();
            if (named) {
                openTabs.navigate(named, address);
                if (activates) openTabs.select(named);
                return true;
            }
            openTabs.add(address, { background: !activates }).target = name;
            return true;
        });

        deck.resolve(resolve);
        deck.commands(commands);

        function home() {
            return parseAddress(settings.get('homepage')) || 'about:blank';
        }

        function showTabs() {
            sidePanel.showTabs(openTabs.list(), openTabs.active(), openTabs.groupOf);
            showBar();
        }

        function showBookmarks() {
            sidePanel.showBookmarks(bookmarks.all());
            showBar();
        }

        function showBar() {
            const tab = openTabs.active();
            bar.show(tab, { bookmarked: bookmarks.has(tab.url) });
        }

        function goBack() {
            openTabs.active().page.back();
        }

        function goForward() {
            openTabs.active().page.forward();
        }

        // A deliberate retry asks about a certificate again.
        function reload() {
            sitePrompts.clearAskedCertificates();
            openTabs.active().page.reload();
        }

        // The find bar takes the top right corner, or the top left when the address bar is there.
        function openFind() {
            find.show({ left: bar.isInTopRight() });
        }

        function selectTab(index) {
            const tab = openTabs.list()[index];
            if (tab) openTabs.select(tab);
        }

        function notify(tab, notification) {
            const site = hostOf(tab.url);
            deck.notify({
                title: notification.title || site,
                body: notification.body ? notification.body + ' · ' + site : site,
                silent: notification.silent,
                onClick: () => {
                    if (!openTabs.list().includes(tab)) return;
                    deck.show();
                    openTabs.select(tab);
                    notification.click();
                },
            });
        }

        function notAnAddress(text) {
            ui.dialog({ title: 'Not a web address', message: text, confirmLabel: 'OK', cancelLabel: 'Close' });
        }
    },
};
