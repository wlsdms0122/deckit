const { DAY_MS } = require('./date.js');

const NO_TITLE = '(no title)';

// Occurrences as a provider or the cache file gives them, read in the shape the rest reads by the rules of README.md.
function occurrencesOf(events) {
    return events
        .filter((event) => event && typeof event === 'object' && event.id != null)
        .map((event) => ({
            id: String(event.id),
            uid: String(event.uid ?? event.id),
            summary: textOf(event.summary),
            start: new Date(event.start),
            end: new Date(event.end),
            allDay: !!event.allDay,
            call:
                event.call && typeof event.call.url === 'string'
                    ? { name: textOf(event.call.name), url: event.call.url }
                    : null,
            rooms: Array.isArray(event.rooms) ? event.rooms.filter((room) => typeof room === 'string') : [],
            location: textOf(event.location),
            description: textOf(event.description),
            rsvp: textOf(event.rsvp),
            invited: !!event.invited,
        }))
        .filter((event) => !isNaN(event.start) && !isNaN(event.end));
}

function textOf(value) {
    return typeof value === 'string' ? value : '';
}

function nameOf(occurrence) {
    return occurrence.summary || NO_TITLE;
}

// All-day, or a day or longer: drawn as a bar.
function isSpanning(occurrence) {
    return occurrence.allDay || +occurrence.end - +occurrence.start >= DAY_MS;
}

module.exports = { occurrencesOf, nameOf, isSpanning };
