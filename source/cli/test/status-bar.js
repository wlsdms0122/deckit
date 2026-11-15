// The Status Bar's model (mods/status-bar/src/bar/model/bar.js): the item a mod declares and the one it sets, each of
// another shape refused, the order the items began to be there in, what an item and the bar are called, widths, the
// capsule and its items from the right, an item going, one that shows nothing, the capsule's limit and what does not
// fit told as a count. Exits 1 with a line for each check that failed.
const path = require('path');

const BAR = require(path.join(__dirname, '..', '..', 'deckit', 'mods', 'status-bar', 'src', 'bar', 'model', 'bar.js'));

function main() {
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
        BAR.nameOf('Status Bar', 0),
        BAR.nameOf('Status Bar', 2),
    ];
    check(
        'an item is called by its name, its count and its attention, the bar by its name and what it does not show',
        same(called, ['Clock', 'Seats, 2', 'Seats, 99+, attention', 'Status Bar', 'Status Bar, 2 more']),
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
    const bar = BAR.barOf([clock, bell, seats], measured);
    check(
        'the items stand from the right in the order given, 4 apart, 2 inside a capsule 28 high',
        same(bar, {
            width: 183,
            height: 28,
            items: [
                { id: 'clock', rect: { x: 85, y: 2, width: 96, height: 24 } },
                { id: 'bell', rect: { x: 49, y: 2, width: 32, height: 24 } },
                { id: 'seats', rect: { x: 2, y: 2, width: 43, height: 24 } },
            ],
            hidden: 0,
        }),
        bar
    );
    const without = BAR.barOf([clock, seats], measured);
    check(
        'as an item goes the capsule narrows by it and those left of it keep their place from its left end',
        without.width === 147 && same(without.items[1], { id: 'seats', rect: { x: 2, y: 2, width: 43, height: 24 } }),
        without
    );
    const none = BAR.barOf([]);
    check('with no item there is no capsule', none.width === 0 && none.items.length === 0 && none.hidden === 0, none);
    const blank = BAR.barOf([{ id: 'blank', ...BAR.restOf(BAR.declaredOf({ name: 'Blank' })) }, bell]);
    check(
        'an item that shows nothing is neither laid nor counted',
        blank.width === 36 && blank.items.length === 1 && blank.items[0].id === 'bell' && blank.hidden === 0,
        blank
    );

    check(
        'the capsule is at most half the room a band has, and has no limit where none is told',
        BAR.limitOf({ width: 901, height: 52 }) === 450 && BAR.limitOf(null) === Infinity,
        BAR.limitOf({ width: 901, height: 52 })
    );
    const held = BAR.barOf([clock, bell, seats], measured, 182);
    check(
        'an item that does not fit is not laid, and is counted',
        held.width === 136 && held.items.map(({ id }) => id).join() === 'clock,bell' && held.hidden === 1,
        held
    );
    const wide = item('wide', { icon: 'bell', label: 'x'.repeat(20) });
    const stopped = BAR.barOf([clock, wide, bell, seats], measured, 183);
    check(
        'from the first item that does not fit on none is laid, though a later one would fit',
        stopped.items.map(({ id }) => id).join() === 'clock' && stopped.hidden === 3 && stopped.width === 100,
        stopped
    );
    const tight = BAR.barOf([clock, bell], measured, 99);
    check('where not even the first fits there is no capsule', tight.width === 0 && tight.hidden === 2, tight);

    if (failed.length) {
        for (const line of failed) console.error(line);
        console.error(`${failed.length} of ${count} checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} checks of the status bar's model`);
}

main();
