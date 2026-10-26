const { addDays, startOfDay, clockText, dayText } = require('../date/date.js');
const { nameOf, isSpanning } = require('../occurrence/occurrence.js');

// How far ahead the next meeting is still news: the rest of a working day, not tomorrow.
const NOW_HORIZON_MS = 6 * 3600000;

// What Calendar adds to the switcher through its point `switcher:actions`: an action for each view and for what its
// keys do, Go to Date, Add Calendar Account and Send a Test Notification, and the meeting on now and the next. Each
// action's value is `{ action, ...args }`, run by `does[action](args, { ready })`. `occurrences(from, to)` answers what
// the strip may show.
function switcher({ ui, modes, reminders, occurrences, show, does }) {
    return { list, now, search, run };

    function list() {
        const icon = ui.icon('layers', { size: 16 });
        return [
            ...modes.map(([view, label]) => ({
                label: label + ' View',
                icon,
                keywords: ['일간', '주간', '월간', '보기', 'view'],
                value: { action: 'show-view', view },
            })),
            { label: 'Go to Today', keywords: ['오늘', 'today'], value: { action: 'go-to-today' } },
            { label: 'Go to Date', keywords: ['날짜', 'date', 'day'], opens: true, value: { action: 'go-to-date' } },
            { label: 'Previous', value: { action: 'previous' } },
            { label: 'Next', value: { action: 'next' } },
            { label: 'Add Calendar Account…', keywords: ['계정', '추가', 'account'], value: { action: 'add-account' } },
            {
                label: 'Send a Test Notification',
                keywords: ['알림', 'notification', 'test'],
                value: { action: 'send-test' },
            },
        ];
    }

    // What is running, and what is next once the running one is past its midpoint (or nothing is running), and only
    // within NOW_HORIZON_MS.
    function now() {
        const at = new Date();
        const soon = new Date(+at + NOW_HORIZON_MS);
        const lead = reminders.lead();
        const timed = occurrences(startOfDay(at), addDays(startOfDay(at), 2)).filter(
            (occurrence) => !isSpanning(occurrence) && reminders.attends(occurrence)
        );

        const running = timed.find((occurrence) => +occurrence.start <= +at && +occurrence.end > +at);
        const next = timed.find((occurrence) => +occurrence.start > +at && +occurrence.start <= +soon);

        const card = (occurrence, live) => ({
            label: nameOf(occurrence),
            hint: live
                ? `In progress · until ${clockText(occurrence.end)}`
                : `${untilText(occurrence.start, at)} · ${clockText(occurrence.start)}`,
            icon: ui.icon('clock', { size: 16 }),
            // Asks for attention while the notice would be due, so the two say the same thing.
            attention: !live && reminders.isDue(occurrence, +at, lead),
            value: { action: 'go-to-date', date: dayText(occurrence.start) },
        });

        const out = [];
        if (running) out.push(card(running, true));
        const halfway = running ? +running.start + (+running.end - +running.start) / 2 : 0;
        if (next && (!running || +at >= halfway)) out.push(card(next, false));
        return out;
    }

    // Inside Go to Date, the day as typed.
    function search(query, within) {
        if (within?.action !== 'go-to-date' || !query) return [];
        return [{ label: query, hint: 'A day, as YYYY-MM-DD', value: { ...within, date: query } }];
    }

    // An action calls `ready()` once it has found it can be done, and the mod comes to the front then, so a refusal
    // is read under the switcher's list; one whose result goes on elsewhere does not call it.
    async function run({ action, ...args }) {
        const said = await does[action](args, { ready: show });
        return typeof said === 'string' ? said : null;
    }
}

// Under a minute says so, since "in 0 min" is a rounding artefact.
function untilText(when, from) {
    const minutes = Math.round((+when - +from) / 60000);
    if (minutes < 1) return 'in under a minute';
    if (minutes < 60) return `in ${minutes} min`;
    const hours = Math.floor(minutes / 60),
        rest = minutes % 60;
    return rest ? `in ${hours}h ${rest}m` : `in ${hours}h`;
}

// The actions of `does` done with the mod in front, each ready once its synchronous part, where a refusal throws,
// is past.
function inFront(does) {
    return Object.fromEntries(
        Object.entries(does).map(([name, run]) => [
            name,
            (args, { ready }) => {
                const doing = run(args);
                ready();
                return doing;
            },
        ])
    );
}

module.exports = { switcher, inFront };
