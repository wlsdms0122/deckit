const { MONTHS, clockText, dayDelta } = require('./date.js');
const { nameOf, isSpanning } = require('./occurrence.js');
const { paintPast, paintDot, paintText } = require('./paint.js');

const RSVP_LABEL = { ACCEPTED: 'Going', DECLINED: 'Declined', TENTATIVE: 'Maybe', 'NEEDS-ACTION': 'No response' };
const RSVP_CHOICES = [
    ['ACCEPTED', 'Yes'],
    ['TENTATIVE', 'Maybe'],
    ['DECLINED', 'No'],
];

// The popover over what was clicked: one occurrence, or everything on a day of the month. The kit's popover, so Escape
// closes it before the panel. `onAnswer(occurrence, status)` sends an answer to an invitation and rejects when it was
// not sent.
function eventDetail({ ui, onAnswer, onClose }) {
    const popover = ui.popover({ onClose });

    return { show, showDay, close: () => popover.close(), isOpen: () => popover.isOpen() };

    function show(occurrence, anchor) {
        popover.element.textContent = '';
        const name = document.createElement('div');
        name.textContent = nameOf(occurrence);
        Object.assign(name.style, { font: '700 14.5px var(--deckit-font)', marginBottom: '4px' });
        const when = document.createElement('div');
        when.textContent = occurrence.allDay
            ? dayDelta(new Date(+occurrence.end - 1), occurrence.start) > 0
                ? `All day · ${occurrence.start.toDateString()} – ${new Date(+occurrence.end - 1).toDateString()}`
                : 'All day · ' + occurrence.start.toDateString()
            : `${occurrence.start.toDateString()} · ${clockText(occurrence.start)}–${clockText(occurrence.end)}`;
        when.style.opacity = '.65';
        popover.element.append(name, when);

        // An answer that cannot be changed here is said, unless it is the plain "going".
        if (!occurrence.invited && RSVP_LABEL[occurrence.rsvp] && occurrence.rsvp !== 'ACCEPTED') {
            const badge = document.createElement('span');
            badge.textContent = RSVP_LABEL[occurrence.rsvp];
            Object.assign(badge.style, {
                display: 'inline-block',
                marginTop: '6px',
                padding: '1px 8px',
                borderRadius: '10px',
                font: '11.5px var(--deckit-font)',
                border: '1px solid ' + occurrence.color,
                color: occurrence.color,
            });
            popover.element.appendChild(badge);
        }

        if (occurrence.call) {
            const join = document.createElement('a');
            join.href = occurrence.call.url;
            join.target = '_blank';
            join.rel = 'noreferrer';
            join.textContent = 'Join ' + occurrence.call.name;
            join.title = occurrence.call.url;
            Object.assign(join.style, {
                display: 'inline-block',
                padding: '3px 10px',
                borderRadius: '7px',
                background: 'var(--deckit-accent)',
                color: '#fff',
                textDecoration: 'none',
                font: '600 12.5px var(--deckit-font)',
            });
            popover.element.appendChild(detailLine('video', join));
        }
        if (occurrence.rooms?.length) popover.element.appendChild(detailLine('door', occurrence.rooms.join(', ')));
        if (occurrence.location) popover.element.appendChild(detailLine('mapPin', linkify(occurrence.location)));

        if (occurrence.description) {
            const box = linkify(occurrence.description.slice(0, 1200));
            Object.assign(box.style, {
                opacity: '.8',
                whiteSpace: 'pre-wrap',
                maxHeight: '180px',
                overflowY: 'auto',
                marginTop: '10px',
            });
            popover.element.appendChild(box);
        }

        if (occurrence.invited) {
            const foot = rsvpBar(occurrence);
            Object.assign(foot.style, {
                margin: '12px -14px -12px',
                padding: '10px 14px',
                borderTop: 'var(--deckit-border)',
            });
            popover.element.appendChild(foot);
        }
        popover.show(anchor);
    }

    // A month cell's overflow: everything that day, in one list.
    function showDay(day, occurrences, anchor) {
        popover.element.textContent = '';
        const name = document.createElement('div');
        name.textContent = `${MONTHS[day.getMonth()]} ${day.getDate()}`;
        Object.assign(name.style, { font: '700 14.5px var(--deckit-font)', marginBottom: '8px' });
        popover.element.appendChild(name);
        for (const occurrence of occurrences) {
            const line = document.createElement('div');
            Object.assign(line.style, {
                display: 'flex',
                alignItems: 'baseline',
                gap: '7px',
                padding: '3px 0',
                cursor: 'pointer',
            });
            const dot = document.createElement('span');
            Object.assign(dot.style, {
                flex: '0 0 auto',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: occurrence.color,
            });
            const time = document.createElement('span');
            time.textContent = isSpanning(occurrence) ? 'All day' : clockText(occurrence.start);
            Object.assign(time.style, {
                flex: '0 0 auto',
                minWidth: '50px',
                opacity: '.55',
                font: '12px var(--deckit-font)',
            });
            paintDot(dot, occurrence);
            const text = document.createElement('span');
            text.textContent = nameOf(occurrence);
            paintText(text, occurrence);
            line.append(dot, time, text);
            paintPast(line, occurrence);
            line.addEventListener('click', (event) => {
                event.stopPropagation();
                show(occurrence, anchor);
            });
            popover.element.appendChild(line);
        }
        popover.show(anchor);
    }

    function rsvpBar(occurrence) {
        const wrap = document.createElement('div');
        Object.assign(wrap.style, { marginBottom: '8px' });
        const row = document.createElement('div');
        Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px' });
        const question = document.createElement('span');
        question.textContent = 'Going?';
        Object.assign(question.style, { opacity: '.65', font: '12.5px var(--deckit-font)' });
        const note = document.createElement('div');
        Object.assign(note.style, {
            display: 'none',
            marginTop: '6px',
            color: 'var(--deckit-alert)',
            font: '12px var(--deckit-font)',
        });
        let answering = false;
        const answers = ui.segmented({
            items: RSVP_CHOICES.map(([answer, label]) => ({ key: answer, label })),
            value: occurrence.rsvp,
            size: 'small',
            accent: occurrence.color,
            onChange: async (answer) => {
                // A press while an answer is on its way is dropped.
                if (answering) return;
                answering = true;
                note.style.display = 'none';
                busy.style.display = 'inline-block';
                const before = occurrence.rsvp;
                occurrence.rsvp = answer;
                answers.set(answer);
                try {
                    await onAnswer(occurrence, answer);
                } catch (error) {
                    occurrence.rsvp = before;
                    answers.set(before);
                    note.textContent = String(error.message || error);
                    note.style.display = 'block';
                }
                answering = false;
                busy.style.display = 'none';
            },
        });
        const busy = ui.spinner({ size: 12 }).element;
        busy.style.display = 'none';
        row.append(question, answers.element, busy);
        wrap.append(row, note);
        return wrap;
    }

    function detailLine(iconName, value) {
        const line = document.createElement('div');
        Object.assign(line.style, { display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' });
        const icon = document.createElement('span');
        icon.innerHTML = ui.icon(iconName, { size: 14 });
        Object.assign(icon.style, { flex: '0 0 auto', marginTop: '2px', opacity: '.6' });
        if (typeof value === 'string') {
            const text = document.createElement('span');
            text.textContent = value;
            value = text;
        }
        value.style.minWidth = '0';
        value.style.wordBreak = 'break-word';
        line.append(icon, value);
        return line;
    }

    function linkify(text) {
        const box = document.createElement('div');
        const pattern = /https?:\/\/[^\s<>"]+/g;
        let last = 0,
            match;
        while ((match = pattern.exec(text))) {
            if (match.index > last) box.appendChild(document.createTextNode(text.slice(last, match.index)));
            const url = trimUrl(match[0]);
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noreferrer';
            link.textContent = url.length > 48 ? url.slice(0, 48) + '…' : url;
            Object.assign(link.style, { color: 'var(--deckit-accent)', wordBreak: 'break-all' });
            box.appendChild(link);
            last = match.index + url.length;
            pattern.lastIndex = last;
        }
        if (last < text.length) box.appendChild(document.createTextNode(text.slice(last)));
        ui.selectable(box);
        return box;
    }
}

// A link ends where its sentence's punctuation starts, including a ")" the address never opened.
function trimUrl(url) {
    let trimmed = url;
    while (
        /[.,;:!?]$/.test(trimmed) ||
        (trimmed.endsWith(')') && trimmed.split('(').length < trimmed.split(')').length)
    ) {
        trimmed = trimmed.slice(0, -1);
    }
    return trimmed;
}

module.exports = { eventDetail };
