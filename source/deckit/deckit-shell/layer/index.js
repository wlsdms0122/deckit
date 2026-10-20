import * as CHANNEL from '../deck/channel/index.js';

// What a layer on deckit, a shell, and a driver agree on, as plain data: what the layer is given in main (what connect
// answers), of a stage, and on a page. A driver gives at least this, and the layer is handed this alone (`checked`).
// Each leaf says what a member is: `function`, `object`, `string`, or `array`, a list the layer reads.
// MARK: - Property
/**
 * A page: a token a layer keeps, compares and hands back, and never reads.
 * @typedef {object} Page
 *
 * A key pressed, as the layer's `monitor` sees it.
 * @typedef {{ code: string, meta: boolean, control: boolean, alt: boolean, shift: boolean }} Keystroke
 *
 * A page as a stage lays it, bottom to top: at `rect`, or hidden in the place it has.
 * @typedef {{ page: Page, rect: { x: number, y: number, width: number, height: number } } | { page: Page, hidden: true }} Laid
 */

// What connect answers that a layer uses, in main.
const CONNECTED = Object.freeze({
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

// The notifications of a run a layer hears by name, of those `mods.notifications` lists.
const NOTIFIED = Object.freeze(['didLaunch', 'didTerminate']);

// What `pages.stage()` makes: `lay(laid)` takes Laid pages, bottom to top.
const STAGE = Object.freeze({
    place: 'function',
    size: 'function',
    whenResized: 'function',
    show: 'function',
    lay: 'function',
});

// On a page: what a page the layer made is handed (`page(name, context)`), and what a mod's page is (`mod(context)`).
const PAGE_CONTEXT = Object.freeze({ channels: { bind: 'function' } });
const MOD_CONTEXT = Object.freeze({ mod: 'object', deliver: 'function', channels: { bind: 'function' } });

// MARK: - Initializer
// MARK: - Public
// The members `table` names that `given` does not have as it says, each by its path: none when it has them all. A
// member of the wrong kind is missing. A nested table is met by an object, or a function, carrying its members.
function missingIn(given, table, at = '') {
    return Object.entries(table).flatMap(([name, kind]) => {
        const path = at + name;
        const value = given?.[name];
        if (typeof kind !== 'object') return CHANNEL.kindOf(value) === kind ? [] : [path];
        const carries = value && (typeof value === 'object' || typeof value === 'function');
        return carries ? missingIn(value, kind, path + '.') : [path];
    });
}

// What `given` holds of `table`, and nothing else, frozen: a throw naming what `what` lacks when it lacks any. So a
// layer handed this reaches only what it is given.
function checked(given, table, what) {
    const missing = missingIn(given, table);
    if (missing.length) throw new Error(`[deckit] ${what} lacks ${missing.join(', ')}`);
    return copyOf(given, table);
}

// MARK: - Private
function copyOf(given, table) {
    return Object.freeze(
        Object.fromEntries(
            Object.entries(table).map(([name, kind]) => [
                name,
                typeof kind === 'object' ? copyOf(given[name], kind) : given[name],
            ])
        )
    );
}

export { CONNECTED, NOTIFIED, STAGE, PAGE_CONTEXT, MOD_CONTEXT, missingIn, checked };
