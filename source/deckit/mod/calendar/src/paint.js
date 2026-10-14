// How an occurrence's answer and its being over show on what draws it.

// Applied to the whole entry, so the strike crosses the time and the title as one line.
function paintPast(element, occurrence) {
    if (+occurrence.end > Date.now()) return;
    // Multiplied: declined and tentative have dimmed themselves already, and past ones read fainter still.
    element.style.opacity = String(((parseFloat(element.style.opacity) || 1) * 0.55).toFixed(2));
    element.style.textDecoration = 'line-through';
}

// A filled bar or box: declined is struck out, an unanswered invite is hollow.
function paintSolid(element, occurrence) {
    if (occurrence.rsvp === 'DECLINED') {
        element.style.background = occurrence.color;
        element.style.opacity = '.4';
        element.style.textDecoration = 'line-through';
    } else if (occurrence.rsvp === 'NEEDS-ACTION') {
        element.style.background = 'transparent';
        element.style.border = '1.5px solid ' + occurrence.color;
        element.style.color = occurrence.color;
    } else if (occurrence.rsvp === 'TENTATIVE') {
        element.style.background = occurrence.color;
        element.style.opacity = '.62';
    }
}

function paintDot(dot, occurrence) {
    if (occurrence.rsvp === 'NEEDS-ACTION') {
        dot.style.background = 'transparent';
        dot.style.border = '1.5px solid ' + occurrence.color;
        dot.style.boxSizing = 'border-box';
    } else if (occurrence.rsvp === 'TENTATIVE') {
        dot.style.opacity = '.55';
    }
}

function paintText(element, occurrence) {
    if (occurrence.rsvp === 'DECLINED') {
        element.style.textDecoration = 'line-through';
        element.style.opacity = '.5';
    }
}

module.exports = { paintPast, paintSolid, paintDot, paintText };
