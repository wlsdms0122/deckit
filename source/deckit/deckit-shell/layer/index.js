import * as ENVIRONMENT from '../environment/index.js';

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
// How a layer is held to what it is given: as an environment is (environment/).
const { missingIn, checked } = ENVIRONMENT;

// MARK: - Private

export { CONNECTED, NOTIFIED, STAGE, PAGE_CONTEXT, MOD_CONTEXT, missingIn, checked };
