const { LANE_HEIGHT, assignLanes, rowItems, bar, laneGrid, laneCell } = require('./bar.js');
const { WEEKDAYS, addDays, sameDay, dayDelta } = require('./date.js');
const { isSpanning } = require('./occurrence.js');

// Its ground is set in a rule: set inline, it would stand over the kit's pressable wash.
const PLAIN_BUTTON = 'calendar-plain-button';

// Six weeks from `start`, the days of `month` (0 to 11) in full and the rest stepped back, and the occurrences that fall
// in them as bars. A week shows as many lanes as its height holds, and the rest of a day behind "+n more".
function monthView({ ui, detail, onOpenDay }) {
    ui.addStyle(`.${PLAIN_BUTTON} { border: 0; background: transparent; cursor: pointer; }`);
    // The weeks last drawn, and how many lanes fitted each then.
    let weeks = null;
    let drawnCapacity = 0;

    return { draw, fitsAsDrawn };

    function draw(into, { start, month, occurrences }) {
        const now = new Date();

        const weekHead = document.createElement('div');
        Object.assign(weekHead.style, {
            flex: '0 0 auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: 'var(--deckit-border)',
            opacity: '.6',
            font: '700 11.5px var(--deckit-font)',
        });
        for (const weekday of WEEKDAYS) {
            const cell = document.createElement('div');
            cell.textContent = weekday.toUpperCase();
            Object.assign(cell.style, { padding: '6px 8px', textAlign: 'center', letterSpacing: '.04em' });
            weekHead.appendChild(cell);
        }
        into.appendChild(weekHead);

        weeks = document.createElement('div');
        Object.assign(weeks.style, {
            flex: '1 1 auto',
            minHeight: '0',
            display: 'grid',
            gridTemplateRows: 'repeat(6, 1fr)',
        });
        into.appendChild(weeks);

        // Before the first layout the row has no height; the resize observer draws again once it has.
        const capacity = capacityOf(weeks) ?? 3;
        drawnCapacity = capacity;

        for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
            const weekStart = addDays(start, weekIndex * 7);
            const items = rowItems(
                weekStart,
                7,
                occurrences.filter((occurrence) => {
                    const lastDay = dayDelta(new Date(+occurrence.end - 1), weekStart);
                    return lastDay >= 0 && dayDelta(occurrence.start, weekStart) <= 6;
                })
            );
            const laneCount = assignLanes(items);
            const overflowing = laneCount > capacity;
            const visibleLanes = overflowing ? Math.max(0, capacity - 1) : laneCount;

            const week = document.createElement('div');
            Object.assign(week.style, {
                display: 'flex',
                flexDirection: 'column',
                minHeight: '0',
                overflow: 'hidden',
                borderBottom: weekIndex === 5 ? '0' : 'var(--deckit-border)',
            });

            const numbers = document.createElement('div');
            Object.assign(numbers.style, { flex: '0 0 auto', display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' });
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                numbers.appendChild(dayNumber(addDays(weekStart, dayIndex), dayIndex, month, now));
            }

            const lanes = document.createElement('div');
            Object.assign(lanes.style, { flex: '1 1 auto', minHeight: '0', position: 'relative', overflow: 'hidden' });
            // Column rules sit behind the bars, so a bar crosses them uninterrupted.
            const rules = document.createElement('div');
            Object.assign(rules.style, {
                position: 'absolute',
                inset: '0',
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                pointerEvents: 'none',
            });
            for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
                const rule = document.createElement('div');
                rule.style.borderRight = dayIndex === 6 ? '0' : 'var(--deckit-border)';
                rules.appendChild(rule);
            }
            lanes.appendChild(rules);

            const stack = document.createElement('div');
            Object.assign(stack.style, { position: 'relative' });
            for (let lane = 0; lane < visibleLanes; lane++) {
                const grid = laneGrid(7);
                for (const item of items.filter((candidate) => candidate.lane === lane)) {
                    const cell = laneCell(item.column, item.span);
                    cell.appendChild(bar(item.occurrence, item.span > 1 || item.occurrence.allDay, detail.show));
                    grid.appendChild(cell);
                }
                stack.appendChild(grid);
            }
            if (overflowing) stack.appendChild(moreRow(items, visibleLanes, weekStart));
            lanes.appendChild(stack);

            week.append(numbers, lanes);
            weeks.appendChild(week);
        }
    }

    // Whether as many lanes fit a week as when it was drawn; true before layout has given the weeks a height.
    function fitsAsDrawn() {
        if (!weeks) return true;
        const capacity = capacityOf(weeks);
        return capacity === null || capacity === drawnCapacity;
    }

    function dayNumber(day, dayIndex, month, now) {
        const cell = document.createElement('div');
        Object.assign(cell.style, {
            display: 'flex',
            justifyContent: 'center',
            padding: '3px 0 2px',
            borderRight: dayIndex === 6 ? '0' : 'var(--deckit-border)',
        });
        const number = document.createElement('button');
        number.type = 'button';
        number.className = PLAIN_BUTTON;
        number.textContent = String(day.getDate());
        number.title = 'Open this day';
        // A day of another month steps back toward the ground: it is still a button.
        Object.assign(number.style, {
            color:
                day.getMonth() === month
                    ? 'var(--deckit-text)'
                    : 'color-mix(in srgb, var(--deckit-text) 38%, var(--deckit-background))',
            font: '12.5px var(--deckit-font)',
            padding: '1px 7px',
            borderRadius: '10px',
            transition: 'background-color var(--deckit-fast) var(--deckit-easing)',
        });
        if (sameDay(day, now)) {
            number.style.background = 'var(--deckit-accent)';
            number.style.color = '#fff';
            number.style.fontWeight = '700';
        } else {
            ui.pressable(number);
        }
        number.addEventListener('click', () => onOpenDay(day));
        cell.appendChild(number);
        return cell;
    }

    // The last lane of a week that has more than fit: each day's "+n more", which lists the whole day.
    function moreRow(items, visibleLanes, weekStart) {
        const grid = laneGrid(7);
        for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
            const onDay = (item) => item.column <= dayIndex && dayIndex < item.column + item.span;
            const hidden = items.filter((item) => item.lane >= visibleLanes && onDay(item));
            const cell = laneCell(dayIndex, 1);
            if (hidden.length) {
                const day = addDays(weekStart, dayIndex);
                const more = document.createElement('button');
                more.type = 'button';
                more.className = PLAIN_BUTTON;
                more.textContent = `+${hidden.length} more`;
                Object.assign(more.style, {
                    width: 'calc(100% - 4px)',
                    margin: '0 2px',
                    height: LANE_HEIGHT - 3 + 'px',
                    color: 'color-mix(in srgb, var(--deckit-text) 65%, var(--deckit-background))',
                    font: '11.5px var(--deckit-font)',
                    textAlign: 'left',
                    padding: '0 5px',
                    borderRadius: '4px',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                });
                ui.pressable(more);
                more.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const dayOccurrences = items
                        .filter(onDay)
                        .map((item) => item.occurrence)
                        .sort((first, second) => isSpanning(second) - isSpanning(first) || first.start - second.start);
                    detail.showDay(day, dayOccurrences, more);
                });
                cell.appendChild(more);
            }
            grid.appendChild(cell);
        }
        return grid;
    }
}

// How many lanes fit a week of `weeks` on screen, or null before layout has given it a height. Drawing and the resize
// observer both read it, so they measure the same element.
function capacityOf(weeks) {
    const rowHeight = weeks.clientHeight / 6;
    return rowHeight > 0 ? Math.max(1, Math.floor((rowHeight - 24) / LANE_HEIGHT)) : null;
}

module.exports = { monthView };
