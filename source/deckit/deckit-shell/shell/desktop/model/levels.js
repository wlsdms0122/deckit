// MARK: - Property
// The levels of the desktop's stage, bottom to top. What is laid there is each level's layers in this order, a level's
// own in the order they are given: `pages`, the mods' pages with a window here; `backdrop`; `windows`, each window's
// frame, content, children and buttons, in a seat's order; `glass`, the materials under what the desktop's page draws
// as glass; `desktop`, the desktop's page; `panels`, the panel windows at an edge with their children; `views`, the
// panel windows under an anchor with theirs; `overlays`, what each page laid under them presents over itself, which is
// made from those layers and given as no part; `cursors`, the seats' cursors, over everything.
const ORDER = Object.freeze([
    'pages',
    'backdrop',
    'windows',
    'glass',
    'desktop',
    'panels',
    'views',
    'overlays',
    'cursors',
]);
const OVERLAYS = 'overlays';

// MARK: - Initializer
// MARK: - Public
// The layers of `parts`, `{ <level>: [layer] }`, that lie under the pages' overlays, bottom to top. A level left out
// lays nothing.
function under(parts) {
    return stacked(parts, ORDER.slice(0, ORDER.indexOf(OVERLAYS)));
}

// The layers of `parts` that lie over the pages' overlays, bottom to top.
function over(parts) {
    return stacked(parts, ORDER.slice(ORDER.indexOf(OVERLAYS) + 1));
}

// `parts` with the level `level` taking the pointer over all of `rect` and every level over it taking it nowhere.
function heldAt(parts, level, rect) {
    known(parts);
    const top = ORDER.indexOf(level);
    if (top < 0 || level === OVERLAYS) throw new Error(`[deckit] "${level}" is no level that is given`);
    return Object.fromEntries(
        Object.entries(parts).map(([name, layers]) => {
            const at = ORDER.indexOf(name);
            if (at < top) return [name, layers];
            return [name, layers.map((layer) => ({ ...layer, input: at === top ? [rect] : [] }))];
        })
    );
}

// MARK: - Private
function stacked(parts, levels) {
    known(parts);
    return levels.flatMap((level) => parts[level] ?? []);
}

// Every part is a level's, and none is the overlays', which are made from what is laid under them.
function known(parts) {
    for (const name of Object.keys(parts))
        if (name === OVERLAYS || !ORDER.includes(name)) throw new Error(`[deckit] "${name}" is no level that is given`);
}

export { ORDER, under, over, heldAt };
