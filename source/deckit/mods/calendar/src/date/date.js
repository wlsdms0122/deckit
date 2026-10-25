const DAY_MS = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
];

function startOfDay(date) {
    const day = new Date(date);
    day.setHours(0, 0, 0, 0);
    return day;
}

function addDays(date, count) {
    const day = new Date(date);
    day.setDate(day.getDate() + count);
    return day;
}

function startOfWeek(date) {
    return addDays(startOfDay(date), -startOfDay(date).getDay());
}

function sameDay(first, second) {
    return (
        first.getFullYear() === second.getFullYear() &&
        first.getMonth() === second.getMonth() &&
        first.getDate() === second.getDate()
    );
}

function clockText(date) {
    return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

// A day as `YYYY-MM-DD`, in local time.
function dayText(date) {
    const pad = (number) => String(number).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The local midnight of a day written as `YYYY-MM-DD`, or null for a text that names no day.
function dayOf(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text).trim());
    if (!match) return null;
    const [year, month, date] = match.slice(1).map(Number);
    const day = new Date(year, month - 1, date);
    return day.getMonth() === month - 1 && day.getDate() === date ? day : null;
}

// A difference in calendar days, so rounding absorbs daylight saving.
function dayDelta(later, earlier) {
    return Math.round((+startOfDay(later) - +startOfDay(earlier)) / DAY_MS);
}

module.exports = {
    DAY_MS,
    WEEKDAYS,
    MONTHS,
    startOfDay,
    addDays,
    startOfWeek,
    sameDay,
    clockText,
    dayText,
    dayOf,
    dayDelta,
};
