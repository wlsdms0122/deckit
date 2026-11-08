// The Dock (deckit-shell/shell/dock): its order (model/list-order), the mods the person placed first, as placed, the
// rest as deckit lists them, and a drag that moves the ids it names among the places they held; its items (model/dock),
// those kept, then those running, in the order they launched; and the Dock (dock/main) over a stand-in for what connect
// answers: the app mods it keeps at the first start, as the host app names them or as it ships them, then as the person
// left them, the list a mod with deckit.mods reads, which holds the app mods that load and no bundle that does not and
// no accessory, and a mod opened from it, launched when it does not run, its windows in front when it does, or its
// reopen() with none open, as the local seat; and what the person does to it in the desktop's page, done by the seat
// whose screen that is: an item clicked, a mod quit, kept or taken out, the kept ones reordered, each drawn again, and
// nothing a mod's page sends there. Exits 1 with a line for each check that failed. The packages are ES modules, so
// they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const LIST_ORDER = await import(url('deckit-shell', 'shell', 'dock', 'model', 'list-order.js'));
    const DOCK = await import(url('deckit-shell', 'shell', 'dock', 'model', 'dock.js'));
    const { createDock } = await import(url('deckit-shell', 'shell', 'dock', 'main.js'));
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
        "at the first start the Dock keeps the host app's mods in the order it names them, as the shell's own order",
        JSON.stringify(first.state['panel-order']) === '["c","a"]' && firstDock === 'c,a',
        { state: first.state, firstDock }
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
        state: { 'panel-pinned': ['a', 'b'], 'panel-order': ['b'] },
    });
    later.DOCK.start();
    const left = later.DOCK.items()
        .map(({ id }) => id)
        .join();
    check(
        'later the Dock is as the person left it, whatever the host app names',
        left === 'b,a' && JSON.stringify(later.state['panel-order']) === '["b"]',
        left
    );

    // A bundle that does not load, as deckit lists it, between two that do: it has no manifest fields and no run.
    const broken = { id: 'broken', refusal: { stage: 'read', kind: 'NOT_LOADABLE', message: 'no main.js' } };
    const listing = dockOver(createDock, {
        mods: [...named(['a']), broken, ...named(['b', 'switcher'])],
        fields: { a: {}, b: {}, switcher: { activationPolicy: 'accessory' } },
        managers: ['switcher'],
        running: ['b'],
    });
    listing.DOCK.start();
    const listed = await listing.ask('list', {}, 'switcher');
    check(
        'the list holds the app mods that load, marked as the Dock marks them, and no bundle that does not',
        listed.map(({ id, running }) => `${id}:${running}`).join() === 'a:false,b:true',
        listed
    );
    const refused = await listing.ask('list', {}, 'a').then(
        () => '',
        (error) => error.kind
    );
    check('a mod without deckit.mods is refused', refused === 'NOT_PERMITTED', refused);
    await listing.ask('setPinned', { id: 'b', pinned: false }, 'switcher');
    const keptNow = await listing.ask('pinned', {}, 'switcher');
    check(
        'a mod taken out of the Dock is no longer kept there, as kept',
        keptNow.join() === 'a' && JSON.stringify(listing.state['panel-pinned']) === '["a"]',
        keptNow
    );

    // `a` does not run, `b` runs with a window open, `c` runs with none.
    const opening = dockOver(createDock, {
        mods: named([...ids3, 'switcher']),
        fields: { ...apps(), switcher: { activationPolicy: 'accessory' } },
        managers: ['switcher'],
        running: ['b', 'c'],
        windowed: ['b'],
    });
    opening.DOCK.start();
    for (const id of ids3) await opening.ask('open', { id }, 'switcher');
    check(
        'a mod opened launches as it does not run, its windows come in front as it does, or its reopen() with none open',
        opening.launched.join() === 'a' &&
            opening.activated.join() === 'local:b,local:c' &&
            opening.reopened.length === 1 &&
            opening.reopened[0].mod === 'c' &&
            opening.shown.length === 3,
        opening
    );
    const accessory = await opening.ask('open', { id: 'switcher' }, 'switcher').then(
        () => '',
        (error) => error.message
    );
    check('a mod that is no app is refused', /is no app/.test(accessory), accessory);

    // The person at the desktop's page, the local seat's screen.
    const clicking = dockOver(createDock, {
        mods: named(ids3),
        fields: apps(),
        running: ['b', 'c'],
        windowed: ['b'],
        state: { 'panel-pinned': ['a', 'b'], 'panel-order': ['a', 'b'] },
    });
    clicking.DOCK.start();
    for (const id of ids3) clicking.click('click', { id });
    check(
        "a click on an item is the desktop page's seat's: it launches, has the windows come in front or reopens",
        clicking.launched.join() === 'a' &&
            clicking.activated.join() === 'local:b,local:c' &&
            clicking.reopened.length === 1 &&
            clicking.shown.length === 3,
        clicking
    );
    clicking.ask('click', { id: 'a' }, 'b');
    clicking.ask('quit', { id: 'b' }, 'b');
    check(
        "what a mod's page sends to the Dock's page channels does nothing",
        clicking.launched.length === 1 && clicking.quit.length === 0,
        clicking
    );
    const drawnBefore = clicking.updates.length;
    clicking.click('quit', { id: 'b' });
    clicking.click('keep', { id: 'c', pinned: true });
    const keptC = clicking.DOCK.items()
        .map(({ id, pinned }) => `${id}:${pinned}`)
        .join();
    check(
        'a mod quit from its menu quits, and one kept in the Dock is kept there, the desktop drawn again',
        clicking.quit.join() === 'b' &&
            keptC === 'a:true,b:true,c:true' &&
            JSON.stringify(clicking.state['panel-pinned']) === '["a","b","c"]' &&
            clicking.updates.length > drawnBefore,
        { quit: clicking.quit, keptC }
    );
    clicking.click('reorder', { ids: ['c', 'a'] });
    const reordered = clicking.DOCK.items()
        .map(({ id }) => id)
        .join();
    check(
        'the kept items dragged into a new order take it, as kept',
        reordered === 'c,b,a' && JSON.stringify(clicking.state['panel-order']) === '["c","b","a"]',
        { reordered, order: clicking.state['panel-order'] }
    );
    clicking.click('keep', { id: 'b', pinned: false });
    const unkeptB = clicking.DOCK.items()
        .map(({ id, pinned }) => `${id}:${pinned}`)
        .join();
    check(
        'a running mod taken out of the Dock stays, after those kept, as it runs',
        unkeptB === 'c:true,a:true,b:false',
        unkeptB
    );

    // `c` runs, then `a` launches, then `c` quits and launches again.
    const launching = dockOver(createDock, {
        mods: named(ids3),
        fields: apps(),
        running: ['c'],
        state: { 'panel-pinned': [], 'panel-order': [] },
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

    if (failed.length) {
        for (const line of failed) console.error(line);
        process.exit(1);
    }
    console.log(`ok: ${count} dock checks`);
    process.exit(0);
}

// The run of mod `id`, running, with its page, as deckit lists it.
function runOf(id) {
    return { run: { mod: { id }, state: 'running', relaunches: false }, page: { mod: id } };
}

// Mods as deckit lists them, by their ids.
function named(ids) {
    return ids.map((id) => ({ id, name: id.toUpperCase(), uses: {} }));
}

// `createDock` over stand-ins: `mods` as deckit lists them, `fields` each one's manifest fields, `managers` the mods
// that hold deckit.mods, `running` the mods that run, as `runs` lists them for a test to change, `windowed` those of
// them with a window open, `dock` as the host app hands it, `state` what the shell kept, and `refusesWrites` deckit
// refusing every write to state, as it does state it did not read. `ask(name, payload, mod)` asks one of the Dock's channels as the page of `mod`, and
// `click(name, payload)` sends one as the desktop's page, the local seat's screen.
function dockOver(
    createDock,
    { mods, fields, managers = [], running = [], windowed = [], dock = null, state = {}, refusesWrites = false }
) {
    const handlers = {};
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
            bind: (declared) => ({
                handle: (handler) => (handlers[declared.channel] = handler),
                on: (handler) => (handlers[declared.channel] = handler),
            }),
        },
        state: {
            read: (key, fallback) => state[key] ?? fallback,
            write: async (key, value) => {
                if (refusesWrites) throw new Error('the state the core keeps was not read');
                state[key] = value;
            },
        },
        log: { error() {} },
        mods: {
            list: () => mods,
            shipped: () => mods.filter(({ refusal }) => !refusal).map(({ id }) => id),
            runs: () => runs,
            runOf: (id) => runs.find(({ run }) => run.mod.id === id)?.run ?? null,
            fieldsOf: (id) => fields[id] ?? null,
            managerFrom: (sender) => {
                if (managers.includes(sender?.mod)) return sender.mod;
                throw Object.assign(new Error(`${sender?.mod} does not have deckit.mods`), { kind: 'NOT_PERMITTED' });
            },
            launch: async (id) => launched.push(id),
            quit: async (id) => quit.push(id),
        },
    };
    const DOCK = createDock({
        deckit,
        DESKTOP: {
            activate: (seat, id) => activated.push(`${seat}:${id}`) > 0 && windowed.includes(id),
            seatAt: (sender) => (sender === desktopPage ? 'local' : null),
            localSeat: 'local',
            update: () => updates.push(true),
        },
        WINDOWS: { reopen: (one) => reopened.push(one) },
        host: { show: () => shown.push(true) },
        dock,
    });
    const ask = async (name, payload, mod) => handlers[`deckit-shell:dock-${kebab(name)}`](payload, page(mod));
    // One of the Dock's channels sent from the desktop's page.
    const click = (name, payload) => handlers[`deckit-shell:dock-${kebab(name)}`](payload, desktopPage);
    return { DOCK, state, runs, launched, activated, reopened, shown, quit, updates, ask, click };
}

function kebab(name) {
    return name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
