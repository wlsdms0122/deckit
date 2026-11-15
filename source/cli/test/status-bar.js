// The Status Bar's model (mods/status-bar/src/bar/model/bar.js): the item a mod declares and the one it sets, each of
// another shape refused, the order the items came in, what an item is called, widths, the capsule's two regions, the
// fixed one in the kept list's order and the others from the right in a strip, an item going, one that shows nothing,
// a narrow room, the scroll held in range, an item scrolled out, one brought into view, a turn of the wheel, the list
// as an item is fixed or fixed no more, and the menu of a context press. Then the mod itself and the Clock over
// stand-ins for the handles, the document and the connections: the frame's exports reach a mod's `start`, the clock
// sets its label at start, the band opens as wide as the model lays, anchors are told, the shell is told a size and
// anchors only as they change, an item comes and goes, a narrow room scrolls what is not fixed, a context press and
// its menu's entry fix an item and fix it no more, a press runs the item's command, and what stands is drawn again by a
// screen that comes later. Exits 1 with a line for each check that failed.
const path = require('path');

const MODS = path.join(__dirname, '..', '..', 'deckit', 'mods');
const BAR = require(path.join(MODS, 'status-bar', 'src', 'bar', 'model', 'bar.js'));
const StatusBar = require(path.join(MODS, 'status-bar', 'src', 'main.js'));
const Clock = require(path.join(MODS, 'clock', 'src', 'main.js'));

const INTERFACE = 'status-bar/items';
const GLYPHS = ['star', 'bell'];
// A letter of a label as the stand-in document measures it.
const LETTER = 6;

// An element as the frame uses one: what it was given, its children, and its listeners by type.
function element(tag) {
    const listeners = {};
    return {
        tag,
        className: '',
        dataset: {},
        style: {},
        attributes: {},
        children: [],
        html: '',
        textContent: '',
        disabled: false,
        isConnected: false,
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        replaceChildren(...children) {
            this.children = children;
        },
        append(...children) {
            this.children.push(...children);
        },
        insertAdjacentHTML(where, html) {
            this.html += html;
        },
        addEventListener(type, listener) {
            (listeners[type] ??= []).push(listener);
        },
        fire(type, event) {
            for (const listener of listeners[type] ?? []) listener(event);
        },
        getBoundingClientRect() {
            return { width: this.textContent.length * LETTER };
        },
        click: () => Promise.all((listeners.click ?? []).map((listener) => listener())),
    };
}

// The shell's handle: a kit that draws GLYPHS and remembers the menus asked of it, and windows that remember what they
// were opened and told with.
function shellStandIn() {
    const windows = [];
    const menus = []; // each menu as the frame asked for it
    return {
        windows,
        menus,
        handle: {
            ui: {
                addStyle() {},
                menu: (given) => menus.push(given),
                icon(name) {
                    if (!GLYPHS.includes(name)) throw new Error(`no glyph ${name}`);
                    return `<svg data-glyph="${name}"></svg>`;
                },
            },
            windows: {
                open(options) {
                    const held = { options, size: [options.width, options.height], anchors: null, open: true };
                    held.told = 0; // how many times the window was resized or told anchors
                    windows.push(held);
                    options.content.isConnected = true;
                    return {
                        get room() {
                            return held.room ?? null;
                        },
                        resize: (width, height) => (held.told++, (held.size = [width, height])),
                        setAnchors: (anchors) => (held.told++, (held.anchors = anchors)),
                        close: () => (held.open = false),
                    };
                },
            },
        },
    };
}

