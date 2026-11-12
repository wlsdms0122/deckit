// How an occurrence's answer and its being over show on what draws it. Each has a mark of its own: one over fades as
// a whole; a declined one is struck out on a pale step of its colour; a tentative one sits on a lighter step; an
// unanswered invite is hollow.

// The pale step of `colour` a declined or tentative occurrence sits on, `amount` of it over the background.
function stepOf(colour, amount) {
    return `color-mix(in srgb, ${colour} ${amount}%, var(--deckit-background))`;
}

// Applied to the whole entry, so it fades as one, time and title with it. One not over yet keeps when it ends, for
// pastNow to paint it as the clock passes it.
function paintPast(element, occurrence) {
    if (+occurrence.end > Date.now()) {
        element.dataset.ends = String(+occurrence.end);
        return;
    }
    element.style.opacity = '.55';
}

// What has ended since it was drawn, under `root`, painted past in place.
function paintPastNow(root) {
    const now = Date.now();
    for (const element of root.querySelectorAll('[data-ends]')) {
        if (+element.dataset.ends > now) continue;
        delete element.dataset.ends;
        paintPast(element, { end: now });
    }
}

// A filled bar or box.
function paintSolid(element, occurrence) {
    if (occurrence.rsvp === 'DECLINED') {
        element.style.background = stepOf(occurrence.color, 25);
        element.style.color = 'var(--deckit-muted)';
        element.style.textDecoration = 'line-through';
    } else if (occurrence.rsvp === 'NEEDS-ACTION') {
        element.style.background = 'transparent';
        element.style.border = '1.5px solid ' + occurrence.color;
        element.style.color = occurrence.color;
    } else if (occurrence.rsvp === 'TENTATIVE') {
        element.style.background = stepOf(occurrence.color, 55);
        element.style.color = 'var(--deckit-text)';
    }
}

function paintDot(dot, occurrence) {
    if (occurrence.rsvp === 'NEEDS-ACTION') {
        dot.style.background = 'transparent';
        dot.style.border = '1.5px solid ' + occurrence.color;
        dot.style.boxSizing = 'border-box';
    } else if (occurrence.rsvp === 'TENTATIVE') {
        dot.style.background = stepOf(occurrence.color, 55);
    } else if (occurrence.rsvp === 'DECLINED') {
        dot.style.background = stepOf(occurrence.color, 25);
    }
}

function paintText(element, occurrence) {
    if (occurrence.rsvp === 'DECLINED') {
        element.style.textDecoration = 'line-through';
        element.style.color = 'var(--deckit-muted)';
    }
}

module.exports = { paintPast, paintPastNow, paintSolid, paintDot, paintText };
