const { DAY_MS, startOfDay } = require('../date/date.js');
const { occurrencesOf } = require('../occurrence/occurrence.js');
const { asksToSignIn } = require('../accounts/provider-client.js');
const { keyOf } = require('../accounts/store.js');

const CACHE_KEY = 'cache';
const REFRESH_INTERVAL = 10 * 60 * 1000;
const RETRY_MS = 60 * 1000;
// Two windows, as a provider answers the occurrences of a range: `now` is today and the fortnight the sidebar and the
// reminders need, always read; `view` is the screen with a margin, read only when `now` does not reach it.
const NOW_BEFORE = DAY_MS;
const NOW_AFTER = 17 * DAY_MS;
const VIEW_MARGIN = 35 * DAY_MS;

// What has been read, by calendar: { now, view, error, signIn, failedAt }. A failed read keeps what was read before
// it. `now` is cached across launches, because the first read after a launch often fails and the sidebar and the
// reminders stand on it; `view` is not. A range is the screen's, [from, to).
function readCache({ records, accounts, feeds, client, onChange, onRead }) {
    const record = new Map();
    const accountStatus = new Map(); // account id -> { loading, signedOut }
    let readAt = 0;
    let loading = false;
    // A forced read asked for while one runs waits for follow() after it: the running one was asked before the change.
    let again = false;

    for (const [key, readWindow] of Object.entries(records.get(CACHE_KEY, {}))) {
        if (feeds.all().some((feed) => keyOf(feed) === key))
            record.set(key, { now: revive(readWindow), view: null, error: null, failedAt: 0 });
    }

    return {
        of: (feed) => record.get(keyOf(feed)),
        has: (feed) => record.has(keyOf(feed)),
        isLoading: () => loading,
        readAt: () => readAt,
        isReading: (accountId) => statusOf(accountId).loading,
        isSignedOut: (accountId) => !!accountStatus.get(accountId)?.signedOut,
        refresh,
        follow,
        occurrences,
        dropFeed,
        dropAccount,
        setRsvp,
    };

    async function refresh(range, force = false) {
        const list = feeds.all();
        if (!list.length) {
            readAt = Date.now();
            onChange();
            return;
        }
        if (loading) {
            if (force) again = true;
            return;
        }
        const failing = list.some((feed) => {
            const entry = record.get(keyOf(feed));
            return entry?.error && !entry.signIn;
        });
        if (!force && Date.now() - readAt < (failing ? RETRY_MS : REFRESH_INTERVAL)) return;
        loading = true;
        again = false;
        try {
            for (const account of accounts.all())
                statusOf(account.id).loading = list.some((feed) => feed.account === account.id);
            onChange();
            await Promise.all(
                accounts.all().map((account) =>
                    readAccount(
                        account,
                        list.filter((feed) => feed.account === account.id),
                        range
                    )
                )
            );
            readAt = Date.now();
            save();
        } finally {
            loading = false;
            for (const account of accounts.all()) statusOf(account.id).loading = false;
        }
        onRead();
    }

    // Reads when a forced read waits, or a calendar has nothing for `range`. A calendar whose provider is not running
    // is left as it is: it is not read.
    function follow(range) {
        if (loading) return;
        const providing = new Set(
            accounts
                .all()
                .filter((account) => client.providerOf(account))
                .map((account) => account.id)
        );
        const uncovered = feeds
            .all()
            .some((feed) => providing.has(feed.account) && !covers(record.get(keyOf(feed)), range));
        if (again || uncovered) refresh(range, true);
    }

    // What `list` has between `from` and `to`, each with its calendar's colour and account, in the order drawn.
    function occurrences(list, from, to) {
        const out = [];
        for (const feed of list) {
            const entry = record.get(keyOf(feed));
            if (!entry) continue;
            for (const occurrence of eventsOf(entry)) {
                if (+occurrence.end > +from && +occurrence.start < +to) {
                    out.push({
                        ...occurrence,
                        color: feed.color,
                        account: feed.account,
                        remindAll: feeds.remindsAll(feed),
                    });
                }
            }
        }
        // Date first: all-day before timed holds only within one day.
        return out.sort(
            (first, second) =>
                startOfDay(first.start) - startOfDay(second.start) ||
                second.allDay - first.allDay ||
                first.start - second.start
        );
    }

    function dropFeed(key) {
        record.delete(key);
        save();
    }

    function dropAccount(id) {
        for (const key of [...record.keys()]) if (key.startsWith(id + '/')) record.delete(key);
        accountStatus.delete(id);
        save();
    }

    // Into both windows of every calendar of the account, until the next read says the same.
    function setRsvp(accountId, eventId, status) {
        for (const feed of feeds.all()) {
            if (feed.account !== accountId) continue;
            const entry = record.get(keyOf(feed));
            for (const readWindow of [entry?.now, entry?.view]) {
                for (const event of readWindow?.events || []) if (event.id === eventId) event.rsvp = status;
            }
        }
        save();
    }

    // An account whose provider is not running is not read: what was read stays until it is.
    async function readAccount(account, list, range) {
        const state = statusOf(account.id);
        if (!client.providerOf(account)) return;
        const nowRange = nowWindow(),
            viewRange = viewWindow(range);
        state.signedOut = false;
        const read = async (feed, [from, to]) => ({
            from,
            to,
            events: await client.events(account, feed.calendar, new Date(from), new Date(to)),
        });
        await Promise.all(
            list.map(async (feed) => {
                try {
                    const [now, view] = await Promise.all([
                        read(feed, nowRange),
                        viewRange ? read(feed, viewRange) : null,
                    ]);
                    record.set(keyOf(feed), { now, view, error: null, failedAt: 0 });
                } catch (error) {
                    if (asksToSignIn(error)) state.signedOut = true;
                    fail(feed, error);
                }
            })
        );
    }

    function fail(feed, error) {
        const before = record.get(keyOf(feed)) || { now: null, view: null };
        record.set(keyOf(feed), {
            now: before.now,
            view: before.view,
            error: String(error.message || error),
            signIn: asksToSignIn(error),
            failedAt: Date.now(),
        });
    }

    function covers(entry, range) {
        if (!entry) return false;
        // Signed out waits for a sign-in; any other failure is read again after RETRY_MS.
        if (entry.error && (entry.signIn || Date.now() - entry.failedAt < RETRY_MS)) return true;
        const screen = range.map(Number);
        return within(entry.now, nowWindow()) && (within(entry.now, screen) || within(entry.view, screen));
    }

    function viewWindow(range) {
        const [from, to] = range.map(Number);
        if (within({ from: nowWindow()[0], to: nowWindow()[1] }, [from, to])) return null;
        return [from - VIEW_MARGIN, to + VIEW_MARGIN];
    }

    function statusOf(accountId) {
        if (!accountStatus.has(accountId)) accountStatus.set(accountId, { loading: false, signedOut: false });
        return accountStatus.get(accountId);
    }

    // Written whole, so a calendar turned off or removed drops out.
    function save() {
        const out = {};
        for (const feed of feeds.all()) {
            const now = record.get(keyOf(feed))?.now;
            if (now) out[keyOf(feed)] = now;
        }
        records.set(CACHE_KEY, out);
    }
}

// The cache is a file, so a window that is not one is not read.
function revive(readWindow) {
    return Array.isArray(readWindow?.events)
        ? { from: readWindow.from, to: readWindow.to, events: occurrencesOf(readWindow.events) }
        : null;
}

function nowWindow() {
    const today = +startOfDay(new Date());
    return [today - NOW_BEFORE, today + NOW_AFTER];
}

function within(readWindow, [from, to]) {
    return !!readWindow && readWindow.from <= from && readWindow.to >= to;
}

function eventsOf(entry) {
    if (!entry.view) return entry.now?.events || [];
    const seen = new Set();
    return [...(entry.now?.events || []), ...entry.view.events].filter(
        (event) => !seen.has(event.id) && seen.add(event.id)
    );
}

module.exports = { readCache };
