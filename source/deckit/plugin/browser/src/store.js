const { canonical, placeOf } = require('./address.js');

// Bookmarks, trusted certificates and site permissions, in the plugin's records: the same in every window, and apart
// from the host app's profile. A bookmark is known by its canonical address, as a tab is, or the star stays dark on its
// own page and adds it twice.
function store({ records, onBookmarksChange }) {
    const bookmarks = {
        all: () => records.get('bookmarks', []),
        has: (url) => bookmarks.all().some((bookmark) => bookmark.url === canonical(url)),
        toggle({ url, title, icon }) {
            const address = canonical(url);
            if (bookmarks.has(address)) return bookmarks.remove(address);
            saveBookmarks([...bookmarks.all(), { url: address, label: title || placeOf(address) || address, icon }]);
        },
        add(url, label) {
            const address = canonical(url);
            if (bookmarks.has(address)) return;
            saveBookmarks([
                ...bookmarks.all(),
                { url: address, label: label || placeOf(address) || address, icon: '' },
            ]);
        },
        remove(url) {
            saveBookmarks(bookmarks.all().filter((bookmark) => bookmark.url !== url));
        },
        // `url` goes where `toUrl` is.
        move(url, toUrl) {
            const list = [...bookmarks.all()];
            const from = list.findIndex((bookmark) => bookmark.url === url);
            const to = list.findIndex((bookmark) => bookmark.url === toUrl);
            if (from < 0 || to < 0) return;
            list.splice(to, 0, ...list.splice(from, 1));
            saveBookmarks(list);
        },
        // False when the new address is another bookmark's: the star cannot tell two entries for one page apart.
        edit(url, { label, url: given }) {
            const address = canonical(given);
            if (address !== url && bookmarks.has(address)) return false;
            saveBookmarks(
                bookmarks.all().map((bookmark) => {
                    if (bookmark.url !== url) return bookmark;
                    // A new address makes the stored icon wrong, and the conventional one stands in.
                    return { url: address, label, icon: address === url ? bookmark.icon : '' };
                })
            );
            return true;
        },
    };

    // The main process refuses an unverifiable certificate by default and forgets every decision on exit, so the
    // accepted ones are kept here and replayed at startup. Kept with the fingerprint, so a swapped certificate asks
    // again.
    const certificates = {
        all: () => records.get('trusted', []),
        add(host, fingerprint) {
            const entry = { host, fingerprint };
            records.set('trusted', [...certificates.all().filter((certificate) => certificate.host !== host), entry]);
            return entry;
        },
    };

    // Kept and replayed the same way.
    const grants = {
        all: () => records.get('permissions', []),
        of: (origin) => grants.all().filter((grant) => grant.origin === origin),
        add(entries) {
            const had = new Set(grants.all().map(grantKey));
            records.set('permissions', [...grants.all(), ...entries.filter((grant) => !had.has(grantKey(grant)))]);
        },
        remove(entries) {
            const gone = new Set(entries.map(grantKey));
            records.set(
                'permissions',
                grants.all().filter((grant) => !gone.has(grantKey(grant)))
            );
        },
    };

    return { bookmarks, certificates, grants };

    function saveBookmarks(list) {
        records.set('bookmarks', list);
        onBookmarksChange();
    }
}

// One permission of one site, as one string.
function grantKey({ origin, permission }) {
    return origin + '|' + permission;
}

module.exports = { store, grantKey };
