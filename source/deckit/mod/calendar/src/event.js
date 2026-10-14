/* The event every provider maps its own into, so nothing after the provider knows where an event
 * came from. One per occurrence:
 *   id           the provider's id for this occurrence; what an answer is sent to
 *   uid          the same meeting across occurrences and calendars; keys the reminders
 *   summary
 *   start, end   Dates; local midnights for an all-day event
 *   allDay
 *   call         { name, url } of the video call, or null
 *   rooms        names of the rooms booked
 *   location     as written, minus what `call` and `rooms` already say
 *   description  plain text, links kept as addresses
 *   rsvp         ACCEPTED | DECLINED | TENTATIVE | NEEDS-ACTION, or "" when not a guest
 *   invited      a guest who is not the organiser, so has an answer to give
 *
 * rsvp and invited are the account's own. Providers are in README.md.
 */

// A link ends where its sentence's punctuation starts, including a ")" the address never opened.
const trimUrl = (url) => {
    let trimmed = String(url);
    while (
        /[.,;:!?]$/.test(trimmed) ||
        (trimmed.endsWith(')') && trimmed.split('(').length < trimmed.split(')').length)
    ) {
        trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
};

const CALL_HOSTS = [
    [/^https:\/\/meet\.google\.com\//, 'Google Meet'],
    [/^https:\/\/([\w-]+\.)?zoom\.us\/(j|my|w)\//, 'Zoom'],
    [/^https:\/\/teams\.(microsoft|live)\.com\/(l\/meetup-join|meet)\//, 'Microsoft Teams'],
    [/^https:\/\/([\w-]+\.)?webex\.com\//, 'Webex'],
];
// Takes plain text: markup has to be read first (plainText), or an address keeps its `&amp;`.
const callInText = (...texts) => {
    for (const text of texts) {
        for (const raw of String(text || '').match(/https:\/\/[^\s<>"]+/g) || []) {
            const url = trimUrl(raw);
            const known = CALL_HOSTS.find(([pattern]) => pattern.test(url));
            if (known) return { name: known[1], url };
        }
    }
    return null;
};

// A DOMParser document never runs, so nothing in the markup executes.
const plainText = (html) => {
    if (!/<[a-z][\s\S]*>/i.test(html || '')) return html || '';
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    for (const lineBreak of parsed.querySelectorAll('br')) lineBreak.replaceWith('\n');
    for (const block of parsed.querySelectorAll('p, div, li, tr')) {
        block.prepend('\n');
        block.append('\n');
    }
    for (const link of parsed.querySelectorAll('a[href]')) {
        const words = link.textContent.trim(),
            href = link.getAttribute('href');
        link.replaceWith(!words || words === href || /^https?:\/\//.test(words) ? href : `${words} (${href})`);
    }
    return (parsed.body.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
};

const locationBesides = (location, rooms, call) => {
    const text = String(location || '').trim();
    if (!text || text === call?.url) return '';
    return text.split(/,\s*/).every((part) => rooms.includes(part.trim())) ? '' : text;
};

module.exports = { trimUrl, callInText, plainText, locationBesides };
