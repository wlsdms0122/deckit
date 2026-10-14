const { clockText, dayDelta } = require('./date.js');
const { nameOf } = require('./occurrence.js');
const { paintPast, paintSolid, paintDot, paintText } = require('./paint.js');

// Occurrences as bars on a row of days, each bar in a lane: the month's weeks and the all-day strip of the time grid.
const LANE_HEIGHT = 19;

// Greedy lane packing, so a multi-day event stays one block across the row.
function assignLanes(items) {
    items.sort((first, second) => second.span - first.span || first.occurrence.start - second.occurrence.start);
    const lanes = [];
    for (const item of items) {
        let index = lanes.findIndex((lane) =>
            lane.every(
                (placed) => item.column >= placed.column + placed.span || item.column + item.span <= placed.column
            )
        );
        if (index < 0) {
            lanes.push([]);
            index = lanes.length - 1;
        }
        lanes[index].push(item);
        item.lane = index;
    }
    return lanes.length;
}

// Places occurrences on the columns of a row of `count` days starting at `start`.
function rowItems(start, count, occurrences) {
    return occurrences
        .map((occurrence) => {
            const column = Math.max(0, dayDelta(occurrence.start, start));
            const lastDay = dayDelta(new Date(+occurrence.end - 1), start);
            const span = Math.min(count, lastDay + 1) - column;
            return span > 0 ? { occurrence, column, span } : null;
        })
        .filter(Boolean);
}

// A filled bar when `continuous`, or a dot, the time and the title. A click opens the occurrence with `onOpen(occurrence,
// element)`.
function bar(occurrence, continuous, onOpen) {
    const element = document.createElement('div');
    Object.assign(element.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        height: LANE_HEIGHT - 3 + 'px',
        margin: '0 2px',
        padding: '0 5px',
        borderRadius: '4px',
        boxSizing: 'border-box',
        font: '12px var(--deckit-font)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        background: continuous ? occurrence.color : 'transparent',
        color: continuous ? '#fff' : 'inherit',
        transition:
            'background-color var(--deckit-fast) var(--deckit-easing), filter var(--deckit-fast) var(--deckit-easing)',
    });
    if (continuous) {
        paintSolid(element, occurrence);
    } else {
        const dot = document.createElement('span');
        Object.assign(dot.style, {
            flex: '0 0 auto',
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: occurrence.color,
        });
        paintDot(dot, occurrence);
        const time = document.createElement('span');
        time.textContent = clockText(occurrence.start);
        Object.assign(time.style, { flex: '0 0 auto', opacity: '.6' });
        element.append(dot, time);
    }
    const text = document.createElement('span');
    text.textContent = nameOf(occurrence);
    Object.assign(text.style, { overflow: 'hidden', textOverflow: 'ellipsis' });
    if (!continuous) paintText(text, occurrence);
    element.appendChild(text);
    element.title = occurrence.summary || '';
    paintPast(element, occurrence);
    element.addEventListener('click', (event) => {
        event.stopPropagation();
        onOpen(occurrence, element);
    });
    if (continuous) {
        element.addEventListener('mouseenter', () => {
            element.style.filter = 'brightness(1.12)';
        });
        element.addEventListener('mouseleave', () => {
            element.style.filter = 'none';
        });
    } else {
        element.addEventListener('mouseenter', () => {
            element.style.background = 'rgba(128,128,128,.16)';
        });
        element.addEventListener('mouseleave', () => {
            element.style.background = 'transparent';
        });
    }
    return element;
}

function laneGrid(count) {
    const grid = document.createElement('div');
    Object.assign(grid.style, {
        display: 'grid',
        gridTemplateColumns: `repeat(${count}, 1fr)`,
        height: LANE_HEIGHT + 'px',
    });
    return grid;
}

// Row 1 always: auto-placement never moves left again, so a later cell would spill onto a second row.
function laneCell(column, span) {
    const cell = document.createElement('div');
    Object.assign(cell.style, { gridColumn: `${column + 1} / span ${span}`, gridRow: '1', minWidth: '0' });
    return cell;
}

module.exports = { LANE_HEIGHT, assignLanes, rowItems, bar, laneGrid, laneCell };
