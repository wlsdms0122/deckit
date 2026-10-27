const { addDays, startOfDay, startOfWeek, dayOf } = require('../date/date.js');
const { providerClient } = require('../accounts/provider-client.js');
const { readCache } = require('../read-cache/read-cache.js');
const { reminder } = require('../reminder/reminder.js');
const { store } = require('../accounts/store.js');

const MODES = [
    ['day', 'Day'],
    ['week', 'Week'],
    ['month', 'Month'],
];

// Calendar: the mode and the day it is on, what is read of the accounts' calendars, and the reminders, which the view
// (view.js) draws. An account is a provider's: a mod that extends the `accounts` point (README.md) signs it in, keeps
// what it signed in with, and reads its calendars. Calendar keeps which accounts there are and which of their
// calendars are shown. `screen()` is what the view has put on screen, or null: `changed()` draws again, `moved()`
// draws where the mode or the day moved to, `reveal()` brings Calendar forward, and `prompt(question)` asks in a
// dialog (provider-client.js).
function calendar({ deckit, accountsPoint, screen }) {
    const { values } = deckit.storage;
    // A failed write is shown on this mod's row in Settings.
    const records = {
        get: (key, fallback) => deckit.storage.records.get(key, fallback),
        set: (key, value) => deckit.storage.records.set(key, value).catch(() => {}),
    };

    let mode = MODES.some(([key]) => key === values.get('mode', '')) ? values.get('mode') : 'month';
    let cursor = startOfDay(new Date());

    const { accounts, feeds } = store({ records });
    const client = providerClient({
        deckit,
        records,
        accountsPoint,
        onSigningIn: changed,
        prompt: (question) => screen()?.prompt(question) ?? null,
    });
    const reads = readCache({ records, accounts, feeds, client, onChange: changed, onRead });
    const reminders = reminder({ deckit, records, occurrences: occurrencesBetween, onOpen: showDate });

    // A read decides for itself whether it is due, so asking every minute costs nothing.
    const reading = setInterval(() => {
        read();
        follow();
    }, 60 * 1000);

    // A provider that starts reads its accounts at once; one that ends leaves what was read.
    accountsPoint.onChange(() => {
        client.forgetWaiting();
        changed();
        read(true);
    });
    read();

    return {
        mode: () => mode,
        cursor: () => cursor,
        range: () => rangeOf(mode, cursor),
        accounts,
        feeds,
        reads,
        client,
        reminders,
        occurrencesBetween,
        shownBetween,
        read,
        follow,
        shift,
        goTo,
        goToToday,
        goToDate,
        showView,
        setMode,
        answer,
        ask: client.ask,
        commands: {
            'go-to-date': {
                description: 'Shows a day in the view on screen.',
                params: {
                    type: 'object',
                    properties: { date: { type: 'string', title: 'Date', description: 'A day, as YYYY-MM-DD.' } },
                    required: ['date'],
                },
                run: goToDate,
            },
            'show-view': {
                description: 'Shows the day, the week or the month view.',
                params: {
                    type: 'object',
                    properties: {
                        view: {
                            type: 'string',
                            title: 'View',
                            oneOf: MODES.map(([key, label]) => ({ const: key, title: label })),
                        },
                    },
                    required: ['view'],
                },
                run: showView,
            },
        },
        stop() {
            clearInterval(reading);
            reminders.stop();
        },
    };

    function changed() {
        screen()?.changed();
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
        reads.refresh(rangeOf(mode, cursor), force);
    }

    // Asked where the range moves, on the minute, and when a read ends, so a range moved to while it ran is read. Not
    // from a draw: the view puts a draw off while hidden, and the read must not be.
    function follow() {
        reads.follow(rangeOf(mode, cursor));
    }

    function onRead() {
        changed();
        reminders.check();
        follow();
    }

    function shift(by) {
        if (mode === 'day') cursor = addDays(cursor, by);
        else if (mode === 'week') cursor = addDays(cursor, 7 * by);
        else cursor = new Date(cursor.getFullYear(), cursor.getMonth() + by, 1);
        changed();
        follow();
    }

    function goToToday() {
        goTo(new Date());
    }

    function goToDate({ date }) {
        const day = dayOf(date);
        if (!day) throw new Error(`${date} is not a day written as YYYY-MM-DD`);
        goTo(day);
    }

    function showView({ view }) {
        if (!MODES.some(([key]) => key === view)) throw new Error(`Calendar has no ${view} view`);
        setMode(view);
    }

    // Keeps the mode the person chose; only a click on a day number in the grid asks for the day.
    function goTo(date, next) {
        cursor = startOfDay(date);
        setMode(next || mode);
    }

    function showDate(date) {
        screen()?.reveal();
        goTo(date);
    }

    function setMode(next) {
        mode = next;
        values.set('mode', next);
        screen()?.moved();
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

// The days on screen, [from, to).
function rangeOf(mode, cursor) {
    if (mode === 'day') return [cursor, addDays(cursor, 1)];
    if (mode === 'week') return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
    const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return [start, addDays(start, 42)];
}

module.exports = { calendar, MODES };
