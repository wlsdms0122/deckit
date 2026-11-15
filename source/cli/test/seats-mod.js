// The Seats mod (mods/seats). Its model (src/seats/model/seats.js): the item from who sits and who asks, the seat that
// came, the rows of the view, and its size. Then the mod itself over stand-ins for the handles, the kit and the
// document: its item comes with a second seat and goes with it, is labelled with a seat that sat for a while, asks
// for attention while a user asks, its command opens its view under its item and toggles it, an ask's row answers by
// its two buttons, and a seat's row follows its seat. Exits 1 with a line for each check that failed.
const path = require('path');

const MODS = path.join(__dirname, '..', '..', 'deckit', 'mods');
const MODEL = require(path.join(MODS, 'seats', 'src', 'seats', 'model', 'seats.js'));
const Seats = require(path.join(MODS, 'seats', 'src', 'main.js'));

const failures = [];
let count = 0;
function check(name, passed, detail) {
    count += 1;
    if (!passed) failures.push(`FAIL ${name}: ${JSON.stringify(detail)}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seat = (id, name, more = {}) => ({ id, name, colour: 'blue', idle: false, following: false, ...more });

function modelChecks() {
    const { itemOf, cameOf, rowsOf, sizeOf, VIEW } = MODEL;
    const one = { seats: [seat('1', 'Host')], asks: [] };
    const two = { seats: [seat('1', 'Host'), seat('2', 'Ada')], asks: [] };
    const asked = { seats: [seat('1', 'Host')], asks: [{ id: '3', name: 'Lin' }] };
    check(
        'the item is there while a seat sits beside the first or an ask waits, and not for one seat alone',
        itemOf(one) === null &&
            same(itemOf(two), { name: 'Seats', icon: 'users', command: 'show', label: '', count: 1, tone: 'plain' }) &&
            same(itemOf(asked), {
                name: 'Seats',
                icon: 'users',
                command: 'show',
                label: '',
                count: null,
                tone: 'attention',
            }),
        [itemOf(one), itemOf(two), itemOf(asked)]
    );
    const long = { seats: [seat('1', 'Host'), seat('2', 'A'.repeat(30))], asks: [{ id: '3', name: 'Lin' }] };
    check(
        'its count is the seats beside the first, its label the seat greeted while it sits, cut to what a label holds',
        itemOf(two, '2').label === 'Ada' &&
            itemOf(two, '9').label === '' &&
            itemOf(long, '2').label === 'A'.repeat(23) + '…' &&
            itemOf(long, '2').label.length === MODEL.LETTERS &&
            itemOf({ seats: [...two.seats, seat('4', 'Grace')], asks: [] }).count === 2 &&
            itemOf(long).tone === 'attention',
        [itemOf(two, '2'), itemOf(long, '2')]
    );
    check(
        'the seat that came is the last of those that were not there, and none where no seat is new',
        cameOf(one, two) === '2' &&
            cameOf(two, one) === null &&
            cameOf(two, two) === null &&
            cameOf(one, { seats: [...two.seats, seat('4', 'Grace')], asks: [] }) === '4',
        [cameOf(one, two), cameOf(two, one)]
    );
    const rows = rowsOf({
        seats: [
            seat('1', 'Host'),
            seat('2', 'Ada', { idle: true, colour: 'green' }),
            seat('4', 'Grace', { following: true }),
        ],
        asks: [{ id: '3', name: 'Lin' }],
    });
    check(
        'the rows are the asks, then every seat, each called by its name and what is so of it',
        same(
            rows.map(({ key, kind, says, label }) => [key, kind, says, label]),
            [
                ['ask 3', 'ask', 'asks to sit', 'Lin asks to sit'],
                ['seat 1', 'seat', '', 'Host'],
                ['seat 2', 'seat', 'idle', 'Ada, idle'],
                ['seat 4', 'seat', 'following', 'Grace, following'],
            ]
        ) &&
            rows[2].colour === 'green' &&
            rows[2].idle === true &&
            rows[3].following === true &&
            rows[0].id === '3',
        rows
    );
    check(
        'the view is as high as its rows, an ask higher than a seat, with the room between and the padding round them',
        same(sizeOf(rows), {
            width: VIEW.width,
            height: 2 * VIEW.padding + VIEW.ask + 3 * VIEW.seat + 3 * VIEW.gap,
        }) && same(sizeOf([]), { width: VIEW.width, height: 2 * VIEW.padding }),
        sizeOf(rows)
    );
}

// An element as the view uses one.
function element(tag, { className = '', text = null } = {}) {
    const listeners = {};
    return {
        tag,
        className,
        textContent: text ?? '',
        dataset: {},
        attributes: {},
        properties: {},
        children: [],
        classList: {
            add(name) {
                this.owner.className = `${this.owner.className} ${name}`.trim();
            },
        },
        style: {
            setProperty(name, value) {
                this.owner.properties[name] = value;
            },
        },
        setAttribute(name, value) {
            this.attributes[name] = String(value);
        },
        toggleAttribute(name, on) {
            if (on) this.attributes[name] = '';
            else delete this.attributes[name];
        },
        append(...children) {
            this.children.push(...children);
        },
        replaceChildren(...children) {
            this.children = children;
        },
        addEventListener(type, listener) {
            (listeners[type] ??= []).push(listener);
        },
        fire(type, event = {}) {
            for (const listener of listeners[type] ?? []) listener(event);
        },
    };
}
function made(tag, options) {
    const one = element(tag, options);
    one.classList.owner = one;
    one.style.owner = one;
    return one;
}

// The handles: the seats as the test sets them, each call the mod made of them, the bar's exports, and the windows.
function world() {
    const state = { seats: [seat('1', 'Host')], asks: [] };
    const calls = { answer: [], follow: [], set: [], removed: 0, opened: [], toggled: 0, resized: [] };
    const heard = { change: null, connect: null, exports: null, styles: '' };
    const ui = {
        element: made,
        addStyle: (rules) => (heard.styles += rules),
        row: () => ({ element: made('div', { className: 'deckit-row' }) }),
        button: ({ label, variant, onClick }) => {
            const button = made('button', { text: label });
            button.variant = variant;
            button.addEventListener('click', onClick);
            return { element: button };
        },
        list: ({ key, create, update }) => {
            const list = made('div');
            const kept = new Map();
            return {
                element: list,
                set: (items) => {
                    for (const item of items) {
                        if (kept.has(key(item))) update(kept.get(key(item)), item);
                        else kept.set(key(item), create(item));
                    }
                    list.children = items.map((item) => kept.get(key(item)));
                    for (const id of [...kept.keys()]) if (!items.some((item) => key(item) === id)) kept.delete(id);
                },
            };
        },
    };
    const shell = {
        ui,
        seats: {
            list: async () => state.seats.map((each) => ({ ...each })),
            asks: async () => state.asks.map((each) => ({ ...each })),
            onChange: (listener) => {
                heard.change = listener;
                return () => (heard.change = null);
            },
            answer: async (ask, allow) => calls.answer.push([ask, allow]) > 0,
            follow: async (id) => calls.follow.push(id) > 0,
        },
        windows: {
            open: (options) => {
                calls.opened.push(options);
                return {
                    toggle: () => (calls.toggled += 1),
                    resize: (width, height) => calls.resized.push({ width, height }),
                };
            },
        },
    };
    const deckit = {
        exports: { register: (given) => (heard.exports = given) },
        dependencies: { onConnect: (named, listener) => (heard.connect = { named, listener }) },
    };
    const bar = {
        set: async (item) => void calls.set.push(item),
        remove: async () => void (calls.removed += 1),
    };
    return { state, calls, heard, shell, deckit, bar };
}

async function modChecks() {
    // The item's greeting ends by a timer the test runs itself.
    const timers = [];
    const real = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
    globalThis.setTimeout = (run, after) => timers.push({ run, after }) && timers.length;
    globalThis.clearTimeout = (id) => id && (timers[id - 1] = null);
    const settled = () => new Promise((resolve) => setImmediate(resolve));
    const { state, calls, heard, shell, deckit, bar } = world();
    const mod = new Seats();
    mod.start(deckit);
    heard.connect.listener(bar);
    mod.attach(shell, deckit);
    await settled();
    check(
        'the mod asks the status bar for its items and, alone at the desktop, gives it none',
        heard.connect.named === 'status-bar/items' && calls.set.length === 0 && calls.removed === 0,
        [heard.connect.named, calls]
    );
    const change = async (next) => {
        Object.assign(state, next);
        heard.change();
        await settled();
    };
    await change({ seats: [seat('1', 'Host'), seat('2', 'Ada', { colour: 'green' })] });
    const greeting = calls.set.at(-1);
    const waits = timers.filter(Boolean).map(({ after }) => after);
    timers.find(Boolean).run();
    check(
        'a seat that sits brings the item, labelled with its name for a few seconds, then with its count alone',
        same(greeting, { name: 'Seats', icon: 'users', command: 'show', label: 'Ada', count: 1, tone: 'plain' }) &&
            same(waits, [MODEL.GREETS]) &&
            calls.set.at(-1).label === '' &&
            calls.set.at(-1).count === 1,
        [greeting, waits, calls.set.at(-1)]
    );
    await change({ asks: [{ id: '3', name: 'Lin' }] });
    check(
        'the item asks for attention while a user asks to sit',
        calls.set.at(-1).tone === 'attention' && calls.set.at(-1).label === '',
        calls.set.at(-1)
    );
    const run = heard.exports.connect().runCommand;
    await run('show');
    const opened = calls.opened[0];
    await run('show');
    const refused = await run('other').then(
        () => null,
        (error) => error.message
    );
    check(
        'its command opens its view under its item in the status bar, as large as its rows, then toggles it',
        calls.opened.length === 1 &&
            opened.level === 'panel' &&
            same(opened.anchor, { mod: 'status-bar', id: 'seats' }) &&
            opened.width === MODEL.VIEW.width &&
            opened.height === MODEL.sizeOf(MODEL.rowsOf(state)).height &&
            calls.toggled === 1 &&
            refused === 'Seats has no command other',
        [opened, calls.toggled, refused]
    );
    const rowsNow = () => opened.content.children[0].children;
    const [ask, host, ada] = rowsNow();
    const [, , deny, allow] = ask.children;
    check(
        'the view is a group of rows: an ask first, named, with Deny and Allow, then each seat a button in its colour',
        opened.content.attributes.role === 'group' &&
            opened.content.attributes['aria-label'] === 'Seats' &&
            ask.attributes.role === 'group' &&
            ask.attributes['aria-label'] === 'Lin asks to sit' &&
            [deny.textContent, allow.textContent].join() === 'Deny,Allow' &&
            [deny.attributes['aria-label'], allow.attributes['aria-label']].join() === 'Deny Lin,Allow Lin' &&
            allow.variant === 'primary' &&
            host.attributes.role === 'button' &&
            host.attributes['aria-label'] === 'Host' &&
            ada.attributes['aria-label'] === 'Ada' &&
            ada.properties['--seats-colour'] === 'var(--deckit-seat-green)' &&
            ada.children[1].textContent === 'Ada',
        rowsNow().map(({ attributes }) => attributes)
    );
    allow.fire('click');
    deny.fire('click');
    check(
        'a press on Allow or Deny answers the ask, for whoever pressed',
        same(calls.answer, [
            ['3', true],
            ['3', false],
        ]),
        calls.answer
    );
    ada.fire('click');
    await change({
        asks: [],
        seats: [seat('1', 'Host'), seat('2', 'Ada', { colour: 'green', following: true, idle: true })],
    });
    const followed = rowsNow()[1];
    followed.fire('click');
    let kept = false;
    followed.fire('keydown', { key: 'Enter', preventDefault: () => (kept = true) });
    check(
        "a press on a seat's row follows it, and on a followed one ends that; the row says idle and following",
        same(calls.follow, ['2', null, null]) &&
            kept &&
            followed === ada &&
            followed.attributes['aria-label'] === 'Ada, idle, following' &&
            followed.attributes['aria-pressed'] === 'true' &&
            'data-idle' in followed.attributes &&
            followed.children[2].textContent === 'idle, following' &&
            rowsNow().length === 2 &&
            same(calls.resized.at(-1), MODEL.sizeOf(MODEL.rowsOf(state))),
        [calls.follow, followed.attributes, calls.resized.at(-1)]
    );
    await change({ seats: [seat('1', 'Host')] });
    const gone = calls.removed;
    await change({ seats: [seat('1', 'Host'), seat('5', 'Grace')] });
    mod.detach();
    const offScreen = await run('show').then(
        () => null,
        (error) => error.message
    );
    check(
        'the item goes as the last seat beside the first leaves, comes again with the next, and goes with the screen',
        gone === 1 &&
            calls.set.at(-1).label === 'Grace' &&
            calls.removed === 2 &&
            heard.change === null &&
            offScreen === 'no screen shows the seats now',
        [gone, calls.set.at(-1), calls.removed, offScreen]
    );
    Object.assign(globalThis, real);
}

async function main() {
    modelChecks();
    await modChecks();
    for (const failure of failures) console.error(failure);
    if (failures.length) process.exit(1);
    console.log(`ok: ${count} checks of the seats mod`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
