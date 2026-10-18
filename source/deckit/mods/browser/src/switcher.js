const { parseAddress, isWrittenAddress, placeOf } = require('./address.js');
const { tabLabel } = require('./tab-list.js');
const { folderLabel } = require('./tree.js');

// What the Browser offers the switcher: an address typed there, and its commands. Bookmarks and tabs are submenus of
// their own, so a long list does not bury every other mod; one in a folder is hinted with the folders it is in.
function switcher({ ui, show, bookmarks, tabTree, lastClosedTab, onNewTab, onReopenTab, onSelectTab }) {
    return { resolve, commands };

    // Only an address resolves: a search for any words would put a row above the ranked list on every keystroke. One
    // written with its scheme or as a path goes on top; a host guessed from a bare name ("README.md") goes below what
    // matches it, so a file or a note of that name comes first.
    function resolve(query) {
        const url = parseAddress(query);
        if (!url) return [];
        return [
            {
                fallback: !isWrittenAddress(query),
                label: 'Open ' + placeOf(url),
                hint: 'In a new tab',
                icon: ui.icon('window', { size: 16 }),
                run: () => {
                    show();
                    onNewTab(url);
                },
            },
        ];
    }

    function commands() {
        const lastClosed = lastClosedTab();
        return [
            {
                label: 'New Tab',
                icon: ui.icon('window', { size: 16 }),
                keywords: ['웹', '웹페이지', '열기', '주소', '새탭', 'url', 'open', 'web', 'address', 'new tab'],
                run: () => {
                    show();
                    onNewTab();
                },
            },
            ...(lastClosed
                ? [
                      {
                          label: 'Reopen Closed Tab',
                          hint: lastClosed.title || placeOf(lastClosed.url),
                          icon: ui.icon('window', { size: 16 }),
                          keywords: ['닫은탭', '다시열기', '복구', 'reopen', 'undo', 'closed tab'],
                          run: () => {
                              show();
                              onReopenTab();
                          },
                      },
                  ]
                : []),
            {
                label: 'Search Bookmarks',
                icon: ui.icon('bookmark', { size: 16 }),
                keywords: ['북마크', '즐겨찾기', 'bookmarks'],
                submenu: {
                    placeholder: 'Search bookmarks',
                    entries: () =>
                        bookmarks
                            .tree()
                            .items()
                            .map((bookmark) => ({
                                label: bookmark.title,
                                hint: hintOf(bookmarks.tree(), bookmark),
                                icon: ui.icon('bookmark'),
                                address: bookmark.url,
                                run: () => {
                                    show();
                                    onNewTab(bookmark.url);
                                },
                            })),
                },
            },
            {
                label: 'Search Tabs',
                icon: ui.icon('window', { size: 16 }),
                keywords: ['탭', 'tabs'],
                submenu: {
                    placeholder: 'Search open tabs',
                    entries: () =>
                        tabTree()
                            .items()
                            .map((tab) => ({
                                label: tabLabel(tab),
                                hint: hintOf(tabTree(), tab),
                                icon: ui.icon('window'),
                                address: tab.url,
                                run: () => {
                                    show();
                                    onSelectTab(tab);
                                },
                            })),
                },
            },
        ];
    }

    // The folders an item is in, from the outermost, then its file or site.
    function hintOf(tree, item) {
        const folders = tree.ancestorsOf(item).reverse();
        return [...folders.map(folderLabel), placeOf(item.url)].join(' / ');
    }
}

module.exports = { switcher };
