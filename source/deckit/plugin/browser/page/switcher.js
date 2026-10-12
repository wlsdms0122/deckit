// What the Browser offers the switcher: an address typed there, and its commands. Bookmarks and tabs are pages of
// their own, so a long list does not bury every other plugin.
function switcher({ ui, host, bookmarks, notAnAddress, listTabs, lastClosedTab, onNewTab, onReopenTab, onSelectTab }) {
    return { resolve, commands };

    // Only an address resolves: a search for any words would put a row above the ranked list on every keystroke.
    function resolve(query) {
        const url = parseAddress(query);
        if (!url) return [];
        return [
            {
                label: 'Open ' + placeOf(url),
                hint: 'In a new tab',
                icon: ui.icon('window', { size: 16 }),
                run: () => {
                    host.show();
                    onNewTab(url);
                },
            },
        ];
    }

    function commands() {
        const lastClosed = lastClosedTab();
        return [
            {
                label: 'New Tab…',
                icon: ui.icon('window', { size: 16 }),
                keywords: ['웹', '웹페이지', '열기', '주소', '새탭', 'url', 'open', 'web', 'address', 'new tab'],
                run: askNewTab,
            },
            ...(lastClosed
                ? [
                      {
                          label: 'Reopen Closed Tab',
                          hint: lastClosed.title || placeOf(lastClosed.url),
                          icon: ui.icon('window', { size: 16 }),
                          keywords: ['닫은탭', '다시열기', '복구', 'reopen', 'undo', 'closed tab'],
                          run: () => {
                              host.show();
                              onReopenTab();
                          },
                      },
                  ]
                : []),
            {
                label: 'Search Bookmarks',
                icon: ui.icon('bookmark', { size: 16 }),
                keywords: ['북마크', '즐겨찾기', 'bookmarks'],
                page: {
                    placeholder: 'Search bookmarks',
                    entries: () =>
                        bookmarks.all().map((bookmark) => ({
                            label: bookmark.label,
                            hint: placeOf(bookmark.url),
                            icon: ui.icon('bookmark'),
                            address: bookmark.url,
                            run: () => {
                                host.show();
                                onNewTab(bookmark.url);
                            },
                        })),
                },
            },
            {
                label: 'Search Tabs',
                icon: ui.icon('window', { size: 16 }),
                keywords: ['탭', 'tabs'],
                page: {
                    placeholder: 'Search open tabs',
                    entries: () =>
                        listTabs().map((tab) => ({
                            label: tabLabel(tab),
                            hint: placeOf(tab.url),
                            icon: ui.icon('window'),
                            address: tab.url,
                            run: () => {
                                host.show();
                                onSelectTab(tab);
                            },
                        })),
                },
            },
        ];
    }

    function askNewTab() {
        ui.dialog({
            title: 'New Tab',
            fields: [{ key: 'url', label: 'Address', placeholder: 'example.com' }],
            confirmLabel: 'Open',
            onConfirm: ({ url }) => {
                const text = url.trim();
                if (!text) return;
                const address = parseAddress(text);
                if (!address) return notAnAddress(text);
                host.show();
                onNewTab(address);
            },
        });
    }
}
