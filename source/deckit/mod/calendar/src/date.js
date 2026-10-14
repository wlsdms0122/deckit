const DAY_MS = 86400000;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];
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

// A difference in calendar days, so rounding absorbs daylight saving.
function dayDelta(later, earlier) {
    return Math.round((+startOfDay(later) - +startOfDay(earlier)) / DAY_MS);
}

module.exports = {
    DAY_MS,
    WEEKDAYS,
    WEEKDAYS_KO,
    MONTHS,
    startOfDay,
    addDays,
    startOfWeek,
    sameDay,
    clockText,
    dayDelta,
};
