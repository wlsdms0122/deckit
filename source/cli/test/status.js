// The status bar (deckit-shell/shell/status): its model (model/status), the item the frame takes and the one it does
// not, the order the items began to be there in, the capsule and its items from the right, the fixed ones rightmost,
// an item going, widths, the popover under its item, kept inside the stage, as high as its rows and scrolled beyond
// the desktop's height, the part a point is on, what a press opens, closes and tells, a press down outside, an item
// that went, where a ref is and what the desktop's page draws; and the bar (status/main) over providers: each seat's
// items, a press told to the item's provider with the seat, a label's measured width, and a provider that ends.
// Exits 1 with a line for each check that failed. The packages are ES modules, so they are imported as such.
const path = require('path');
const { pathToFileURL } = require('url');

const url = (...parts) => pathToFileURL(path.join(__dirname, '..', '..', 'deckit', ...parts)).href;

async function main() {
    const STATUS = await import(url('deckit-shell', 'shell', 'status', 'model', 'status.js'));
    const { createStatus } = await import(url('deckit-shell', 'shell', 'status', 'main.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };
    const same = (one, other) => JSON.stringify(one) === JSON.stringify(other);
    const stage = { width: 1000, height: 600 };
    const strip = { height: 52, controlsWidth: 80 };
    const held = (...given) => given.map(STATUS.heldTo);

    const taken = STATUS.heldTo({ id: 'seats', icon: 'users', count: 2, rows: [{ id: 's2', title: 'Ada' }] });
    check(
        'an item is taken with what it does not say filled in',
        same(taken, {
            id: 'seats',
            name: 'seats',
            icon: 'users',
            label: '',
            count: 2,
            tone: 'plain',
            fixed: false,
            rows: [
                {
                    id: 's2',
                    icon: null,
                    tint: null,
                    title: 'Ada',
                    detail: '',
                    meta: '',
                    state: '',
                    presses: false,
                    closes: false,
                    actions: [],
                },
            ],
            actions: [],
        }),
        taken
    );
    const refused = [
        null,
        { id: 'a.b' },
        { id: 'a', count: -1 },
        { id: 'a', tone: 'loud' },
        { id: 'a', icon: 7 },
        { id: 'a', rows: {} },
        { id: 'a', rows: [{ id: 'r' }, { id: 'r' }] },
        { id: 'a', rows: [{ id: 'r' }], actions: [{ id: 'r' }] },
        { id: 'a', rows: [{ id: 'r', actions: [{ id: 'close' }] }] },
    ].map(STATUS.heldTo);
    check(
        'an item of another shape is not there',
        refused.every((one) => one === null),
        refused
    );

    const order = STATUS.orderOf(['clock', 'seats', 'bell'], [{ id: 'new' }, { id: 'bell' }, { id: 'clock' }]);
    check('the items keep the order they began in, one that went leaves it', order.join() === 'clock,bell,new', order);

    const [clock, seats, bell] = held(
        { id: 'clock', label: 'Sun 3:04 PM', fixed: true },
        { id: 'seats', icon: 'users', count: 2, rows: [] },
        { id: 'bell', icon: 'bell', fixed: true, rows: [] }
    );
    const bar = STATUS.barOf(stage, strip, [clock, seats, bell], { 'Sun 3:04 PM': 80 });
    check(
        'the items stand from the right, the fixed ones first, in a capsule 8 in from the bar and centred on it',
        same(bar, {
            capsule: { x: 809, y: 12, width: 183, height: 28 },
            items: [
                { id: 'clock', rect: { x: 894, y: 14, width: 96, height: 24 } },
                { id: 'bell', rect: { x: 858, y: 14, width: 32, height: 24 } },
                { id: 'seats', rect: { x: 811, y: 14, width: 43, height: 24 } },
            ],
        }),
        bar
    );
    const without = STATUS.barOf(stage, strip, [clock, seats], { 'Sun 3:04 PM': 80 });
    check(
        'as an item goes those left of it move right',
        without.items[1].id === 'seats' && without.items[1].rect.x === 847 && without.capsule.x === 845,
        without
    );
    check('with no item there is no capsule', STATUS.barOf(stage, strip, []).capsule === null, null);
    const widths = held(
        { id: 'a', icon: 'bell' },
        { id: 'b', icon: 'bell', count: 7 },
        { id: 'c', icon: 'bell', count: 250 },
        { id: 'd', label: 'abcd' },
        { id: 'e', icon: 'bell', label: 'x'.repeat(100) }
    ).map((item) => STATUS.barOf(stage, strip, [item], { ['x'.repeat(100)]: 900 }).items[0].rect.width);
    check(
        'a glyph is 32 wide, a count adds its characters, a label its width, measured or not, 240 at most',
        widths.join() === '32,43,57,44,276',
        widths
    );

    const row = (id, more = {}) => ({ id, title: id, ...more });
    const allow = [
        { id: 'deny', title: 'Deny' },
        { id: 'allow', title: 'Allow', prominent: true },
    ];
    const [asked] = held({
        id: 'seats',
        icon: 'users',
        rows: [row('a1', { actions: allow }), row('s2', { presses: true }), row('s3', { closes: true })],
        actions: [{ id: 'clear', title: 'Clear All' }],
    });
    const askedBar = STATUS.barOf(stage, strip, [clock, asked], { 'Sun 3:04 PM': 80 });
    const popover = STATUS.popoverOf(stage, strip, askedBar, asked, 0);
    check(
        'the popover stands 8 under the bar, its right edge in line with its item, as high as its header and rows',
        same(popover.rect, { x: 570, y: 60, width: 320, height: 196 }) &&
            same(popover.header.actions, [{ id: 'clear', rect: { x: 810, y: 60, width: 72, height: 32 } }]) &&
            same(
                popover.rows.map(({ rect }) => [rect.y, rect.height]),
                [
                    [92, 76],
                    [168, 44],
                    [212, 44],
                ]
            ) &&
            same(popover.rows[0].actions, [
                { id: 'deny', rect: { x: 738, y: 136, width: 72, height: 32 } },
                { id: 'allow', rect: { x: 810, y: 136, width: 72, height: 32 } },
            ]) &&
            same(popover.rows[2].close, { x: 858, y: 222, width: 24, height: 24 }) &&
            popover.most === 0,
        popover
    );
    const narrow = { width: 300, height: 600 };
    const edge = STATUS.popoverOf(narrow, strip, STATUS.barOf(narrow, strip, [asked]), asked, 0);
    check('a popover wider than the room left of its item stays 8 inside the stage', edge.rect.x === 8, edge.rect);
    const empty = STATUS.popoverOf(stage, strip, bar, seats, 0);
    check('a popover with no row is one row high', empty.rect.height === 44 && empty.header === null, empty);
    check('an item that opens nothing has no popover', STATUS.popoverOf(stage, strip, bar, clock, 0) === null, null);

    const [long] = held({ id: 'seats', icon: 'users', rows: Array.from({ length: 20 }, (_, at) => row(`r${at}`)) });
    const longBar = STATUS.barOf(stage, strip, [long]);
    const tall = STATUS.popoverOf(stage, strip, longBar, long, 9999);
    check(
        'a popover higher than the desktop is as high as it less the margins, and scrolls by the rest at most',
        tall.rect.height === 532 && tall.most === 348 && tall.scroll === 348 && tall.rows[19].rect.y === 548,
        { rect: tall.rect, most: tall.most, scroll: tall.scroll }
    );
    const down = STATUS.scrolled({ item: 'seats', scroll: 0 }, STATUS.popoverOf(stage, strip, longBar, long, 0), 100);
    const up = STATUS.scrolled(down, STATUS.popoverOf(stage, strip, longBar, long, down.scroll), -500);
    check('a scroll moves it and stops at its ends', down.scroll === 100 && up.scroll === 0, { down, up });

    const at = (x, y) => STATUS.partAt(askedBar, popover, { x, y });
    const parts = [at(900, 20), at(870, 20), at(820, 70), at(600, 70), at(600, 100), at(820, 150), at(600, 150)];
    check(
        'a point is on an item, an action of the item, the popover, a row or an action of a row',
        same(
            parts.map(({ part, item, row: on, action }) => [part, item, on, action].join()),
            [
                'item,clock,,',
                'item,seats,,',
                'action,seats,,clear',
                'popover,seats,,',
                'row,seats,a1,',
                'action,seats,a1,allow',
                'row,seats,a1,',
            ]
        ),
        parts
    );
    check(
        'a point on a close button is on it, and one off the bar and the popover is on no part',
        at(870, 230).part === 'close' && at(870, 230).row === 's3' && at(400, 100) === null && at(990, 5) === null,
        [at(870, 230), at(400, 100), at(990, 5)]
    );
    const scrolledOut = STATUS.partAt(longBar, tall, { x: 800, y: 594 });
    check('a row scrolled out of the body takes no point', scrolledOut === null, scrolledOut);

    const items = [clock, asked];
    const opened = STATUS.pressed(null, at(870, 20), items);
    const closed = STATUS.pressed(opened.open, at(870, 20), items);
    check(
        'a press on an item opens its popover and tells its provider, and a press again closes it',
        same(opened, { open: { item: 'seats', scroll: 0 }, tell: { item: 'seats', row: null, action: null } }) &&
            closed.open === null,
        { opened, closed }
    );
    const onClock = STATUS.pressed(opened.open, at(900, 20), items);
    check(
        'a press on an item that opens nothing is told, and closes the one open',
        same(onClock, { open: null, tell: { item: 'clock', row: null, action: null } }),
        onClock
    );
    const tells = [at(600, 100), at(600, 180), at(870, 230), at(820, 150), at(820, 70), at(600, 70)].map(
        (part) => STATUS.pressed(opened.open, part, items).tell
    );
    check(
        'a press tells a row that presses, a close button and an action, and leaves the popover open',
        same(tells, [
            null,
            { item: 'seats', row: 's2', action: null },
            { item: 'seats', row: 's3', action: 'close' },
            { item: 'seats', row: 'a1', action: 'allow' },
            { item: 'seats', row: null, action: 'clear' },
            null,
        ]) && same(STATUS.pressed(opened.open, at(600, 180), items).open, opened.open),
        tells
    );
    check(
        'a press down on no part of the bar closes the popover, and one on a part leaves it',
        STATUS.downOutside(opened.open, null) === null && STATUS.downOutside(opened.open, at(600, 70)) === opened.open,
        null
    );
    const settled = [
        STATUS.settled(opened.open, [clock], stage, strip),
        STATUS.settled({ item: 'clock', scroll: 0 }, items, stage, strip),
        STATUS.settled({ item: 'seats', scroll: 900 }, [long], stage, strip),
        STATUS.settled(opened.open, items, stage, strip),
    ];
    check(
        'a popover closes as its item goes, and its scroll is held in what is left to scroll',
        same(settled, [null, null, { item: 'seats', scroll: 348 }, opened.open]),
        settled
    );

    const far = STATUS.popoverOf(stage, strip, longBar, long, 0);
    const places = ['bar.seats', 'bar.seats.r0', 'bar.seats.r19', 'bar.seats.none', 'bar.clock', 'dock.seats'].map(
        (ref) => STATUS.placeOf(longBar, far, ref)
    );
    check(
        'a ref is where its item or its row is, a row out of view once the popover is scrolled to it',
        same(places, [
            { rect: longBar.items[0].rect, scroll: null },
            { rect: { x: 670, y: 60, width: 320, height: 44 }, scroll: 0 },
            { rect: { x: 670, y: 548, width: 320, height: 44 }, scroll: 348 },
            null,
            null,
            null,
        ]),
        places
    );
    const named = [
        'bar.seats.clear',
        'bar.seats.a1.allow',
        'bar.seats.s3.close',
        'bar.seats.s3',
        'bar.seats.a1.no',
    ].map((ref) => STATUS.placeOf(askedBar, popover, ref)?.rect ?? null);
    check(
        'a ref names an action of the item, an action of a row, a close button, and a row beside its close button',
        same(named, [
            popover.header.actions[0].rect,
            popover.rows[0].actions[1].rect,
            popover.rows[2].close,
            { x: 570, y: 212, width: 280, height: 44 },
            null,
        ]),
        named
    );

    const shown = STATUS.shownOf(askedBar, popover, items);
    check(
        "the desktop's page is told each item as it is written and the open popover's rows with their text",
        shown.items.map(({ id, open }) => id + open).join() === 'clockfalse,seatstrue' &&
            shown.items[0].label === 'Sun 3:04 PM' &&
            shown.popover.rows.length === 3 &&
            same(shown.popover.rows[0].actions[1], {
                id: 'allow',
                rect: popover.rows[0].actions[1].rect,
                title: 'Allow',
                prominent: true,
            }) &&
            shown.popover.header.actions[0].title === 'Clear All' &&
            STATUS.shownOf(longBar, tall, [long]).popover.rows.length === 13 &&
            same(STATUS.inputOf(askedBar, popover), [...askedBar.items.map(({ rect }) => rect), popover.rect]),
        shown
    );

    // The bar over two providers, one that gives each seat its own item.
    const told = [];
    let changes = 0;
    const status = createStatus();
    status.onChange(() => changes++);
    const first = status.provide({
        item: () => ({ id: 'clock', label: 'now', fixed: true }),
        press: (seat, press) => told.push(['clock', seat, press]),
    });
    let sitting = ['s2'];
    const second = status.provide({
        item: (seat) =>
            sitting.length
                ? { id: 'seats', icon: 'users', rows: sitting.map((id) => ({ id, presses: seat === 'local' })) }
                : null,
        press: (seat, press) => told.push(['seats', seat, press]),
    });
    const local = status.laid('local', null, stage, strip);
    check(
        'each seat is laid the items its providers give it, in the order they began',
        local.items.map(({ id }) => id).join() === 'clock,seats' && local.popover === null && local.open === null,
        local
    );
    const seatsAt = local.bar.items[1].rect;
    const onSeats = STATUS.partAt(local.bar, null, { x: seatsAt.x + 4, y: seatsAt.y + 4 });
    const { open, tell } = status.press('local', null, onSeats);
    tell();
    const laidOpen = status.laid('local', open, stage, strip);
    const onRow = STATUS.partAt(laidOpen.bar, laidOpen.popover, { x: laidOpen.popover.rect.x + 4, y: 70 });
    status.press('local', open, onRow).tell();
    status.press('s2', open, onRow).tell();
    check(
        'a press is told to the provider of its item with the seat, a row that does not press for the seat to none',
        same(told, [
            ['seats', 'local', { row: null, action: null }],
            ['seats', 'local', { row: 's2', action: null }],
        ]) && same(open, { item: 'seats', scroll: 0 }),
        told
    );
    sitting = [];
    second.changed();
    const gone = status.laid('local', open, stage, strip);
    check(
        'a provider that says it changed is heard, and the popover of an item that went is closed',
        changes === 3 && gone.open === null && gone.items.length === 1,
        { changes, gone }
    );
    const before = status.laid('local', null, stage, strip).bar.items[0].rect.width;
    status.measured({ label: 'now', width: 50.2 });
    status.measured({ label: 'now', width: 50.2 });
    const after = status.laid('local', null, stage, strip).bar.items[0].rect.width;
    check(
        'a label is laid as wide as the page measured it, told once',
        before === 37 && after === 67 && changes === 4,
        { before, after, changes }
    );
    first.end();
    check(
        'a provider that ended gives no item',
        status.laid('local', null, stage, strip).bar.capsule === null && changes === 5,
        changes
    );

    if (failed.length) {
        for (const line of failed) console.error(line);
        console.error(`${failed.length} of ${count} checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} checks of the status bar`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