// The runs of mods as the core connects them: `handle(id, name, lifecycle)` is the handle `deckit` of one lifecycle,
// and `settle()` connects each lifecycle that listens for an interface to exports opened in that lifecycle or one
// under it, and no other, as the core does.
function runs(declared) {
    const exported = new Map(); // interface -> { lifecycle, connect, disconnect }
    const listening = []; // { id, name, lifecycle, named, listener, connection, cleanup }
    const heard = []; // { named, listener }
    const kept = {}; // what the mod under test keeps in its records
    const handle = (id, name, lifecycle) => ({
        storage: {
            records: { get: (key, fallback) => kept[key] ?? fallback, set: (key, value) => (kept[key] = value) },
        },
        exports: {
            register: (...given) =>
                given.length === 2
                    ? exported.set(given[0], { lifecycle, ...given[1] })
                    : exported.set(id, { lifecycle, ...given[0] }),
            contributions: async (named) => declared[named] ?? [],
        },
        events: {
            on(named, listener) {
                const one = { named, listener };
                heard.push(one);
                return () => heard.splice(heard.indexOf(one), 1);
            },
        },
        dependencies: {
            onConnect: (named, listener) => listening.push({ id, name, lifecycle, named, listener, connection: null }),
        },
    });
    const settle = async () => {
        for (const one of listening) {
            const opened = exported.get(one.named);
            if (one.connection || !opened || opened.lifecycle > one.lifecycle) continue;
            one.connection = { mod: { name: one.name }, credential: { mod: one.id, permissions: [] } };
            one.cleanup = await one.listener(opened.connect(one.connection));
        }
        await new Promise((resolve) => setTimeout(resolve));
    };
    const leave = (id) => {
        for (const one of listening.filter((each) => each.id === id && each.connection)) {
            exported.get(one.named).disconnect?.(one.connection);
            one.connection = null;
        }
    };
    const connected = (id, named) => listening.some((one) => one.id === id && one.named === named && one.connection);
    return { handle, settle, leave, connected, heard, exported, kept };
}

