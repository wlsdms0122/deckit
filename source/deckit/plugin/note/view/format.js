const DAY_MS = 24 * 60 * 60 * 1000;
const CLOCK = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'long' });
const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const RELATIVE_DAY = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

// As short as the distance from today allows: the time today, the weekday this week, the date before.
function shortDate(time) {
    const days = daysBefore(time);
    if (days === 0) return CLOCK.format(time);
    if (days === 1) return capitalized(RELATIVE_DAY.format(-1, 'day'));
    if (days > 1 && days < 7) return WEEKDAY.format(time);
    return new Date(time).getFullYear() === new Date().getFullYear()
        ? MONTH_DAY.format(time)
        : MONTH_DAY_YEAR.format(time);
}

function longDate(time) {
    return `${MONTH_DAY_YEAR.format(time)} at ${CLOCK.format(time)}`;
}

// YYYY-MM-DD in the local time zone, where UTC may be on another day.
function localDate(time) {
    const date = new Date(time);
    const twoDigits = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

function daysBefore(time) {
    return Math.round((startOfDay(Date.now()) - startOfDay(time)) / DAY_MS);
}

function startOfDay(time) {
    const date = new Date(time);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function capitalized(text) {
    return text[0].toUpperCase() + text.slice(1);
}
