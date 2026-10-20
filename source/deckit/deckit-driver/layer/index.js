// What a layer on deckit, a shell, and a driver agree on, as plain data: what the layer is given in main (what connect
// answers), on a stage, and on a page, and what the layer answers a mod's page. A driver gives at least this; the
// layer reaches nothing else. Each leaf says what a member is: `function`, `array`, `object` or `string`.
// MARK: - Property
// What a run tells as it moves, in the order a run that starts and stops tells them.
const NOTIFICATIONS = Object.freeze(['willLaunch', 'didLaunch', 'didFailToLaunch', 'willTerminate', 'didTerminate']);

/**
 * A page: a token a layer keeps, compares and hands back, and never reads.
 * @typedef {object} Page
 *
 * A key pressed, as the layer's `monitor` sees it.
 * @typedef {{ code: string, meta: boolean, control: boolean, alt: boolean, shift: boolean }} Keystroke
 *
 * A page on a stage, bottom to top: laid at `rect`, or hidden in the place it has.
 * @typedef {{ page: Page, rect: { x: number, y: number, width: number, height: number } } | { page: Page, hidden: true }} Layer
 */

// In main: what connect answers that a layer uses.
const MAIN = Object.freeze({
    config: { name: 'string' },
    onStart: 'function',
    channels: { bind: 'function' },
    permissions: { define: 'function' },
    mods: {
        notifications: 'array',
        list: 'function',
        onChange: 'function',
        arrange: 'function',
        runs: 'function', // [{ run, page }]
        runOf: 'function',
        listingOf: 'function',
        observe: 'function',
        modOf: 'function',
        managerFrom: 'function',
    },
    pages: {
        // open(name, { keepsDrawing, reloadsOnCrash, surfaces: { names, onOpen(name, page) } }) -> page
        open: 'function',
        close: 'function',
        focus: 'function',
        isAlive: 'function',
        whenFocused: 'function',
        whenEnds: 'function',
        nameOf: 'function',
        stage: 'function',
    },
    // delegate({ isActive(page), monitor(page, keystroke) })
    keymap: { register: 'function', chordOf: 'function', listen: 'function', delegate: 'function' },
    commands: { session: 'function', tones: 'array' },
    state: { read: 'function', write: 'function' },
    web: { pageFor: 'function', holdsKeyboard: 'function' },
    log: { warn: 'function' },
});

// What `pages.stage()` makes: `lay(layers)` takes Layers, bottom to top.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
});

// On a page: what a page the layer made is handed (`page(name, context)`), and what a mod's page is (`mod(context)`).
const PAGE = Object.freeze({ channels: { bind: 'function' } });
const MOD_PAGE = Object.freeze({ mod: 'object', deliver: 'function', channels: { bind: 'function' } });

// What a layer answers a mod's page, as it gives nothing: what it reads of the entry, adds to `deck` and to
// `deck.mods`, takes as registrations, each by its check, whether a key pressed now is dropped, why a key would never
// run, and what main is told of the mod beside the driver's own.
const NO_LAYER = Object.freeze({
    members: Object.freeze([]),
    deck: Object.freeze({}),
    registrations: Object.freeze({}),
    mods: Object.freeze({}),
    blocksKeys: () => false,
    keyProblem: () => '',
    contribute: () => ({}),
});

// MARK: - Initializer
// MARK: - Public
// The members `table` names that `given` does not have as it says, each by its path: none when it has them all.
function missingIn(given, table, at = '') {
    return Object.entries(table).flatMap(([name, kind]) => {
        const path = at + name;
        const value = given?.[name];
        if (typeof kind === 'object')
            return value && typeof value === 'object' ? missingIn(value, kind, path + '.') : [path];
        return kindOf(value) === kind ? [] : [path];
    });
}

// `given` as it is, once it has every member `table` names; otherwise a throw naming what `what` lacks.
function checked(given, table, what) {
    const missing = missingIn(given, table);
    if (missing.length) throw new Error(`[deckit] ${what} lacks ${missing.join(', ')}`);
    return given;
}

// MARK: - Private
function kindOf(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    return typeof value;
}

export { NOTIFICATIONS, MAIN, STAGE, PAGE, MOD_PAGE, NO_LAYER, missingIn, checked };
