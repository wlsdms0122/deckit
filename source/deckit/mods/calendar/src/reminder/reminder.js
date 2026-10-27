const { addDays, startOfDay, clockText } = require('../date/date.js');
const { nameOf, isSpanning } = require('../occurrence/occurrence.js');

// Minutes before a meeting it is announced; 0 is at the start.
const REMINDER_LEADS = [0, 1, 5, 10, 15, 30];
const DEFAULT_LEAD = 10;
// Fired once per occurrence and recorded in a file, so a restart before a meeting does not announce it again. The key
// carries the start time, so a moved meeting is announced anew.
const FIRED_KEY = 'notified';
// Chromium gives a background page timers once a minute at most, still inside every lead but "at start time".
const CHECK_MS = 30 * 1000;
const AT_START_GRACE_MS = 2 * 60 * 1000;

function leadText(lead) {
    return lead === null ? 'Off' : lead === 0 ? 'At start time' : `${lead} min before`;
}

// A notice before each meeting the person attends, as the configuration's `notify` says. `occurrences(from, to)`
// answers what reminds; `onOpen(date)` shows Calendar on that date. `stop()` ends the checks.
function reminder({ deckit, records, occurrences, onOpen }) {
    const { configuration } = deckit;
    // A notice still on its way, so a check does not send it again.
    const pending = new Set();

    configuration.on((key) => {
        if (key === 'notify') check();
    });
    const checking = setInterval(check, CHECK_MS);

    return { check, lead, attends, isDue, stop: () => clearInterval(checking) };

    function check() {
        const leadMinutes = lead();
        if (leadMinutes === null) return;
        const at = Date.now();
        const fired = records.get(FIRED_KEY, {});

        for (const occurrence of occurrences(startOfDay(new Date(at)), addDays(startOfDay(new Date(at)), 2))) {
            if (!isDue(occurrence, at, leadMinutes)) continue;
            const left = +occurrence.start - at;
            const key = occurrenceKey(occurrence);
            if (fired[key] || pending.has(key)) continue;
            pending.add(key);
            Promise.resolve(remind(occurrence, left))
                .then((shown) => {
                    if (shown) remember(key, +occurrence.start);
                })
                .catch(() => {})
                .finally(() => pending.delete(key));
        }
    }

    // The lead in minutes, or null when the person turned notices off. The configuration holds it as text.
    function lead() {
        const chosen = configuration.get('notify');
        if (chosen === 'off') return null;
        return REMINDER_LEADS.includes(Number(chosen)) ? Number(chosen) : DEFAULT_LEAD;
    }

    // A meeting the user was invited to and did not decline, or anything on a calendar set to notify for everything. A
    // colleague's calendar is there to be looked at, not to speak for the user.
    function attends(occurrence) {
        return occurrence.rsvp !== 'DECLINED' && (!!occurrence.rsvp || occurrence.remindAll);
    }

    // The notice and the switcher card both ask this, so they agree. Something already under way is not announced
    // late; "at start time" alone is allowed a grace after the start.
    function isDue(occurrence, at, leadMinutes) {
        if (leadMinutes === null || isSpanning(occurrence) || !attends(occurrence)) return false;
        const left = +occurrence.start - at;
        return left <= leadMinutes * 60000 && left > (leadMinutes === 0 ? -AT_START_GRACE_MS : 0);
    }

    function remind(occurrence, left) {
        const minutes = Math.round(left / 60000);
        return deckit.notify({
            title: nameOf(occurrence),
            body: `${minutes > 0 ? `in ${minutes} min` : 'now'} · ${clockText(occurrence.start)}`,
            onClick: () => onOpen(occurrence.start),
        });
    }

    // Recorded only once the notice was shown, so a notice that failed is tried again while still due.
    function remember(key, start) {
        const fired = records.get(FIRED_KEY, {});
        fired[key] = start;
        const cutoff = Date.now() - 24 * 3600000;
        for (const [firedKey, firedStart] of Object.entries(fired)) if (firedStart < cutoff) delete fired[firedKey];
        records.set(FIRED_KEY, fired);
    }
}

function occurrenceKey(occurrence) {
    return (occurrence.uid || occurrence.summary || '?') + '@' + +occurrence.start;
}

module.exports = { reminder, REMINDER_LEADS, DEFAULT_LEAD, leadText };
