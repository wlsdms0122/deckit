const { providerClient } = require('../accounts/provider-client.js');
const { readCache } = require('../read-cache/read-cache.js');
const { reminder } = require('../reminder/reminder.js');
const { store } = require('../accounts/store.js');

// Calendar: what is read of the accounts' calendars, and the reminders. An account is a provider's: a mod that sets a
// provider through Calendar's exports (README.md) signs it in, keeps what it signed in with, and reads its calendars.
// Calendar keeps which accounts there are and which of their calendars are shown. It reads the `now` window the
// sidebar and the reminders stand on (read-cache.js), and the days the view shows while one says so through
// `follow(range)`. `screen()` is what the view (view.js) has put on screen, or null: `changed()` draws again,
// `showDate(date)` brings Calendar forward on that day, and `prompt(question)` asks in a dialog (provider-client.js).
function calendar({ deckit, screen }) {
    // A failed write is shown on this mod's row in Settings.
    const records = {
        get: (key, fallback) => deckit.storage.records.get(key, fallback),
        set: (key, value) => deckit.storage.records.set(key, value).catch(() => {}),
    };

    // The days the view shows, [from, to), or null where none shows any.
    let shown = null;

    const { accounts, feeds } = store({ records });
    const client = providerClient({
        records,
        onSigningIn: changed,
        prompt: (question) => screen()?.prompt(question) ?? null,
    });
    const reads = readCache({ records, accounts, feeds, client, onChange: changed, onRead });
    const reminders = reminder({
        deckit,
        records,
        occurrences: occurrencesBetween,
        onOpen: (date) => screen()?.showDate(date),
    });

    // A read decides for itself whether it is due, so asking every minute costs nothing.
    const reading = setInterval(() => {
        read();
        follow();
    }, 60 * 1000);

    read();

    return {
        accounts,
        feeds,
        reads,
        client,
        reminders,
        occurrencesBetween,
        shownBetween,
        read,
        follow,
        answer,
        setProvider,
        dropProvider,
        stop() {
            clearInterval(reading);
            reminders.stop();
        },
    };

    function changed() {
        screen()?.changed();
    }

    // A provider that comes reads its accounts at once; one that goes leaves what was read.
    function setProvider(connection, provider) {
        client.setProvider(connection, provider);
        providersChanged();
    }

    function dropProvider(connection) {
        if (client.dropProvider(connection)) providersChanged();
    }

    function providersChanged() {
        client.forgetWaiting();
        changed();
        read(true);
    }

    // Every calendar's, hidden ones too: hiding a calendar takes it off the screen, and it still reminds.
    function occurrencesBetween(from, to) {
        return reads.occurrences(feeds.all(), from, to);
    }

    function shownBetween(from, to) {
        return reads.occurrences(
            feeds.all().filter((feed) => !feed.hidden),
            from,
            to
        );
    }

    function read(force = false) {
        reads.refresh(shown, force);
    }

    // The view calls it with the days it shows as they move, and with null as it goes. Asked too on the minute and
    // when a read ends, so a range moved to while it ran is read. Not from a draw: the view puts a draw off while
    // hidden, and the read must not be.
    function follow(range = shown) {
        shown = range;
        reads.follow(shown);
    }

    function onRead() {
        changed();
        reminders.check();
        follow();
    }

    async function answer(occurrence, status) {
        const account = accounts.all().find((candidate) => candidate.id === occurrence.account);
        if (!account) throw new Error('That account is gone');
        await client.respond(account, occurrence.id, status);
        reads.setRsvp(account.id, occurrence.id, status);
        changed();
    }
}

module.exports = { calendar };