async function main() {
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);

    const declared = BAR.declaredOf({ name: 'Seats', icon: 'users', command: 'show' });
    const bare = BAR.declaredOf({ name: 'Clock' });
    check(
        'a declared item is taken with what it does not say filled in',
        same(declared, { name: 'Seats', icon: 'users', command: 'show' }) &&
            same(bare, { name: 'Clock', icon: null, command: null }),
        { declared, bare }
    );
    const undeclared = [
        null,
        [],
        {},
        { name: '' },
        { name: 'x'.repeat(65) },
        { name: 'A', icon: 7 },
        { name: 'A', icon: 'a b' },
        { name: 'A', command: 'a.b' },
        { name: 'A', label: 'now' },
    ].map(BAR.declaredOf);
    check(
        'a declared item of another shape is not there',
        undeclared.every((one) => one === null),
        undeclared
    );

    const set = BAR.heldTo({ name: 'Star', icon: 'star', count: 2, command: 'open' });
    check(
        'an item set at run time is taken with what it does not say filled in',
        same(set, { name: 'Star', icon: 'star', command: 'open', label: '', count: 2, tone: 'plain' }),
        set
    );
    const changed = BAR.heldTo({ label: 'Sun 3:04 PM', tone: 'attention' }, bare);
    check(
        'a mod with a declared item sets what changes of it',
        same(changed, {
            name: 'Clock',
            icon: null,
            command: null,
            label: 'Sun 3:04 PM',
            count: null,
            tone: 'attention',
        }),
        changed
    );
    check(
        'a declared item rests with no label, no count and a plain tone',
        same(BAR.restOf(declared), { ...declared, label: '', count: null, tone: 'plain' }),
        BAR.restOf(declared)
    );
    const refused = [
        BAR.heldTo(null),
        BAR.heldTo({ icon: 'star' }),
        BAR.heldTo({ name: 'A', count: -1 }),
        BAR.heldTo({ name: 'A', count: 1.5 }),
        BAR.heldTo({ name: 'A', tone: 'loud' }),
        BAR.heldTo({ name: 'A', label: 'x'.repeat(25) }),
        BAR.heldTo({ name: 'A', label: 7 }),
        BAR.heldTo({ name: 'A', fixed: true }),
        BAR.heldTo({ name: 'Other' }, bare),
        BAR.heldTo({ icon: 'star' }, bare),
        BAR.heldTo({ command: 'open' }, bare),
    ];
    check(
        'an item of another shape is refused, as is a declared one that sets what it declared',
        refused.every((one) => one === null),
        refused
    );

    const order = BAR.orderOf(['seats', 'bell', 'star'], ['new', 'star', 'seats', 'new']);
    check(
        'the kept order keeps one whose item went where it was, and one that is new comes last, once',
        order.join() === 'seats,bell,star,new',
        order
    );

    const called = [
        BAR.titleOf({ name: 'Clock', count: null, tone: 'plain' }),
        BAR.titleOf({ name: 'Seats', count: 2, tone: 'plain' }),
        BAR.titleOf({ name: 'Seats', count: 250, tone: 'attention' }),
        BAR.titleOf({ name: 'Clock', label: 'Mon 10:42', count: null, tone: 'plain' }),
        BAR.titleOf({ name: 'Seats', label: 'Ada', count: 2, tone: 'attention' }),
    ];
    check(
        'an item is called by its name, what its label says, its count and its attention',
        same(called, ['Clock', 'Seats, 2', 'Seats, 99+, attention', 'Clock, Mon 10:42', 'Seats, Ada, 2, attention']),
        called
    );

    const face = BAR.faceOf(BAR.heldTo({ name: 'Seats', icon: 'star', command: 'show', label: 'Al', count: 250 }));
    const still = BAR.faceOf(BAR.restOf({ name: 'Clock', icon: null, command: null }));
    check(
        "an item's button shows its title, tone, glyph, label and count as written, and whether a press runs",
        same(face, {
            title: 'Seats, Al, 99+',
            tone: 'plain',
            pressable: true,
            icon: 'star',
            label: 'Al',
            count: '99+',
        }) && same(still, { title: 'Clock', tone: 'plain', pressable: false, icon: null, label: '', count: '' }),
        { face, still }
    );

    const item = (id, given) => ({ id, ...BAR.heldTo({ name: id, ...given }) });
    const widths = [
        item('a', { icon: 'bell' }),
        item('b', { icon: 'bell', count: 7 }),
        item('c', { icon: 'bell', count: 250 }),
        item('d', { label: 'abcd' }),
        item('e', { icon: 'bell', label: 'x'.repeat(24) }),
    ].map((each) => BAR.widthOf(each, { ['x'.repeat(24)]: 900 }));
    check(
        'a glyph is 32 wide, a count adds its characters, a label its width, measured or not, 160 at most',
        widths.join() === '32,43,57,44,196',
        widths
    );

    const clock = item('clock', { label: 'Sun 3:04 PM' });
    const bell = item('bell', { icon: 'bell' });
    const seats = item('seats', { icon: 'users', count: 2 });
    const measured = { 'Sun 3:04 PM': 80 };
    const rect = (x, width) => ({ x, y: 2, width, height: 24 });
    const at = (x, width) => ({ x, y: 0, width, height: 24 });
    const bar = BAR.barOf([clock, bell, seats], { widths: measured, fixed: ['clock'] });
    check(
        'the fixed item stands at the right end, the others from the right of a strip left of it, 4 apart, 2 inside',
        same(bar, {
            width: 183,
            height: 28,
            scroll: 0,
            most: 0,
            fixed: rect(85, 96),
            scrolled: { ...rect(2, 79), extent: 79 },
            items: [
                { id: 'clock', at: at(0, 96), region: 'fixed', rect: rect(85, 96) },
                { id: 'bell', at: at(47, 32), region: 'scrolled', rect: rect(49, 32) },
                { id: 'seats', at: at(0, 43), region: 'scrolled', rect: rect(2, 43) },
            ],
        }),
        bar
    );
    const listed = BAR.barOf([clock, bell, seats], { widths: measured, fixed: ['gone', 'seats', 'clock'] });
    check(
        "the fixed items stand in the kept list's order, the first rightmost, one that does not stand left out",
        same(
            listed.items.map(({ id, region, rect: { x } }) => [id, region, x]),
            [
                ['seats', 'fixed', 138],
                ['clock', 'fixed', 38],
                ['bell', 'scrolled', 2],
            ]
        ) &&
            same(listed.fixed, rect(38, 143)) &&
            BAR.FIXED.join() === 'clock,notifications',
        listed
    );
    const loose = BAR.barOf([clock, bell], { widths: measured });
    check(
        'with nothing fixed every item is in the strip and there is no fixed region',
        loose.fixed === null && loose.width === 136 && loose.items.every(({ region }) => region === 'scrolled'),
        loose
    );
    const without = BAR.barOf([clock, seats], { widths: measured, fixed: ['clock'] });
    check(
        'as an item goes the capsule narrows by it and those left of it keep their place from its left end',
        without.width === 147 && same(without.items[1].rect, rect(2, 43)),
        without
    );
    const none = BAR.barOf([], { fixed: ['clock'] });
    check(
        'with no item there is no capsule',
        none.width === 0 && none.items.length === 0 && none.fixed === null && none.scrolled === null,
        none
    );
    const blank = BAR.barOf([{ id: 'blank', ...BAR.restOf(BAR.declaredOf({ name: 'Blank' })) }, bell]);
    check(
        'an item that shows nothing is not laid',
        blank.width === 36 && blank.items.length === 1 && blank.items[0].id === 'bell',
        blank
    );

    // A room 150 wide: the clock's region stays, and 48 are left for a strip 79 wide.
    const room = { width: 150, height: 52 };
    const narrow = BAR.barOf([clock, bell, seats], { widths: measured, fixed: ['clock'], room });
    check(
        'in a narrow room the capsule is as wide as the room, the fixed region whole and the strip scrolled under ' +
            'what is left: an item partly in view has the part in view as its rect, one scrolled out has none',
        narrow.width === 150 &&
            same(narrow.fixed, rect(52, 96)) &&
            same(narrow.scrolled, { ...rect(2, 46), extent: 79 }) &&
            narrow.most === 33 &&
            same(
                narrow.items.map(({ rect: laid }) => laid),
                [rect(52, 96), null, rect(2, 43)]
            ),
        narrow
    );
    const turned = [-20, 10, 33, 900].map((scroll) =>
        BAR.barOf([clock, bell, seats], { widths: measured, fixed: ['clock'], room, scroll })
    );
    check(
        'the scroll is held from 0 to the most, and the strip moves left by it: what was scrolled out comes into view',
        same(
            turned.map(({ scroll }) => scroll),
            [0, 10, 33, 33]
        ) &&
            same(
                turned[1].items.map(({ rect: laid }) => laid),
                [rect(52, 96), rect(39, 9), rect(2, 33)]
            ) &&
            same(
                turned[2].items.map(({ rect: laid }) => laid),
                [rect(52, 96), rect(16, 32), rect(2, 10)]
            ) &&
            same(turned[2].items[1].at, at(47, 32)),
        turned
    );
    const brought = [
        BAR.scrollTo(narrow, 'bell'),
        BAR.scrollTo(turned[2], 'seats'),
        BAR.scrollTo(turned[1], 'seats'),
        BAR.scrollTo(narrow, 'seats'),
        BAR.scrollTo(narrow, 'clock'),
        BAR.scrollTo(BAR.barOf([clock, bell], { widths: measured, room: { width: 60 } }), 'clock'),
    ];
    check(
        'an item is brought into view whole by the least scroll, a fixed one by none, one wider than the strip shows ' +
            'from its left end',
        same(brought, [33, 0, 0, 0, 0, 36]),
        brought
    );
    const tight = BAR.barOf([clock, bell], { widths: measured, fixed: ['clock'], room: { width: 90, height: 52 } });
    check(
        'a room that holds no more than the fixed items leaves the fixed region whole and no scrolled region',
        tight.width === 100 &&
            same(tight.fixed, rect(2, 96)) &&
            tight.scrolled === null &&
            tight.items[1].rect === null,
        tight
    );
    const turns = [BAR.turnOf({ dx: 12, dy: 3 }), BAR.turnOf({ dx: 0, dy: -40 }), BAR.turnOf({ dx: -5, dy: 5 })];
    check(
        'a turn of the wheel scrolls by its sideways part, or by the vertical one where that is the larger',
        same(turns, [12, -40, -5]),
        turns
    );
    const start = ['clock', 'notifications'];
    const fixedNext = [
        BAR.fixedBy(start, 'bell', true),
        BAR.fixedBy(start, 'clock', true),
        BAR.fixedBy(['clock', 'bell', 'seats'], 'bell', false),
        BAR.fixedBy(start, 'bell', false),
        BAR.fixedBy(BAR.fixedBy(start, 'gone', true), 'notifications', false),
    ];
    check(
        'an item fixed comes last in the list and one fixed no more leaves it; the others keep their order, one fixed ' +
            'already or not fixed leaves the list as it is, an id whose item does not stand is kept, and the list ' +
            'given is not changed',
        same(fixedNext, [
            ['clock', 'notifications', 'bell'],
            ['clock', 'notifications'],
            ['clock', 'seats'],
            ['clock', 'notifications'],
            ['clock', 'gone'],
        ]) && same(start, ['clock', 'notifications']),
        fixedNext
    );
    const absent = BAR.barOf([clock, bell], { widths: measured, fixed: ['clock', 'gone', 'bell'] });
    check(
        'an item fixed whose mod gives nothing shows nothing and keeps its place in the list: the others stand as ' +
            'the list has them',
        absent.items.map(({ id, region }) => `${id} ${region}`).join() === 'clock fixed,bell fixed' &&
            absent.scrolled === null &&
            absent.items[1].rect.x < absent.items[0].rect.x,
        absent
    );
    const asked = [
        BAR.menuOf(narrow, ['clock'], { x: 60, y: 14 }),
        BAR.menuOf(narrow, ['clock'], { x: 10, y: 14 }),
        BAR.menuOf(narrow, ['clock'], { x: 47, y: 14 }),
        BAR.menuOf(narrow, ['clock'], { x: 10, y: 27 }),
    ];
    check(
        'a context press on an item opens one entry under the capsule, at the left end of what shows of the item: ' +
            "Don't Keep in Bar on a fixed one, Keep in Bar on another, and none where no item is in view",
        same(asked, [
            { id: 'clock', label: "Don't Keep in Bar", on: false, point: { x: 52, y: 32 } },
            { id: 'seats', label: 'Keep in Bar', on: true, point: { x: 2, y: 32 } },
            null,
            null,
        ]),
        asked
    );

    await modChecks(check);

    if (failed.length) {
        for (const line of failed) console.error(line);
        console.error(`${failed.length} of ${count} checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} checks of the status bar`);
}

