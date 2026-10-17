const { canonical, placeOf } = require('./address.js');
const { tree, isFolder, folderOf } = require('./tree.js');

// Bookmarks, trusted certificates and site permissions, in the mod's records: the same in every window, and apart
// from the host app's profile. The bookmarks are a tree of folders (`tree.js`), a bookmark `{ id, url, title, icon }`
// at its canonical address, as a tab is, so the star lights on its page. One address may be bookmarked in two folders.
function store({ records, onBookmarksChange }) {
    const bookmarkTree = tree(records.get('bookmarks', []));
    const bookmarks = {
        tree: () => bookmarkTree,
        has: (url) => bookmarkTree.items().some((bookmark) => bookmark.url === canonical(url)),
        // The star: a page bookmarked loses every bookmark of it, so the star goes dark; one not bookmarked is added at
        // the end of the top level.
        toggle({ url, title, icon }) {
            const address = canonical(url);
            const found = bookmarkTree.items().filter((bookmark) => bookmark.url === address);
            if (found.length) for (const bookmark of found) bookmarkTree.remove(bookmark);
            else bookmarkTree.insert(bookmarkOf(address, title, icon));
            save();
        },
        add(url, title) {
            bookmarkTree.insert(bookmarkOf(canonical(url), title, ''));
            save();
        },
        // A bookmark or a folder, with what it holds.
        remove(node) {
            bookmarkTree.remove(node);
            save();
        },
        // `index` in `parent`, read with the node still where it was.
        place(node, parent, index) {
            bookmarkTree.move(node, parent, index);
            save();
        },
        // A new address makes the stored icon wrong, and the conventional one stands in.
        edit(bookmark, { title, url }) {
            const address = canonical(url);
            Object.assign(bookmark, { title, url: address, icon: address === bookmark.url ? bookmark.icon : '' });
            save();
        },
        newFolder(parent = bookmarkTree.root, index = parent.children.length) {
            const folder = bookmarkTree.folder();
            bookmarkTree.insert(folder, parent, index);
            save();
            return folder;
        },
        // `change` is any of `title`, `color`, `collapsed`.
        changeFolder(folder, change) {
            Object.assign(folder, change);
            save();
        },
        // A tab, or a folder of tabs with what it holds, bookmarked at the end of `parent`.
        addTabs(node, parent = bookmarkTree.root) {
            const copy = (each) =>
                isFolder(each)
                    ? { ...folderOf(each), id: bookmarkTree.newId(), children: each.children.map(copy) }
                    : bookmarkOf(each.url, each.title, each.icon);
            bookmarkTree.insert(copy(node), parent);
            save();
        },
        // What it holds takes its place.
        ungroup(folder) {
            const { parent, index } = bookmarkTree.remove(folder);
            folder.children.forEach((node, at) => bookmarkTree.insert(node, parent, index + at));
            save();
        },
    };

    function bookmarkOf(url, title, icon) {
        return { id: bookmarkTree.newId(), url, title: title || placeOf(url) || url, icon };
    }

    // The main process refuses an unverifiable certificate by default and forgets every decision on exit, so the
    // accepted ones are kept here and replayed at startup. Kept with the fingerprint, so a swapped certificate asks
    // again.
    const certificates = {
        all: () => records.get('certificates', []),
        add(host, fingerprint) {
            const entry = { host, fingerprint };
            records.set('certificates', [
                ...certificates.all().filter((certificate) => certificate.host !== host),
                entry,
            ]);
            return entry;
        },
    };

    // Kept and replayed the same way.
    const sitePermissions = {
        all: () => records.get('site-permissions', []),
        of: (origin) => sitePermissions.all().filter((sitePermission) => sitePermission.origin === origin),
        add(entries) {
            const had = new Set(sitePermissions.all().map(sitePermissionKey));
            records.set('site-permissions', [
                ...sitePermissions.all(),
                ...entries.filter((sitePermission) => !had.has(sitePermissionKey(sitePermission))),
            ]);
        },
        remove(entries) {
            const gone = new Set(entries.map(sitePermissionKey));
            records.set(
                'site-permissions',
                sitePermissions.all().filter((sitePermission) => !gone.has(sitePermissionKey(sitePermission)))
            );
        },
    };

    return { bookmarks, certificates, sitePermissions };

    function save() {
        records.set('bookmarks', bookmarkTree.root.children);
        onBookmarksChange();
    }
}

// One permission of one site, as one string.
function sitePermissionKey({ origin, permission }) {
    return origin + '|' + permission;
}

module.exports = { store, sitePermissionKey };
