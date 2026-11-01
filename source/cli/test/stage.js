// The stage pages are laid on (deckit-electron/stage), checked over a stand-in for WebKit's module: what it is asked
// to lay, in what order, where and shown or not, each page's web pages over it, and where it is placed in its window.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const STAGE = pathToFileURL(path.join(__dirname, '..', '..', 'deckit', 'deckit-electron', 'stage', 'main.js')).href;

// WebKit's module, as the stage uses it: what it was last asked of each stage.
function moduleOf() {
    const stages = new Map(); // id -> { placed, laid, shown, removed }
    let last = 0;
    return {
        stages,
        makeStage: () => {
            stages.set(++last, { placed: null, laid: [], shown: true, removed: false });
            return last;
        },
        placeStage: (id, options) => (stages.get(id).placed = options),
        layStage: (id, layers) => (stages.get(id).laid = layers),
        showStage: (id, on) => (stages.get(id).shown = on),
        removeStage: (id) => (stages.get(id).removed = true),
    };
}

// A page as the environment makes one: its module id, and whether it closed.
function pageOf(id) {
    return {
        id,
        gone: false,
        isDestroyed() {
            return this.gone;
        },
    };
}

// A window of the module's, as the stage hears it: `resized(size)` tells it its content's new size, `closed()` that
// it closed.
function windowOf(id, size) {
    const heard = new Map();
    let closed = false;
    const tell = (event) => [...(heard.get(event) || [])].forEach((listener) => listener());
    return {
        id,
        size: () => size,
        isClosed: () => closed,
        on: (event, listener) => {
            if (!heard.has(event)) heard.set(event, new Set());
            heard.get(event).add(listener);
            return () => heard.get(event).delete(listener);
        },
        resized: (to) => {
            size = to;
            tell('resize');
        },
        closed: () => {
            closed = true;
            tell('close');
        },
    };
}

async function main() {
    const { createStages } = await import(STAGE);
    const native = moduleOf();
    const webPages = new Map(); // page -> [{ page, frame }]
    const STAGES = createStages({
        LOG: { error: () => {} },
        WEBKIT: { native: () => native },
        idOf: (window) => window.id,
        webPagesIn: (page) => webPages.get(page) || [],
    });
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const refusal = (stage, layers) => {
        try {
            stage.lay(layers);
            return '';
        } catch (error) {
            return error.message;
        }
    };
    const rect = (x, y, width, height) => ({ x, y, width, height });

    const stage = STAGES.stage();
    const asked = native.stages.get(1);
    const [backdrop, a, b, frame, web] = [1, 2, 3, 4, 5].map(pageOf);
    stage.lay([
        { page: backdrop, rect: rect(0, 0, 10, 10) },
        { page: a, rect: rect(0, 0, 10, 10) },
        { page: b, hidden: true },
        { page: frame, rect: rect(0, 0, 3, 10) },
    ]);
    check(
        'pages are laid bottom to top, a hidden one hidden',
        JSON.stringify(asked.laid) ===
            JSON.stringify([
                { page: 1, frame: rect(0, 0, 10, 10) },
                { page: 2, frame: rect(0, 0, 10, 10) },
                { page: 3, hidden: true },
                { page: 4, frame: rect(0, 0, 3, 10) },
            ]),
        asked.laid
    );

    webPages.set(a, [{ page: web, frame: rect(2, 3, 4, 5) }]);
    stage.lay([
        { page: backdrop, rect: rect(0, 0, 10, 10) },
        { page: a, rect: rect(1, 1, 9, 9) },
        { page: frame, rect: rect(0, 0, 3, 10) },
    ]);
    check(
        "a page's web pages are laid just over it, where their elements are in it",
        JSON.stringify(asked.laid.map(({ page }) => page)) === '[1,2,5,4]' &&
            JSON.stringify(asked.laid[2].frame) === JSON.stringify(rect(3, 4, 4, 5)),
        asked.laid
    );
    webPages.set(a, []);
    STAGES.relayOf(web);
    STAGES.relayOf(a);
    check(
        'web pages gone from a page are taken off as it is laid again',
        JSON.stringify(asked.laid.map(({ page }) => page)) === '[1,2,4]',
        asked.laid
    );

    b.gone = true;
    stage.lay([
        { page: backdrop, rect: rect(0, 0, 10, 10) },
        { page: b, hidden: true },
    ]);
    check(
        'a page that closed is taken off',
        JSON.stringify(asked.laid) === JSON.stringify([{ page: 1, frame: rect(0, 0, 10, 10) }]),
        asked.laid
    );
    const both = refusal(stage, [{ page: backdrop, rect: rect(0, 0, 1, 1), hidden: true }]);
    const neither = refusal(stage, [{ page: backdrop }]);
    check('a layer is laid or hidden, one of the two', /a layer is/.test(both) && /a layer is/.test(neither), [
        both,
        neither,
    ]);

    const window = windowOf(7, { width: 100, height: 80 });
    let resized = 0;
    stage.whenResized(() => resized++);
    stage.place(window, { bounds: ({ width, height }) => rect(0, 20, width, height - 20) });
    check(
        'a stage is placed in its window where its bounds say',
        asked.placed?.window === 7 && JSON.stringify(asked.placed.frame) === JSON.stringify(rect(0, 20, 100, 60)),
        asked.placed
    );
    window.resized({ width: 120, height: 90 });
    check(
        'a stage fits its window again as it resizes, and says it changed size',
        JSON.stringify(stage.size()) === JSON.stringify({ width: 120, height: 70 }) && resized === 2,
        { size: stage.size(), resized }
    );
    stage.lay([{ page: a, rect: rect(0, 0, 10, 10) }]);
    check('the window a page is shown in is found', STAGES.windowShowing(a) === window, '');
    check('a page hidden on a stage is shown in no window', STAGES.windowShowing(frame) === null, '');
    stage.show(false);
    check('a stage is hidden as asked', asked.shown === false, asked.shown);

    window.closed();
    check(
        "a closing window takes the stage's pages off",
        asked.laid.length === 0 && STAGES.windowShowing(a) === null,
        asked.laid
    );
    stage.close();
    check('a closed stage leaves the module', asked.removed, asked);

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} stage checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} stage checks`);
}

main().catch((error) => {
    console.error('[stage] ' + (error.stack || error.message));
    process.exit(1);
});
