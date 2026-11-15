// The Status Bar's model (mods/status-bar/src/bar/model/bar.js): the item a mod declares and the one it sets, each of
// another shape refused, the order the items came in, what an item is called, widths, the capsule's two regions, the
// fixed one in the kept list's order and the others from the right in a strip, an item going, one that shows nothing,
// a narrow room, the scroll held in range, an item scrolled out, one brought into view and a turn of the wheel. Then
// the mod itself and the Clock over stand-ins for the handles, the document and the connections: the frame's exports
// reach a mod's `start`, the clock sets its label at start, the band opens as wide as the model lays, anchors are
// told, the shell is told a size and anchors only as they change, an item comes and goes, a press runs the item's
// command, and what stands is drawn again by a screen that comes later. Exits 1 with a line for each check that failed.
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
        getBoundingClientRect() {
            return { width: this.textContent.length * LETTER };
        },
        click: () => Promise.all((listeners.click ?? []).map((listener) => listener())),
    };
}

// The shell's handle: a kit that draws GLYPHS, and windows that remember what they were opened and told with.
function shellStandIn() {
    const windows = [];
    return {
        windows,
        handle: {
            ui: {
                addStyle() {},
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
        storage: { records: { get: (key, fallback) => kept[key] ?? fallback } },
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

    const order = BAR.orderOf(['seats', 'bell', 'star'], ['new', 'star', 'seats']);
    check('the items keep the order they began in, one that went leaves it', order.join() === 'seats,star,new', order);

    const called = [
        BAR.titleOf({ name: 'Clock', count: null, tone: 'plain' }),
        BAR.titleOf({ name: 'Seats', count: 2, tone: 'plain' }),
        BAR.titleOf({ name: 'Seats', count: 250, tone: 'attention' }),
    ];
    check(
        'an item is called by its name, its count and its attention',
        same(called, ['Clock', 'Seats, 2', 'Seats, 99+, attention']),
        called
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
        entry: { name: 'Clock', command: 'toggle-center' },
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
    // The notification center's exports are opened on screen, in the second lifecycle of its mod.
    let toggled = 0;
    world.exported.set('notifications/center', { lifecycle: 1, connect: () => ({ toggle: async () => ++toggled }) });
    const clock = new Clock();
    clock.start(world.handle('clock', 'Clock', 0));
    clock.attach(shell.handle, world.handle('clock', 'Clock', 1));
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
    world.kept.fixed = ['star'];
    const kept = frame.items.fixed();
    delete world.kept.fixed;
    check(
        'what is fixed is the list the frame keeps, and the clock and the notifications item where it keeps none',
        kept.join() === 'star' && frame.items.fixed().join() === 'clock,notifications',
        kept
    );
    await star().click();
    await buttons()
        .find((button) => button.dataset.item === 'clock')
        .click();
    check(
        "a press on an item runs its command on its mod through the commands' owner",
        JSON.stringify(ran) ===
            JSON.stringify([
                ['star', 'show'],
                ['clock', 'toggle-center'],
            ]),
        ran
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
    const command = world.exported.get('clock').connect({});
    await command.runCommand('toggle-center');
    const other = await command.runCommand('show').then(
        () => 'ran',
        () => 'refused'
    );
    check(
        "the clock's command toggles the notification center, reached from a lifecycle its exports reach",
        world.connected('clock', 'notifications/center') && toggled === 1 && other === 'refused',
        { connected: world.connected('clock', 'notifications/center'), toggled, other }
    );
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
}

main();