// The mod and the Clock as they run: each `start`, then the frame's `attach`, connected as the core connects.
async function modChecks(check) {
    global.document = { createElement: element };
    const clockDeclared = {
        mod: { name: 'Clock' },
        credential: { mod: 'clock' },
        entry: { name: 'Clock' },
    };
    const world = runs({ [INTERFACE]: [clockDeclared] });
    const shell = shellStandIn();
    const ran = [];
    const frame = new StatusBar();
    frame.start(world.handle('status-bar', 'Status Bar', 0));
    const screen = world.handle('status-bar', 'Status Bar', 1);
    world.exported.set('deckit/commands', {
        lifecycle: 0,
        connect: () => ({ run: async (...args) => ran.push(args) }),
    });
    frame.attach(shell.handle, screen);
    const clock = new Clock();
    clock.start(world.handle('clock', 'Clock', 0));
    await world.settle();
    check(
        "the frame's exports are opened in start, so a mod that sets its item in its own start is connected",
        world.exported.get(INTERFACE)?.lifecycle === 0 && world.connected('clock', INTERFACE),
        { opened: world.exported.get(INTERFACE)?.lifecycle, clock: world.connected('clock', INTERFACE) }
    );
    const band = shell.windows[0];
    const labelOf = (button) => button.children.find((child) => child.className === 'status-bar-label')?.textContent;
    const within = (node) => [node, ...node.children.flatMap(within)];
    const buttons = () => within(band.options.content).filter((child) => child.tag === 'button');
    const regionOf = (name) => within(band.options.content).find((child) => child.className === `status-bar-${name}`);
    const label = buttons()[0] && labelOf(buttons()[0]);
    check(
        'the clock sets its label at start, and the band opens at the top as a panel, as wide as the model lays it',
        shell.windows.length === 1 &&
            band.options.level === 'panel' &&
            band.options.name === 'bar' &&
            buttons().length === 1 &&
            buttons()[0].dataset.item === 'clock' &&
            typeof label === 'string' &&
            label.length > 0 &&
            band.size[1] === BAR.CAPSULE.height,
        { windows: shell.windows.length, size: band?.size, label }
    );
    const anchorOf = (id) => band.anchors?.find((anchor) => anchor.id === id);
    check(
        "each item's rect is told as an anchor given to the item's mod",
        band.anchors?.length === 1 && anchorOf('clock').mod === 'clock' && anchorOf('clock').rect.width > 0,
        band?.anchors
    );
    // The band appears: the label is measured in the frame's document and laid as wide as it draws.
    band.options.didAppear();
    const measured = BAR.barOf([{ id: 'clock', icon: null, label, count: null }], {
        widths: { [label]: label.length * LETTER },
        fixed: frame.items.fixed(),
    });
    check(
        'as the band appears a label is laid as wide as it is measured, the clock fixed as a new machine has it',
        band.size[0] === measured.width &&
            anchorOf('clock').rect.width === measured.items[0].rect.width &&
            regionOf('fixed').children[0]?.dataset.item === 'clock',
        { size: band.size, measured }
    );
    // A mod with no declared item gives one from a lifecycle of its own screen, sets it anew, and takes it back.
    let item = null;
    world.handle('star', 'Star', 1).dependencies.onConnect(INTERFACE, (connected) => (item = connected));
    await world.settle();
    const alone = band.size[0];
    await item.set({ name: 'Star', icon: 'star', command: 'show' });
    const came = { width: band.size[0], ids: buttons().map((button) => button.dataset.item), anchors: band.anchors };
    check(
        'an item a mod sets comes left of the declared one, the band wider by it and a gap, its anchor told',
        came.width === alone + 32 + BAR.CAPSULE.gap &&
            came.ids.join() === 'star,clock' &&
            regionOf('strip').children[0]?.dataset.item === 'star' &&
            anchorOf('star').mod === 'star' &&
            anchorOf('star').rect.x < anchorOf('clock').rect.x,
        came
    );
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120, tone: 'attention' });
    const star = () => buttons().find((button) => button.dataset.item === 'star');
    check(
        'an item set anew is drawn with its count and its tone, and named by them',
        star().attributes['aria-label'] === 'Star, 99+, attention' && star().dataset.tone === 'attention',
        star().attributes
    );
    const before = band.told;
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120, tone: 'attention' });
    const same = { told: band.told - before, name: star().attributes['aria-label'] };
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120 });
    const drawn = { told: band.told - before, name: star().attributes['aria-label'] };
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120, tone: 'attention' });
    check(
        'an item set anew that leaves the capsule and its anchors as they are is drawn, and the shell is told nothing',
        same.told === 0 && drawn.told === 0 && drawn.name === 'Star, 99+' && same.name === 'Star, 99+, attention',
        { same, drawn }
    );
    // What a seat read of the bar names its buttons: one stands as the same element while its item does.
    const clockButton = () => buttons().find((button) => button.dataset.item === 'clock');
    const held = { star: star(), clock: clockButton() };
    await item.set({ name: 'Star', icon: 'star', command: 'show', label: 'new', count: 3 });
    const anew = {
        star: star() === held.star,
        clock: clockButton() === held.clock,
        label: labelOf(star()),
        name: star().attributes['aria-label'],
        tone: star().dataset.tone,
    };
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120, tone: 'attention' });
    check(
        "an item's button is the same element once the item is set in another shape, as is another item's, and it " +
            'shows what was set',
        anew.star && anew.clock && anew.label === 'new' && anew.name === 'Star, new, 3' && anew.tone === 'plain',
        anew
    );
    check(
        'a button set back shows what it showed, the same element still',
        star() === held.star &&
            labelOf(star()) === undefined &&
            star().attributes['aria-label'] === 'Star, 99+, attention',
        star().attributes
    );
    const refused = [];
    for (const given of [{ name: 'Star', label: 'x'.repeat(25) }, { name: 'Star', icon: 'comet' }, { label: 'now' }])
        refused.push(
            await item.set(given).then(
                () => 'taken',
                (error) => error.kind
            )
        );
    check(
        'an item of another shape, or of a glyph the kit does not draw, is refused and the one set before stands',
        refused.every((kind) => kind === 'INVALID_ARGUMENT') &&
            star().attributes['aria-label'] === 'Star, 99+, attention',
        refused
    );
    // A room that holds the clock and 34 more: a second item comes into the strip, and the wheel turns over it.
    const room = { width: alone + BAR.CAPSULE.gap + 34, height: 52 };
    band.room = room;
    band.options.didChangeRoom();
    let moon = null;
    world.handle('moon', 'Moon', 1).dependencies.onConnect(INTERFACE, (connected) => (moon = connected));
    await world.settle();
    await moon.set({ name: 'Moon', icon: 'bell' });
    const anchored = () => ({ ids: band.anchors.map(({ id }) => id), clock: anchorOf('clock').rect });
    const narrow = {
        width: band.size[0],
        ...anchored(),
        moon: anchorOf('moon')?.rect,
        more: regionOf('scrolled').dataset.more,
    };
    let prevented = 0;
    regionOf('scrolled').fire('wheel', { deltaX: 0, deltaY: 500, preventDefault: () => prevented++ });
    const turned = { ...anchored(), star: anchorOf('star')?.rect, more: regionOf('scrolled').dataset.more };
    turned.strip = regionOf('strip').style.transform;
    world.leave('moon');
    band.room = null;
    band.options.didChangeRoom();
    check(
        'in a narrow room the band is as wide as the room and the clock stays; an item that comes is in view and one ' +
            'scrolled out has no anchor, and a turn of the wheel over the strip scrolls it',
        narrow.width === room.width &&
            narrow.ids.join() === 'clock,moon' &&
            JSON.stringify(narrow.moon) === JSON.stringify({ x: 2, y: 2, width: 32, height: 24 }) &&
            narrow.more === 'right' &&
            prevented === 1 &&
            turned.ids.join() === 'clock,star' &&
            JSON.stringify(turned.clock) === JSON.stringify(narrow.clock) &&
            turned.star.width === 34 &&
            turned.more === 'left' &&
            turned.strip === 'translateX(-59px)' &&
            band.size[0] === alone + 57 + BAR.CAPSULE.gap,
        { narrow, turned, now: band.size }
    );
    world.kept.fixed = ['star'];
    const kept = frame.items.fixed();
    delete world.kept.fixed;
    check(
        'what is fixed is the list the frame keeps, and the clock and the notifications item where it keeps none',
        kept.join() === 'star' && frame.items.fixed().join() === 'clock,notifications',
        kept
    );
    // A context press on the item in the strip, and its menu's entry taken: the item is fixed, left of the clock.
    const regionIds = (name) => (regionOf(name)?.children ?? []).map((child) => child.dataset.item).join();
    let stopped = 0;
    const context = (id) => {
        const { x, y } = anchorOf(id).rect;
        band.options.content.fire('contextmenu', { clientX: x + 1, clientY: y + 1, preventDefault: () => stopped++ });
        return shell.menus.at(-1);
    };
    band.options.content.fire('contextmenu', { clientX: 1, clientY: 1, preventDefault: () => stopped++ });
    const nowhere = { menus: shell.menus.length, prevented: stopped };
    const loose = { strip: regionIds('strip'), fixed: regionIds('fixed'), kept: world.kept.fixed ?? null };
    const keeps = context('star');
    keeps.items[0].run();
    const fixed = {
        label: keeps.items[0].label,
        point: keeps.point,
        strip: regionIds('strip'),
        fixed: regionIds('fixed'),
        kept: world.kept.fixed,
        width: band.size[0],
        right: anchorOf('star').rect.x < anchorOf('clock').rect.x,
    };
    check(
        'a context press on an item opens its menu under the capsule, and Keep in Bar fixes it: the list is kept ' +
            'from the one a new machine starts with, and the item stands in the fixed region left of the clock',
        nowhere.menus === 0 &&
            nowhere.prevented === 0 &&
            stopped === 1 &&
            loose.strip === 'star' &&
            loose.fixed === 'clock' &&
            loose.kept === null &&
            keeps.items.length === 1 &&
            fixed.label === 'Keep in Bar' &&
            fixed.point.x === 2 &&
            fixed.point.y === BAR.CAPSULE.height + BAR.CAPSULE.gap &&
            fixed.strip === '' &&
            fixed.fixed === 'clock,star' &&
            fixed.kept.join() === 'clock,notifications,star' &&
            fixed.width === alone + 57 + BAR.CAPSULE.gap &&
            fixed.right,
        { nowhere, loose, fixed }
    );
    // A fixed item whose mod takes it back shows nothing and stays in the list: it stands fixed again as it is set.
    await item.remove();
    const away = { fixed: regionIds('fixed'), kept: world.kept.fixed.join(), width: band.size[0] };
    await item.set({ name: 'Star', icon: 'star', command: 'show', count: 120, tone: 'attention' });
    const given = { fixed: regionIds('fixed'), strip: regionIds('strip') };
    const removes = context('star');
    removes.items[0].run();
    const freed = {
        label: removes.items[0].label,
        strip: regionIds('strip'),
        fixed: regionIds('fixed'),
        kept: world.kept.fixed.join(),
    };
    delete world.kept.fixed;
    check(
        'an item fixed while its mod gives nothing keeps its place in the list and stands fixed again as it is given; ' +
            "Don't Keep in Bar on a fixed item lets it scroll with the others again",
        away.fixed === 'clock' &&
            away.kept === 'clock,notifications,star' &&
            away.width === alone &&
            given.fixed === 'clock,star' &&
            given.strip === '' &&
            freed.label === "Don't Keep in Bar" &&
            freed.strip === 'star' &&
            freed.fixed === 'clock' &&
            freed.kept === 'clock,notifications',
        { away, given, freed }
    );
    await star().click();
    const still = buttons().find((button) => button.dataset.item === 'clock');
    check(
        "a press on an item runs its command on its mod through the commands' owner; the clock, with none, takes no press",
        JSON.stringify(ran) === JSON.stringify([['star', 'show']]) &&
            still.disabled === true &&
            star().disabled === false,
        { ran, clock: still.disabled, star: star().disabled }
    );
    await item.remove();
    const removed = band.size[0];
    await item.set({ name: 'Star', icon: 'star' });
    world.leave('star');
    check(
        'an item goes as its mod removes it and as its connection ends, and the band narrows to what is left',
        removed === alone && band.size[0] === alone && buttons().length === 1 && band.anchors.length === 1,
        { removed, alone, now: band.size }
    );
    check('the clock runs no command: it opens no exports of its own', !world.exported.has('clock'), [
        ...world.exported.keys(),
    ]);
    // The screen goes and another comes: what stands is held by the mod, not by the capsule.
    frame.detach();
    const closed = band.open === false;
    frame.attach(shell.handle, world.handle('status-bar', 'Status Bar', 1));
    check(
        'the band closes with its screen, and a screen that comes later draws what stands',
        closed && shell.windows.length === 2 && shell.windows[1].anchors?.[0]?.id === 'clock',
        { closed, windows: shell.windows.length }
    );
    // What is declared is read again on the interface's signals: with none declared and none set the band closes.
    world.leave('clock');
    clock.stop();
    const again = world.heard.filter(({ named }) => named === `${INTERFACE}:contributions-changed`);
    check(
        'the frame hears the signals of its interface',
        again.length === 1,
        world.heard.map(({ named }) => named)
    );
    frame.detach();
    frame.stop();
    check('the frame hears no signal once it has stopped', world.heard.length === 0, world.heard.length);
    // The frame runs again over what it kept, and the mods give their items in another order than they first came in.
    const next = new StatusBar();
    next.start(world.handle('status-bar', 'Status Bar', 0));
    const giver = (id, name) => next.items.exportsFor({ mod: { name }, credential: { mod: id } });
    await giver('moon', 'Moon').set({ name: 'Moon', icon: 'bell' });
    await giver('star', 'Star').set({ name: 'Star', icon: 'star' });
    await giver('sun', 'Sun').set({ name: 'Sun', icon: 'star' });
    const back = next.items.standing().map(({ id }) => id);
    await giver('star', 'Star').remove();
    const without = next.items.standing().map(({ id }) => id);
    next.stop();
    check(
        'over a run of the frame an item that comes back takes its old place in the order the frame keeps, a new ' +
            'one comes at the newest end, and one that goes keeps its place in what is kept',
        back.join() === 'clock,star,moon,sun' &&
            without.join() === 'clock,moon,sun' &&
            world.kept.order.join() === 'clock,star,moon,sun',
        { back, without, kept: world.kept.order }
    );
}

main();
