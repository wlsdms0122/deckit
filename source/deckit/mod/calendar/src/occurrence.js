const { DAY_MS } = require('./date.js');

const NO_TITLE = '(no title)';

// Occurrences as a provider or the cache file gives them, in the shape the rest reads (README.md): one without an id or
// a date is left out.
function occurrencesOf(events) {
    return events
        .filter((event) => event && typeof event === 'object' && event.id != null)
        .map((event) => ({
            id: String(event.id),
            uid: String(event.uid ?? event.id),
            summary: String(event.summary ?? ''),
            start: new Date(event.start),
            end: new Date(event.end),
            allDay: !!event.allDay,
            call:
                event.call && typeof event.call.url === 'string'
                    ? { name: String(event.call.name ?? ''), url: event.call.url }
                    : null,
            rooms: Array.isArray(event.rooms) ? event.rooms.map(String) : [],
            location: String(event.location ?? ''),
            description: String(event.description ?? ''),
            rsvp: typeof event.rsvp === 'string' ? event.rsvp : '',
            invited: !!event.invited,
        }))
        .filter((event) => !isNaN(event.start) && !isNaN(event.end));
}

function nameOf(occurrence) {
    return occurrence.summary || NO_TITLE;
}

// All-day, or a day or longer: drawn as a bar.
function isSpanning(occurrence) {
    return occurrence.allDay || +occurrence.end - +occurrence.start >= DAY_MS;
}

module.exports = { occurrencesOf, nameOf, isSpanning };
