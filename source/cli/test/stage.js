// The stage pages are laid on (deckit-electron/stage), checked over a stand-in for Electron's views: what ends up
// in what order, shown or not, and how few views are lifted to get there. Exits 1 with a line for each check that
// failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const STAGE = pathToFileURL(path.join(__dirname, '..', '..', 'deckit', 'deckit-electron', 'stage', 'main.js')).href;

// Electron's View, as the stage uses it: a child added again is lifted to the top whatever index it is given, and a
// new one goes in at its index.
let lifts = 0;
class View {
    constructor(name = 'stage') {
        this.name = name;
        this.children = [];
        this.bounds = { x: 0, y: 0, width: 0, height: 0 };
        this.visible = true;
        this.gone = false;
        this.webContents = { isDestroyed: () => this.gone };
    }
    addChildView(view, index) {
        const at = this.children.indexOf(view);
        if (at >= 0) {
            lifts++;
            this.children.splice(at, 1);
            this.children.push(view);
        } else if (index === undefined) this.children.push(view);
        else this.children.splice(index, 0, view);
    }
    removeChildView(view) {
        this.children = this.children.filter((child) => child !== view);
    }
    setBounds(bounds) {
        this.bounds = bounds;
    }
    getBounds() {
        return this.bounds;
    }
    setVisible(on) {
        this.visible = on;
    }
    setBackgroundColor() {}
    on() {}
    removeListener() {}
}

async function main() {
    // The view the stage holds its pages in is the one it makes.
    const made = [];
    globalThis.require = () => ({
        View: class extends View {
            constructor() {
                super('stage');
                made.push(this);
            }
        },
    });
    const { createStage } = await import(STAGE);
    const views = new Map();
    const page = (name) => {
        if (!views.has(name)) views.set(name, new View(name));
        return name;
    };
    const stage = createStage({
        LOG: { guard: () => () => {}, info: () => {} },
        WINDOW: { place: () => {} },
        viewOf: (name) => views.get(name) || null,
    }).stage();
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const orderOf = () => made[0].children.map(({ name }) => name).join(' ');
    const laid = (names) => {
        const before = lifts;
        stage.lay(names.map((name) => ({ page: page(name), rect: { x: 0, y: 0, width: 1, height: 1 } })));
        return lifts - before;
    };

    const lay = (layers) => {
        const before = lifts;
        stage.lay(
            layers.map((layer) =>
                typeof layer === 'string'
                    ? { page: page(layer), rect: { x: 0, y: 0, width: 1, height: 1 } }
                    : { page: page(layer.hidden), hidden: true }
            )
        );
        return lifts - before;
    };
    const refusal = (layers) => {
        try {
            stage.lay(layers);
            return '';
        } catch (error) {
            return error.message;
        }
    };

    lay(['backdrop', 'a', 'frame', 'handle']);
    check('pages go on the stage bottom to top', orderOf() === 'backdrop a frame handle', orderOf());
    check('a new stage lifts nothing', lifts === 0, lifts);
    check('the same layers move nothing', lay(['backdrop', 'a', 'frame', 'handle']) === 0, orderOf());
    lay(['backdrop', { hidden: 'b' }, 'a', 'frame', 'handle']);
    check('a new hidden page goes in over the layer before it', orderOf() === 'backdrop b a frame handle', orderOf());
    check(
        'showing either of two hidden pages lifts nothing',
        lay(['backdrop', { hidden: 'a' }, 'b', 'frame', 'handle']) === 0 &&
            lay(['backdrop', { hidden: 'b' }, 'a', 'frame', 'handle']) === 0,
        orderOf()
    );
    check(
        'a page put over the frame is lifted alone',
        lay(['backdrop', { hidden: 'b' }, 'frame', 'handle', 'a']) === 1 && orderOf() === 'backdrop b frame handle a',
        orderOf()
    );
    check(
        'back under the frame, what goes over it is lifted, not the page',
        lay(['backdrop', { hidden: 'b' }, 'a', 'frame', 'handle']) === 2 && orderOf() === 'backdrop b a frame handle',
        orderOf()
    );
    check(
        'a new page laid goes in over the one before it, lifting nothing',
        lay(['backdrop', { hidden: 'b' }, 'a', 'c', 'frame', 'handle']) === 0 &&
            orderOf() === 'backdrop b a c frame handle',
        orderOf()
    );
    lay(['backdrop', 'a', 'frame', 'handle']);
    check('a page left out is taken off', orderOf() === 'backdrop a frame handle', orderOf());
    stage.lay([
        { page: 'backdrop', rect: { x: 0, y: 0, width: 5, height: 5 } },
        { page: 'a', hidden: true },
        { page: 'frame', rect: { x: 1, y: 2, width: 3, height: 4 } },
    ]);
    check(
        'a hidden page keeps its place and its bounds, unseen',
        orderOf() === 'backdrop a frame' && !views.get('a').visible && views.get('a').bounds.width === 1,
        orderOf()
    );
    check('a laid page is where it is laid, seen', views.get('frame').visible && views.get('frame').bounds.y === 2, '');
    views.get('a').gone = true;
    check(
        'a page whose page is gone is taken off',
        refusal([
            { page: 'backdrop', rect: { x: 0, y: 0, width: 1, height: 1 } },
            { page: 'a', hidden: true },
        ]) === '' && orderOf() === 'backdrop',
        orderOf()
    );
    page('emptied');
    lay(['backdrop', 'emptied']);
    views.get('emptied').webContents = null;
    check(
        'a page whose view has nothing left in it is taken off',
        refusal([
            { page: 'backdrop', rect: { x: 0, y: 0, width: 1, height: 1 } },
            { page: 'emptied', hidden: true },
        ]) === '' && orderOf() === 'backdrop',
        orderOf()
    );
    const unknown = refusal([{ page: 'nowhere', rect: { x: 0, y: 0, width: 1, height: 1 } }]);
    check("a stage lays only pages of deck's", /a stage lays/.test(unknown), unknown);
    const both = refusal([{ page: 'backdrop', rect: { x: 0, y: 0, width: 1, height: 1 }, hidden: true }]);
    const neither = refusal([{ page: 'backdrop' }]);
    check('a layer is laid or hidden, one of the two', /a layer is/.test(both) && /a layer is/.test(neither), [
        both,
        neither,
    ]);

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
