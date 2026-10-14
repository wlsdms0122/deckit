// The accounts, and the calendars of each that are shown (feeds), in the mod's records so a reset profile keeps them.
// An account is `{ id, provider, email }`; a feed is `{ account, calendar, label, color, hidden, remindAll }`.
function store({ records }) {
    const accounts = {
        all: () => records.get('accounts', []).filter((account) => account && account.id && account.provider),
        save: (list) => records.set('accounts', list),
    };
    const feeds = {
        all() {
            const ids = new Set(accounts.all().map((account) => account.id));
            return records
                .get('feeds', [])
                .filter((feed) => feed && ids.has(feed.account) && typeof feed.calendar === 'string');
        },
        save: (list) => records.set('feeds', list),
        // A feed removed while its dialog was open stays removed.
        update(key, patch) {
            if (!feeds.all().some((feed) => keyOf(feed) === key)) return;
            feeds.save(feeds.all().map((feed) => (keyOf(feed) === key ? { ...feed, ...patch } : feed)));
        },
        // A feed without remindAll reminds for everything only when it is the account's own calendar.
        remindsAll: (feed) =>
            feed.remindAll ??
            accounts
                .all()
                .some(
                    (account) =>
                        account.id === feed.account && account.email.toLowerCase() === feed.calendar.toLowerCase()
                ),
    };
    return { accounts, feeds };
}

function keyOf(feed) {
    return feed.account + '/' + feed.calendar;
}

module.exports = { store, keyOf };
