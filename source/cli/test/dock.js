// The Dock (deckit-shell/shell/dock): its order (model/list-order), the mods the person placed first, as placed, the
// rest as deckit lists them, and a drag that moves the ids it names among the places they held; its items (model/dock),
// those kept, then those running, in the order they launched; and the Dock (dock/main) over a stand-in for what connect
// answers: the app mods it keeps at the first start, as the host app names them or as it ships them, then as the person
// left them, the list a mod with deckit.mods reads, which holds the app mods that load and no bundle that does not and
// no accessory, an app it keeps there, any other mod refused INVALID_ARGUMENT, and an app opened from it, launched
// when it does not run, its windows in front when it does, or its reopen() with none open, as the local seat, asked by
// the mod that opens it, the host window coming up only as the mod may activate, any other mod refused; what the
// person does to it in the desktop's page, done by the seat whose screen that is: an item clicked, a mod quit, kept or
// taken out, the kept ones reordered, each drawn again, and nothing a mod's page sends there; and `shell.mods` in a
// mod's page (dock/renderer), each member a request refused as the shell's handle refuses one; and the Dock's page
// (dock/view) over a stand-in for the document. Exits 1 with a line for each check that failed. The packages are ES
// modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LIST_ORDER = await import(url('deckit-shell', 'shell', 'dock', 'model', 'list-order.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'dock', 'model', 'dock.js'));
    const { createDock } = await import(url('deckit-shell', 'shell', 'dock', 'main.js'));
    const CHANNEL = await import(url('deckit-sdk', 'deckit', 'channel', 'index.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    const sorted = LIST_ORDER.sorted(['a', 'b', 'c', 'd'], ['c', 'x', 'a']).join();
    check('those placed come first, as placed, then the rest as listed', sorted === 'c,a,b,d', sorted);
    const arranged = LIST_ORDER.arranged(['a', 'b', 'c', 'd'], ['d', 'b', 'x', 'd']).join();
    check('the ids named move among the places they held, the rest stay put', arranged === 'a,d,c,b', arranged);

    const ids = ['a', 'b', 'c', 'd', 'e'];
    const docked = DOCK.items(ids, { pinned: new Set(['d', 'b']), running: new Set(['e', 'b', 'c']) });
    check(
        'the Dock holds the mods kept, in the list order, then those running that are not kept, in their order',
        JSON.stringify(docked) ===
            JSON.stringify([
                { id: 'b', pinned: true, running: true },
                { id: 'd', pinned: true, running: false },
                { id: 'e', pinned: false, running: true },
                { id: 'c', pinned: false, running: true },
            ]),
        docked
    );
    const unkept = DOCK.items(ids, { pinned: new Set(['b']), running: new Set(['c']) }).map(({ id }) => id);
    check('a mod taken out of the Dock that does not run leaves it', unkept.join() === 'b,c', unkept);
    const kept = DOCK.items(ids, { pinned: new Set(['a', 'c']), running: new Set(['c']) }).map(({ id }) => id);
    check('a running mod kept is listed once, where it is kept', kept.join() === 'a,c', kept);

    const ids3 = ['a', 'b', 'c'];
    const apps = (more = {}) => ({ a: {}, b: {}, c: {}, ...more });
    const first = dockOver(createDock, { mods: named(ids3), fields: apps(), dock: ['c', 'a'] });
    first.DOCK.start();
    const firstDock = first.DOCK.items()
        .map(({ id }) => id)
        .join();
    check(
        "at the first start the Dock keeps the host app's mods in the order it names them, as kept",
        JSON.stringify(first.state['dock-pinned']) === '["c","a"]' && firstDock === 'c,a',
        { state: first.state, firstDock }
    );
    const keptBefore = first.DOCK.keeps('c') && !first.DOCK.keeps('b');
    await first.DOCK.forget('c');
    check(
        'the Dock answers whether it keeps a mod, and erasing it takes the mod out of it',
        keptBefore &&
            !first.DOCK.keeps('c') &&
            Object.values(first.state).every((ids) => !ids.includes('c')) &&
            first.DOCK.items()
                .map(({ id }) => id)
                .join() === 'a',
        { keptBefore, state: first.state }
    );
    const shipped = dockOver(createDock, {
        mods: named(ids3),
        fields: apps({ b: { activationPolicy: 'accessory' } }),
    });
    shipped.DOCK.start();
    const shippedDock = shipped.DOCK.items()
        .map(({ id }) => id)
        .join();
    check('or else it keeps the app mods the host app ships, and no accessory', shippedDock === 'a,c', shippedDock);
    const later = dockOver(createDock, {
        mods: named(ids3),
        fields: apps(),
        dock: ['c', 'a'],
        state: { 'dock-pinned': ['b', 'a'] },
    });
    later.DOCK.start();
    const left = later.DOCK.items()
        .map(({ id }) => id)
        .join();
    check(
        'later the Dock is as the person left it, whatever the host app names',
        left === 'b,a' && JSON.stringify(later.state['dock-pinned']) === '["b","a"]',
        left
    );

    // A bundle that does not load, as deckit lists it, between two that do: it has no manifest fields and no run.
    const broken = { id: 'broken', refusal: { stage: 'read', kind: 'NOT_LOADABLE', message: 'no main.js' } };
    const listing = dockOver(createDock, {
        mods: [...named(['a']), broken, ...named(['b', 'switcher'])],
        fields: { a: {}, b: {}, switcher: { activationPolicy: 'accessory' } },
        icons: { a: '<svg viewBox="0 0 1 1"/>', switcher: '<svg viewBox="0 0 2 2"/>' },
        running: ['b'],
    });
    listing.DOCK.start();
    const listed = await listing.ask('list', {}, 'switcher');
    check(
        'the list holds the app mods that load, marked as the Dock marks them, and no bundle that does not',
        listed.map(({ id, running }) => `${id}:${running}`).join() === 'a:false,b:true',
        listed
    );
    const guarded = (name) => listing.guards[`deckit-shell:dock-${kebab(name)}`];
    check(
        'a mod with deckit.mods changes the Dock, any mod reads an icon, and no page sends what a seat does there',
        ['list', 'pinned', 'setPinned', 'open'].every((name) => guarded(name) === 'deckit.mods') &&
            guarded('icon') === CHANNEL.GUARD.MOD &&
            ['click', 'quit', 'keep', 'reorder'].every((name) => guarded(name) === undefined),
        listing.guards
    );
    const iconsAsked = await Promise.all(['a', 'switcher', 'b', 'gone'].map((id) => listing.ask('icon', { id }, 'x')));
    check(
        'the list answers each app with its icon, and icon(id) any mod, app or not, with "" for none',
        listed.map(({ icon }) => icon).join('|') === '<svg viewBox="0 0 1 1"/>|' &&
            iconsAsked.join('|') === '<svg viewBox="0 0 1 1"/>|<svg viewBox="0 0 2 2"/>||',
        iconsAsked
    );
    await listing.ask('setPinned', { id: 'b', pinned: false }, 'switcher');
    const keptNow = await listing.ask('pinned', {}, 'switcher');
    check(
        'a mod taken out of the Dock is no longer kept there, as kept',
        keptNow.join() === 'a' && JSON.stringify(listing.state['dock-pinned']) === '["a"]',
        keptNow
    );
    const refusedPins = [];
    for (const id of ['switcher', 'broken', 'gone'])
        refusedPins.push(
            await listing.ask('setPinned', { id, pinned: true }, 'switcher').then(
                () => 'kept',
                (error) => `${error.stage} ${error.kind}`
            )
        );
    check(
        'a mod that is no app of the catalog is refused a place in the Dock at call, INVALID_ARGUMENT, and not kept',
        refusedPins.every((one) => one === 'call INVALID_ARGUMENT') &&
            JSON.stringify(listing.state['dock-pinned']) === '["a"]',
        refusedPins
    );

    // `a` does not run, `b` runs with a window open, `c` runs with none.
    const opening = dockOver(createDock, {
        mods: named([...ids3, 'switcher']),
        fields: { ...apps(), switcher: { activationPolicy: 'accessory' } },
        running: ['b', 'c'],
        windowed: ['b'],
        active: ['switcher'],
    });
    opening.DOCK.start();
    for (const id of ids3) await opening.ask('open', { id }, 'switcher');
    check(
        'a mod opened launches as it does not run, its windows come in front as it does, or its reopen() with none ' +
            'open, asked by the mod that opens it, the host window coming up as it may activate',
        opening.launched.join() === 'a' &&
            opening.activated.join() === 'local:b,local:c' &&
            opening.reopened.length === 1 &&
            opening.reopened[0].mod === 'c' &&
            opening.requests.join() === 'switcher>a,switcher>b,switcher>c' &&
            opening.shown.length === 3,
        opening
    );
    const quietly = dockOver(createDock, {
        mods: named([...ids3, 'switcher']),
        fields: { ...apps(), switcher: { activationPolicy: 'accessory' } },
        running: ['b'],
        windowed: ['b'],
    });
    quietly.DOCK.start();
    await quietly.ask('open', { id: 'b' }, 'switcher');
    check(
        'a mod opened by one that may not activate leaves the host window down',
        quietly.activated.join() === 'local:b' && quietly.shown.length === 0,
        quietly
    );
    const accessory = await opening.ask('open', { id: 'switcher' }, 'switcher').then(
        () => '',
        (error) => `${error.stage} ${error.kind}`
    );
    check(
        'a mod that is no app is refused at call, INVALID_ARGUMENT',
        accessory === 'call INVALID_ARGUMENT',
        accessory
    );

    // What a seat does to the Dock, as the desktop recognizes it: the local seat and an attached one alike.
    const clicking = dockOver(createDock, {
        mods: named(ids3),
        fields: apps(),
        running: ['b', 'c'],
        windowed: ['b'],
        state: { 'dock-pinned': ['a', 'b'] },
    });
    clicking.DOCK.start();
    for (const id of ids3) clicking.DOCK.hand.click(id, 'local');
    check(
        "a click on an item is the seat's input reaching its mod: it launches, has the windows come in " +
            'front or reopens, the host window coming up',
        clicking.launched.join() === 'a' &&
            clicking.activated.join() === 'local:b,local:c' &&
            clicking.reopened.length === 1 &&
            clicking.inputs.join() === 'local:a,local:b,local:c' &&
            clicking.shown.length === 3,
        clicking
    );
    const drawnBefore = clicking.updates.length;
    clicking.DOCK.hand.choose('b', 'quit', 's1');
    clicking.DOCK.hand.choose('c', 'keep', 's1');
    const keptC = clicking.DOCK.items()
        .map(({ id, pinned }) => `${id}:${pinned}`)
        .join();
    check(
        'a mod quit from its menu quits, and one kept in the Dock is kept after the others, the desktop drawn again',
        clicking.quit.join() === 'b' &&
            keptC === 'a:true,b:true,c:true' &&
            JSON.stringify(clicking.state['dock-pinned']) === '["a","b","c"]' &&
            clicking.updates.length > drawnBefore,
        { quit: clicking.quit, keptC }
    );
    const orderNow = () =>
        clicking.DOCK.items()
            .map(({ id }) => id)
            .join();
    const drawnAtDrag = clicking.updates.length;
    clicking.DOCK.hand.drag('c', ['c', 'a', 'b']);
    const whileDragged = [orderNow(), clicking.DOCK.dragged(), JSON.stringify(clicking.state['dock-pinned'])];
    const drawnDragged = clicking.updates.length;
    clicking.DOCK.hand.drag('c', ['c', 'a', 'b']);
    const drawnSame = clicking.updates.length;
    clicking.DOCK.hand.drag();
    const givenUp = [orderNow(), clicking.DOCK.dragged()];
    check(
        'an item dragged shows the kept items in the order of the drag, drawn once for each order, with what is kept ' +
            'as it was, and a drag given up shows them as kept again',
        whileDragged.join(' ') === 'c,a,b c ["a","b","c"]' &&
            drawnDragged === drawnAtDrag + 1 &&
            drawnSame === drawnDragged &&
            givenUp.join(' ') === 'a,b,c ',
        { whileDragged, givenUp, drawn: [drawnAtDrag, drawnDragged, drawnSame] }
    );
    clicking.DOCK.hand.drag('c', ['c', 'a', 'b']);
    clicking.DOCK.hand.reorder(['c', 'b', 'a']);
    const reordered = orderNow();
    check(
        'the kept items let go in a new order take it, as kept, and none is dragged any more',
        reordered === 'c,b,a' &&
            clicking.DOCK.dragged() === null &&
            JSON.stringify(clicking.state['dock-pinned']) === '["c","b","a"]',
        { reordered, kept: clicking.state['dock-pinned'] }
    );
    clicking.DOCK.hand.choose('a', 'open', 's1');
    check(
        "Open chosen from an item's menu is the click of the seat that chose it",
        clicking.inputs.at(-1) === 's1:a' && clicking.launched.join() === 'a,a',
        clicking
    );
    clicking.DOCK.hand.choose('b', 'keep', 'local');
    const unkeptB = clicking.DOCK.items()
        .map(({ id, pinned }) => `${id}:${pinned}`)
        .join();
    check(
        'a running mod taken out of the Dock stays, after those kept, as it runs, and leaves the order',
        unkeptB === 'c:true,a:true,b:false' && JSON.stringify(clicking.state['dock-pinned']) === '["c","a"]',
        { unkeptB, kept: clicking.state['dock-pinned'] }
    );

    // `c` runs, then `a` launches, then `c` quits and launches again.
    const launching = dockOver(createDock, {
        mods: named(ids3),
        fields: apps(),
        running: ['c'],
        state: { 'dock-pinned': [] },
    });
    launching.DOCK.start();
    const order = () =>
        launching.DOCK.items()
            .map(({ id }) => id)
            .join();
    const firstRun = order();
    launching.runs.unshift(runOf('a'));
    const aLaunched = order();
    launching.runs.splice(1, 1);
    order();
    launching.runs.push(runOf('c'));
    const cAgain = order();
    check(
        'the running mods not kept are in the order they launched, one launched again after the others',
        firstRun === 'c' && aLaunched === 'c,a' && cAgain === 'a,c',
        { firstRun, aLaunched, cAgain }
    );

    const refusing = dockOver(createDock, { mods: named(['a', 'b']), fields: apps(), refusesWrites: true });
    refusing.DOCK.start();
    await new Promise((resolve) => setImmediate(resolve));
    const held = refusing.DOCK.items()
        .map(({ id }) => id)
        .join();
    check('the Dock goes on with what deckit refuses to keep, as state it did not read', held === 'a,b', held);

    // `shell.mods` in a mod's page: each member a request, refused NOT_PERMITTED without deckit.mods before its
    // arguments are read, then INVALID_ARGUMENT for an argument of another type.
    const { createDock: createPageDock } = await import(url('deckit-sdk', 'shell', 'dock', 'renderer.js'));
    const REQUEST = await import(url('deckit-sdk', 'deckit', 'request', 'index.js'));
    const asked = [];
    const pageChannels = {
        bind: (declared) => ({
            guard: declared.guard,
            invoke: async (payload) => asked.push([declared.channel, payload]) && [],
        }),
    };
    const pageDock = (granted) =>
        createPageDock({
            channels: pageChannels,
            request: (name, given, send) => REQUEST.requestOf(name, { ...given, mod: 'a', granted }, send),
        }).mods;
    const refusalOf = (promise) =>
        promise.then(
            () => 'fulfilled',
            (error) => `${error.stage} ${error.kind}`
        );
    const ungranted = pageDock([]);
    const granted = pageDock(['deckit.mods']);
    check(
        'shell.mods refuses a mod without deckit.mods at call with NOT_PERMITTED, before its arguments',
        (await refusalOf(ungranted.list())) === 'call NOT_PERMITTED' &&
            (await refusalOf(ungranted.pinned())) === 'call NOT_PERMITTED' &&
            (await refusalOf(ungranted.setPinned(5))) === 'call NOT_PERMITTED' &&
            (await refusalOf(ungranted.open())) === 'call NOT_PERMITTED' &&
            !asked.length,
        asked
    );
    check(
        'shell.mods refuses an argument of another type at call with INVALID_ARGUMENT',
        (await refusalOf(granted.setPinned('b', 'yes'))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(granted.setPinned('b'))) === 'call INVALID_ARGUMENT' &&
            (await refusalOf(granted.open(5))) === 'call INVALID_ARGUMENT' &&
            !asked.length,
        asked
    );
    const answers = [granted.list(), granted.pinned(), granted.setPinned('b', true), granted.open('b')];
    check(
        'shell.mods answers each request with a promise and asks main',
        answers.every((one) => one instanceof Promise) &&
            (await Promise.all(answers)) &&
            asked.map(([channel]) => channel.replace('deckit-shell:dock-', '')).join() ===
                'list,pinned,set-pinned,open',
        asked
    );

    // What a seat's pointer means on the Dock, decided from plain data: a desktop 1200 by 772 under a bar of 28.
    const desk = { x: 0, y: 28, width: 1200, height: 772 };
    const four = [
        { id: 'a', pinned: true, running: false },
        { id: 'b', pinned: true, running: true },
        { id: 'c', pinned: true, running: false },
        { id: 'd', pinned: false, running: true },
    ];
    const middle = (id) => {
        const tile = DOCK.tileOf(desk, four, id);
        return { x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 };
    };
    const between = { x: middle('a').x, y: (middle('a').y + middle('b').y) / 2 };
    check(
        'the item at a point is the one whose tile holds it, and none between two tiles or off the card',
        ['a', 'b', 'c', 'd'].every((id) => DOCK.itemAt(desk, four, middle(id)) === id) &&
            DOCK.itemAt(desk, four, between) === null &&
            DOCK.itemAt(desk, four, { x: 300, y: middle('a').y }) === null,
        [between, DOCK.itemAt(desk, four, between)]
    );
    const from = middle('a');
    const near = (dx, dy) => DOCK.drags(from, { x: from.x + dx, y: from.y + dy });
    check(
        'a press drags once the pointer is the slop from it, down or across, and not before',
        DOCK.SLOP === 4 && !near(0, 0) && !near(3, -3) && near(0, 4) && near(-4, 0) && near(3, 9),
        DOCK.SLOP
    );
    const orderAt = (id, point) => DOCK.orderOf(desk, four, id, point)?.join() ?? null;
    check(
        'a kept item dragged shows at the place of the kept item the pointer is level with, the others shifted by ' +
            'one; above them all it is first, below them all last; and an item that is not kept has no order',
        orderAt('a', middle('a')) === 'a,b,c' &&
            orderAt('a', middle('b')) === 'b,a,c' &&
            orderAt('a', { x: 600, y: middle('c').y }) === 'b,c,a' &&
            orderAt('c', middle('a')) === 'c,a,b' &&
            orderAt('b', { x: 10, y: 0 }) === 'b,a,c' &&
            orderAt('a', middle('d')) === 'b,c,a' &&
            orderAt('a', { x: 10, y: 5000 }) === 'b,c,a' &&
            orderAt('d', middle('a')) === null,
        ['a', 'b', 'c', 'd'].map((id) => orderAt('a', middle(id)))
    );
    const shownWhile = four.map((item) => four.find(({ id }) => id === { a: 'b', b: 'a' }[item.id]) ?? item);
    check(
        'the drop is the order last shown: the order answered of the items as they show while dragged is the same',
        DOCK.orderOf(desk, shownWhile, 'a', middle('b')).join() === 'b,a,c' &&
            DOCK.orderOf(desk, shownWhile, 'a', middle('c')).join() === 'b,c,a',
        shownWhile.map(({ id }) => id)
    );
    const labels = (item) =>
        DOCK.entriesOf(item)
            .map((entry) => (entry ? `${entry.id}:${entry.label}` : '-'))
            .join();
    check(
        "an item's menu opens or shows it, keeps it in the Dock or takes it out, and quits it while it runs",
        labels(four[0]) === 'open:Open,-,keep:Remove from Dock' &&
            labels(four[1]) === 'open:Show,-,keep:Remove from Dock,-,quit:Quit' &&
            labels(four[3]) === 'open:Show,-,keep:Keep in Dock,-,quit:Quit',
        four.map(labels)
    );
    const menu = DOCK.menuOf(desk, four, 'd');
    const tall = (rects) => rects.reduce((sum, { height }) => sum + height, 0);
    const stacked = [...menu.entries.map(({ rect }) => rect), ...menu.rules].sort((one, other) => one.y - other.y);
    check(
        "the menu stands beside the card, its top level with its item's, as tall as its entries, its rules and its " +
            'padding, each entry and rule under the last inside it',
        menu.item === 'd' &&
            menu.frame.x === DOCK.WIDTH + DOCK.MENU.beside &&
            menu.frame.y === DOCK.tileOf(desk, four, 'd').y &&
            menu.frame.width === DOCK.MENU.width &&
            menu.frame.height === 2 * DOCK.MENU.padding + tall(stacked) &&
            menu.entries.map(({ id }) => id).join() === 'open,keep,quit' &&
            menu.rules.length === 2 &&
            stacked[0].y === menu.frame.y + DOCK.MENU.padding &&
            stacked.every(({ x, y, height }, at) => x === stacked[0].x && (!at || y === top(stacked[at - 1]))) &&
            DOCK.menuOf(desk, four, 'x') === null,
        menu
    );
    const low = DOCK.menuOf({ ...desk, height: 300 }, four, 'd');
    check(
        "a menu that would pass the desktop's bottom stands its margin inside it",
        low.frame.y + low.frame.height === 28 + 300 - DOCK.MENU.margin && low.frame.y < DOCK.tileOf(desk, four, 'd').y,
        low.frame
    );
    const inEntry = ({ rect }) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
    check(
        'the entry at a point of the menu is the one whose rect holds it, and none on a rule or its padding',
        menu.entries.every((entry) => DOCK.entryAt(menu, inEntry(entry)) === entry.id) &&
            DOCK.entryAt(menu, inEntry({ rect: menu.rules[0] })) === null &&
            DOCK.entryAt(menu, { x: menu.frame.x + 1, y: menu.frame.y + 1 }) === null,
        menu.entries
    );
    const takes = (out, open) => DOCK.inputOf(desk, out, four, open).length;
    check(
        'the Dock takes the pointer at its sliver, at its card while it is out, and at the menu open',
        takes(false) === 1 &&
            takes(true) === 2 &&
            takes(true, menu) === 3 &&
            JSON.stringify(DOCK.inputOf(desk, true, four, menu)[2]) === JSON.stringify(menu.frame),
        DOCK.inputOf(desk, true, four, menu)
    );

    await viewChecks({ DOCK, desk, four, check });

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} dock checks`);
    process.exit(0);
}

// The Dock's page (dock/view) over a stand-in for the document: where it draws the menu main tells it.
async function viewChecks({ DOCK, desk, four, check }) {
    const VIEW = await import(url('deckit-shell', 'shell', 'dock', 'view.js'));
    const made = [];
    global.document = { createElement: (name) => made[made.push(element(name)) - 1] };
    global.window = { matchMedia: () => ({ matches: false, addEventListener() {} }), addEventListener() {} };
    global.CSS = { escape: (text) => text };
    const dock = VIEW.make({ ui: { addStyle() {} }, onPointer() {}, onOut() {}, onGlass() {} });
    const menu = DOCK.menuOf(desk, four, 'd');
    dock.update({ items: [], active: null, attention: [], held: null, menu });
    const one = (name) => made.find(({ className }) => className === name);
    const [slides, drawn] = [one('deckit-dock'), one('deckit-dock-menu')];
    const holders = [];
    for (let node = drawn.parent; node; node = node.parent) holders.push(node);
    const { left, top, width, height } = drawn.style;
    const { x, y } = menu.frame;
    check(
        "the Dock's page draws a menu at the model's frame, in the page and not in what slides, which is what its " +
            'descendants are placed against while it moves',
        !holders.includes(slides) &&
            holders.includes(dock.element) &&
            slides.parent === dock.element &&
            JSON.stringify([left, top, width, height]) === JSON.stringify([`${x}px`, `${y}px`, '160px', '110px']) &&
            drawn.children.filter(({ className }) => className === 'deckit-dock-menu-entry').length === 3,
        { holders: holders.map(({ className }) => className), style: drawn.style }
    );
}

// A stand-in for an element of a page: what holds it and what it holds, its attributes and style, and what listens.
function element(name) {
    const attributes = new Map();
    const node = {
        name,
        className: '',
        dataset: {},
        style: {},
        hidden: false,
        parent: null,
        children: [],
        heard: {},
        rect: { x: 0, y: 0, width: 0, height: 0 },
        setAttribute: (key, value) => attributes.set(key, String(value)),
        getAttribute: (key) => attributes.get(key) ?? null,
        hasAttribute: (key) => attributes.has(key),
        removeAttribute: (key) => attributes.delete(key),
        toggleAttribute: (key, on) => (on ? attributes.set(key, '') : attributes.delete(key)),
        append(...nodes) {
            for (const each of nodes) each.parent = node;
            node.children.push(...nodes);
        },
        replaceChildren(...nodes) {
            node.children = [];
            node.append(...nodes);
        },
        addEventListener: (type, listener) => (node.heard[type] ??= []).push(listener),
        closest: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        getBoundingClientRect: () => node.rect,
        getAnimations: () => [],
    };
    return node;
}

// The bottom of a rect.
function top({ y, height }) {
    return y + height;
}

// The run of mod `id`, running, with its page, as deckit lists it.
function runOf(id) {
    return { run: { mod: { id }, state: 'running', relaunches: false }, page: { mod: id } };
}

// Mods as deckit lists them, by their ids.
function named(ids) {
    return ids.map((id) => ({ id, name: id.toUpperCase(), uses: {} }));
}

// `createDock` over stand-ins: `mods` as deckit lists them, `fields` each one's manifest fields, `active` those that
// may activate for the local seat, `running` the mods that run, as `runs` lists them for a test to change, `windowed`
// those of them with a window open, `dock` as the host app hands it, `state` what the shell kept, and `refusesWrites`
// deckit refusing every write to state, as it does state it did not read; `icons` each mod's icon as the shell read it. `guards` is the guard each channel's
// declaration names, by its name. `ask(name, payload, mod)` asks one of the Dock's channels as the page of `mod`.
function dockOver(
    createDock,
    {
        mods,
        fields,
        icons = {},
        running = [],
        windowed = [],
        active = [],
        dock = null,
        state = {},
        refusesWrites = false,
    }
) {
    const handlers = {};
    const guards = {}; // a channel's name -> the guard its declaration names
    const requests = [];
    const inputs = [];
    let handed = new Set();
    const launched = [];
    const activated = [];
    const reopened = [];
    const shown = [];
    const quit = [];
    const updates = [];
    const page = (mod) => ({ mod });
    const desktopPage = { name: 'desktop' };
    const runs = running.map(runOf);
    const deckit = {
        channels: {
            bind: (declared) => {
                guards[declared.channel] = declared.guard;
                return {
                    handle: (handler) => (handlers[declared.channel] = handler),
                    on: (handler) => (handlers[declared.channel] = handler),
                };
            },
        },
        log: { error() {} },
        mods: {
            list: () => mods,
            shipped: () => mods.filter(({ refusal }) => !refusal).map(({ id }) => id),
            runs: () => runs,
            runOf: (id) => runs.find(({ run }) => run.mod.id === id)?.run ?? null,
            fieldsOf: (id) => fields[id] ?? null,
            modOf: (sender) => sender?.mod ?? null,
            launch: async (id) => launched.push(id),
            quit: async (id) => quit.push(id),
        },
    };
    const DOCK = createDock({
        deckit,
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                if (refusesWrites) throw new Error('the state the core keeps was not read');
                state[key] = value;
            },
        },
        DESKTOP: {
            localSeat: 'local',
            activation: {
                input: (seat, id) => {
                    inputs.push(`${seat}:${id}`);
                    handed = new Set([id]);
                },
                request: (from, to) => {
                    requests.push(`${from}>${to}`);
                    if (active.includes(from) || handed.has(from)) handed.add(to);
                },
                mayActivate: (_seat, id) => active.includes(id) || handed.has(id),
            },
            update: () => updates.push(true),
        },
        WINDOWS: {
            forward: (seat, id) => activated.push(`${seat}:${id}`) > 0 && windowed.includes(id),
            reopen: (one) => reopened.push(one),
        },
        ICONS: { of: (id) => icons[id] ?? '', ready: async () => {}, onChange() {} },
        host: { show: () => shown.push(true) },
        dock,
    });
    const ask = async (name, payload, mod) => handlers[`deckit-shell:dock-${kebab(name)}`](payload, page(mod));
    return {
        DOCK,
        guards,
        state,
        runs,
        launched,
        activated,
        reopened,
        shown,
        quit,
        updates,
        requests,
        inputs,
        ask,
    };
}

function kebab(name) {
    return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
