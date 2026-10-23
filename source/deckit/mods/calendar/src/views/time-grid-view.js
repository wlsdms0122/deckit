const { assignLanes, rowItems, bar, laneGrid, laneCell } = require('./bar.js');
const { WEEKDAYS, addDays, sameDay, clockText } = require('../date/date.js');
const { nameOf, isSpanning } = require('../occurrence/occurrence.js');
const { paintPast, paintSolid } = require('../occurrence/paint.js');

const HOUR_HEIGHT = 44;
const GUTTER_WIDTH = '52px';

// `days` side by side on a grid of hours, the occurrences that span a day or more as bars above it.
function timeGridView({ detail }) {
    // The grid is drawn anew each time, so its scroll offset is carried here. It opens on the working day.
    let hourScroll = 7.5 * HOUR_HEIGHT;

    return { draw, moveNowLine };

    function draw(into, { days, occurrences }) {
        const spanning = occurrences.filter(isSpanning);
        const timed = occurrences.filter((occurrence) => !isSpanning(occurrence));
        const now = new Date();
        const columns = `${GUTTER_WIDTH} repeat(${days.length}, 1fr)`;

        into.appendChild(dayHead(days, columns, now));
        if (spanning.length) into.appendChild(spanningStrip(days, columns, spanning));

        const scroller = document.createElement('div');
        Object.assign(scroller.style, { flex: '1 1 auto', minHeight: '0', overflowY: 'auto' });
        const sheet = document.createElement('div');
        Object.assign(sheet.style, { display: 'grid', gridTemplateColumns: columns, height: 24 * HOUR_HEIGHT + 'px' });

        const gutter = document.createElement('div');
        Object.assign(gutter.style, { position: 'relative' });
        for (let hour = 1; hour < 24; hour++) {
            const label = document.createElement('div');
            label.textContent = String(hour).padStart(2, '0') + ':00';
            Object.assign(label.style, {
                position: 'absolute',
                right: '8px',
                top: hour * HOUR_HEIGHT - 7 + 'px',
                font: '11px var(--deckit-font)',
                opacity: '.45',
            });
            gutter.appendChild(label);
        }
        sheet.appendChild(gutter);

        for (const day of days) sheet.appendChild(dayColumn(day, timed, now));

        scroller.appendChild(sheet);
        scroller.addEventListener('scroll', () => {
            hourScroll = scroller.scrollTop;
        });
        into.appendChild(scroller);
        requestAnimationFrame(() => {
            scroller.scrollTop = hourScroll;
        });
    }

    function dayHead(days, columns, now) {
        const head = document.createElement('div');
        Object.assign(head.style, {
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: columns,
            borderBottom: 'var(--deckit-border)',
        });
        head.appendChild(document.createElement('div'));
        for (const day of days) {
            const cell = document.createElement('div');
            Object.assign(cell.style, { padding: '6px 4px', textAlign: 'center', borderLeft: 'var(--deckit-border)' });
            const weekday = document.createElement('div');
            weekday.textContent = WEEKDAYS[day.getDay()].toUpperCase();
            Object.assign(weekday.style, {
                font: '700 11px var(--deckit-font)',
                opacity: '.55',
                letterSpacing: '.04em',
            });
            const number = document.createElement('div');
            number.textContent = String(day.getDate());
            Object.assign(number.style, {
                font: '600 15px var(--deckit-font)',
                marginTop: '2px',
                display: 'inline-block',
                padding: '0 7px',
                borderRadius: '11px',
                lineHeight: '22px',
            });
            if (sameDay(day, now)) {
                number.style.background = 'var(--deckit-accent)';
                number.style.color = '#fff';
            }
            cell.append(weekday, number);
            head.appendChild(cell);
        }
        return head;
    }

    function spanningStrip(days, columns, spanning) {
        const strip = document.createElement('div');
        Object.assign(strip.style, {
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: columns,
            borderBottom: 'var(--deckit-border)',
            padding: '3px 0',
        });
        const label = document.createElement('div');
        label.textContent = 'All day';
        Object.assign(label.style, {
            font: '11px var(--deckit-font)',
            opacity: '.5',
            padding: '2px 8px',
            textAlign: 'right',
        });
        strip.appendChild(label);
        const holder = document.createElement('div');
        Object.assign(holder.style, { gridColumn: `2 / span ${days.length}`, minWidth: '0' });
        const items = rowItems(days[0], days.length, spanning);
        const laneCount = assignLanes(items);
        for (let lane = 0; lane < laneCount; lane++) {
            const grid = laneGrid(days.length);
            for (const item of items.filter((candidate) => candidate.lane === lane)) {
                const cell = laneCell(item.column, item.span);
                cell.appendChild(bar(item.occurrence, true, detail.show));
                grid.appendChild(cell);
            }
            holder.appendChild(grid);
        }
        strip.appendChild(holder);
        return strip;
    }

    function dayColumn(day, timed, now) {
        const column = document.createElement('div');
        Object.assign(column.style, {
            position: 'relative',
            borderLeft: 'var(--deckit-border)',
            background: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_HEIGHT - 1}px, rgba(128,128,128,.18) ${HOUR_HEIGHT - 1}px ${HOUR_HEIGHT}px)`,
        });
        // Each occurrence that overlaps the day, cut to it: one over midnight shows on both its days.
        const dayStart = +day,
            dayEnd = +addDays(day, 1);
        const items = layoutOverlaps(
            timed
                .filter((occurrence) => +occurrence.end > dayStart && +occurrence.start < dayEnd)
                .map((occurrence) => ({ ...occurrence }))
        );
        for (const item of items) {
            const startMinute = +item.start <= dayStart ? 0 : item.start.getHours() * 60 + item.start.getMinutes();
            const length = (Math.min(+item.end, dayEnd) - Math.max(+item.start, dayStart)) / 60000;
            const endMinute = Math.min(24 * 60, startMinute + Math.max(20, length));
            column.appendChild(block(item, startMinute, endMinute));
        }
        if (sameDay(day, now)) {
            const line = document.createElement('div');
            line.dataset.nowLine = '';
            Object.assign(line.style, {
                position: 'absolute',
                left: '0',
                right: '0',
                height: '2px',
                background: 'var(--deckit-alert)',
                top: topOf(now),
                pointerEvents: 'none',
            });
            column.appendChild(line);
        }
        return column;
    }

    // The current-time line drawn under `root`, moved to the time it is now.
    function moveNowLine(root) {
        const line = root.querySelector('[data-now-line]');
        if (line) line.style.top = topOf(new Date());
    }

    function topOf(time) {
        return ((time.getHours() * 60 + time.getMinutes()) / 60) * HOUR_HEIGHT + 'px';
    }

    // An occurrence from `startMinute` to `endMinute` of its column, beside those it overlaps.
    function block(item, startMinute, endMinute) {
        const element = document.createElement('div');
        Object.assign(element.style, {
            position: 'absolute',
            top: (startMinute / 60) * HOUR_HEIGHT + 'px',
            height: ((endMinute - startMinute) / 60) * HOUR_HEIGHT - 2 + 'px',
            left: `calc(${(item.column / item.columns) * 100}% + 2px)`,
            width: `calc(${(1 / item.columns) * 100}% - 4px)`,
            background: item.color,
            color: '#fff',
            borderRadius: '5px',
            padding: '2px 6px',
            font: '12px var(--deckit-font)',
            overflow: 'hidden',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition:
                'filter var(--deckit-fast) var(--deckit-easing), box-shadow var(--deckit-fast) var(--deckit-easing)',
        });
        element.addEventListener('mouseenter', () => {
            element.style.filter = 'brightness(1.12)';
            element.style.boxShadow = '0 2px 8px rgba(0,0,0,.28)';
        });
        element.addEventListener('mouseleave', () => {
            element.style.filter = 'none';
            element.style.boxShadow = 'none';
        });
        paintSolid(element, item);
        paintPast(element, item);
        const time = document.createElement('div');
        time.textContent = clockText(item.start) + '–' + clockText(item.end);
        Object.assign(time.style, { opacity: '.85', font: '11px var(--deckit-font)' });
        const name = document.createElement('div');
        name.textContent = nameOf(item);
        Object.assign(name.style, { fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis' });
        element.append(time, name);
        element.title = item.summary || '';
        element.addEventListener('click', (event) => {
            event.stopPropagation();
            detail.show(item, element);
        });
        return element;
    }
}

// Overlapping events side by side, in columns within their own cluster.
function layoutOverlaps(items) {
    items.sort((first, second) => first.start - second.start || second.end - first.end);
    let cluster = [],
        clusterEnd = 0;
    const flush = () => {
        const columnEnds = [];
        for (const item of cluster) {
            let column = columnEnds.findIndex((end) => end <= +item.start);
            if (column < 0) {
                columnEnds.push(0);
                column = columnEnds.length - 1;
            }
            columnEnds[column] = +item.end;
            item.column = column;
        }
        for (const item of cluster) item.columns = columnEnds.length;
        cluster = [];
    };
    for (const item of items) {
        if (cluster.length && +item.start >= clusterEnd) flush();
        cluster.push(item);
        clusterEnd = Math.max(clusterEnd, +item.end);
    }
    if (cluster.length) flush();
    return items;
}

module.exports = { timeGridView };
