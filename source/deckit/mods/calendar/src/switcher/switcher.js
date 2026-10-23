const { addDays, startOfDay, clockText } = require('../date/date.js');
const { nameOf, isSpanning } = require('../occurrence/occurrence.js');

// How far ahead the next meeting is still news: the rest of a working day, not tomorrow.
const NOW_HORIZON_MS = 6 * 3600000;

// What Calendar offers the switcher: the meeting on now and the next, and its commands. `occurrences(from, to)` answers
// what the strip may show.
function switcher({ ui, show, modes, reminders, occurrences, onGoTo, onMode, onAddAccount }) {
    return { now, commands };

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
            icon: ui.icon('clock', { size: 18 }),
            // Asks for attention while the notice would be due, so the two say the same thing.
            attention: !live && reminders.isDue(occurrence, +at, lead),
            run: () => {
                show();
                onGoTo(occurrence.start);
            },
        });

        const out = [];
        if (running) out.push(card(running, true));
        const halfway = running ? +running.start + (+running.end - +running.start) / 2 : 0;
        if (next && (!running || +at >= halfway)) out.push(card(next, false));
        return out;
    }

    function commands() {
        return [
            {
                label: 'Go to Today',
                icon: ui.icon('calendarDays'),
                keywords: ['오늘', 'today'],
                run: () => {
                    show();
                    onGoTo(new Date());
                },
            },
            ...modes.map(([key, label]) => ({
                label: label + ' View',
                icon: ui.icon('layers'),
                keywords: [{ day: '일간', week: '주간', month: '월간' }[key], '보기', 'view'],
                run: () => {
                    show();
                    onMode(key);
                },
            })),
            {
                label: 'Add Calendar Account…',
                icon: ui.icon('plus'),
                keywords: ['계정', '추가', 'account'],
                run: () => {
                    show();
                    onAddAccount();
                },
            },
        ];
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

module.exports = { switcher };
