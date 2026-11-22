// How the desktop reads as text, from the same content it reads as data: a line a thing, two spaces a level, each
// `<kind> ["<name>"] [<words>] [[<state>, ...]] [(<counts>)] [<ref>]`. What was left out is counted on the line that
// holds it, and each line ends in the ref that reads further.

const quoted = (text) => JSON.stringify(String(text));
const joined = (...parts) => parts.filter((part) => typeof part === 'string' && part !== '').join(' ');
const bracketed = (states) => {
    const words = states.filter(Boolean);
    return words.length ? `[${words.join(', ')}]` : null;
};
const pointOf = ({ x, y }) => `${Math.round(x)},${Math.round(y)}`;
const sizeOf = ({ width, height }) => `${Math.round(width)}x${Math.round(height)}`;
const indented = (depth, line) => `${'  '.repeat(depth)}${line}`;

// A seat: its id, its user's name, its colour's name where it has one, where its pointer is once it was anywhere, its
// key window, and `(you)` on the asker's.
function seatLine({ id, name, colour = null, at = null, key = null, you = false }) {
    return joined('seat', id, quoted(name), colour, at && `at ${pointOf(at)}`, key && `key ${key}`, you && '(you)');
}

// An item of the Dock.
function itemLine({ name, running, active, attention, ref }) {
    const states = [running && 'running', active && 'active', attention && 'attention'];
    return joined('item', quoted(name), bracketed(states), ref);
}

// An entry of the menu of an item of the Dock.
function entryLine({ name, ref }) {
    return joined('menuitem', quoted(name), ref);
}

// A window or a panel window: its id, title, mod, a panel's edge, its frame, then `key`, the seats whose keyboard it
// holds, or null where it holds none's, and how it is on the asker's screen.
function windowLine({ kind, id, title, mod, edge = null, frame, key = null, minimized, zoomed, tile = null }) {
    const states = [
        key && ['key', ...key].join(' '),
        minimized && 'minimized',
        zoomed && 'zoomed',
        tile && `tile ${tile}`,
    ];
    return joined(kind, id, quoted(title), mod, edge, `at ${pointOf(frame)}`, sizeOf(frame), bracketed(states));
}

// What a document shows of one element, or a part the shell draws: a name cut short ends in an ellipsis and its
// whole length.
function elementLine({ role, name, length, states = [], items, inView, below, ref }) {
    const named = name === undefined || name === null ? null : quoted(length ? `${name}…` : name);
    const counts = [
        items !== undefined && `${items} items`,
        inView !== undefined && `${inView} in view`,
        below !== undefined && `${below} elements below`,
    ].filter(Boolean);
    return joined(
        role,
        named,
        length ? `(${length})` : null,
        bracketed(states),
        counts.length ? `(${counts.join(', ')})` : null,
        ref
    );
}

// A document a window shows: its number, the part of the window it is, a child's mod, and its size.
function documentLine({ document, part, name = null, width, height }) {
    return joined('document', String(document), part, name && quoted(name), sizeOf({ width, height }));
}

// What is selected under a node: a field's from one offset to another, editable content's by the text line and the
// column it ends at, with how much is selected.
function selectionLine({ start, end, line, column, length }) {
    if (start !== undefined) return start === end ? `selection ${start}` : `selection ${start} to ${end}`;
    const at = line !== undefined ? `${line}:${column}` : null;
    return joined('selection', at, length ? `(${length} selected)` : null);
}

// The desktop: where the asker's camera is and its size, and the mark, the seats, the Dock, the menu of an item of it while one is open for the asker,
// then the windows front to back in the asker's order and the panel windows.
function desktop({ desktop: size, mark, seats, dock, menu = null, windows, panels }) {
    return [
        `desktop at ${pointOf(size)} ${sizeOf(size)} mark ${mark}`,
        ...seats.map(seatLine),
        `dock (${dock.length} items)`,
        ...dock.map((item) => indented(1, itemLine(item))),
        ...(menu
            ? [joined('menu', quoted(menu.name)), ...menu.entries.map(entryLine)].map((line) => indented(1, line))
            : []),
        ...windows.map(windowLine),
        ...panels.map(windowLine),
    ].join('\n');
}

// A window: its own line with the mark, the parts the shell draws, then each document it shows as an outline.
function window({ window: own, mark, parts, documents }) {
    return [
        `${windowLine(own)} mark ${mark}`,
        ...parts.map((part) => indented(1 + part.depth, elementLine(part))),
        ...documents.flatMap(({ lines, ...document }) => [
            indented(1, documentLine(document)),
            ...lines.map((line) => indented(2 + line.depth, elementLine(line))),
        ]),
    ].join('\n');
}

// What is under one ref: its line, where it is on the desktop, how far it is scrolled of how much, the lines under
// it, how many were left out, and what is selected.
function node({ node: own, rect = null, size = null, scroll = null, lines = [], more = 0, selection = null }) {
    const place = rect ? `at ${pointOf(rect)} ${sizeOf(rect)}` : size && sizeOf(size);
    return [
        joined(elementLine(own), place, scroll && `scroll ${Math.round(scroll.top)} of ${Math.round(scroll.height)}`),
        ...lines.map((line) => indented(line.depth, elementLine(line))),
        ...(more ? [indented(1, `... ${more} more`)] : []),
        ...(selection ? [indented(1, selectionLine(selection))] : []),
    ].join('\n');
}

// What reads otherwise since a mark: `+` a line that is new, `~` a line as it reads now, `-` the ref of what is gone.
function changes({ from, to, entries }) {
    return [`changes ${from} to ${to}`, ...entries.map(({ kind, line }) => `${kind} ${line}`)].join('\n');
}

export { seatLine, itemLine, entryLine, windowLine, elementLine, documentLine, desktop, window, node, changes };
