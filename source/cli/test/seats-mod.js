// The Seats mod (mods/seats). Its model (src/seats/model/seats.js): the item from who sits, the seat that came, the
// rows of the view, and its size. Then the mod itself over stand-ins for the handles, the kit and the document: its
// item comes with a second seat and goes with it, is labelled with a seat that sat for a while, its command opens its
// view under its item and toggles it, and a seat's row follows its seat. Exits 1 with a line for each check that failed.
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
    const one = { seats: [seat('1', 'Host')] };
    const two = { seats: [seat('1', 'Host'), seat('2', 'Ada')] };
    check(
        'the item is there while a seat sits beside the first, in the plain tone, and not for one seat alone',
        itemOf(one) === null &&
            same(itemOf(two), { name: 'Seats', icon: 'users', command: 'show', label: '', count: 1, tone: 'plain' }),
        [itemOf(one), itemOf(two)]
    );
    const long = { seats: [seat('1', 'Host'), seat('2', 'A'.repeat(30))] };
    check(
        'its count is the seats beside the first, its label the seat greeted while it sits, cut to what a label holds',
        itemOf(two, '2').label === 'Ada' &&
            itemOf(two, '9').label === '' &&
            itemOf(long, '2').label === 'A'.repeat(23) + '…' &&
            itemOf(long, '2').label.length === MODEL.LETTERS &&
            itemOf({ seats: [...two.seats, seat('4', 'Grace')] }).count === 2,
        [itemOf(two, '2'), itemOf(long, '2')]
    );
    check(
        'the seat that came is the last of those that were not there, and none where no seat is new',
        cameOf(one, two) === '2' &&
            cameOf(two, one) === null &&
            cameOf(two, two) === null &&
            cameOf(one, { seats: [...two.seats, seat('4', 'Grace')] }) === '4',
        [cameOf(one, two), cameOf(two, one)]
    );
    const rows = rowsOf({
        seats: [
            seat('1', 'Host'),
            seat('2', 'Ada', { idle: true, colour: 'green' }),
            seat('4', 'Grace', { following: true }),
        ],
    });
    check(
        'the rows are every seat, each called by its name and what is so of it',
        same(
            rows.map(({ key, says, label }) => [key, says, label]),
            [
                ['seat 1', '', 'Host'],
                ['seat 2', 'idle', 'Ada, idle'],
                ['seat 4', 'following', 'Grace, following'],
            ]
        ) &&
            rows[1].colour === 'green' &&
            rows[1].idle === true &&
            rows[2].following === true &&
            rows[0].id === '1',
        rows
    );
    check(
        'the view is as high as its rows, with the room between and the padding round them',
        same(sizeOf(rows), { width: VIEW.width, height: 2 * VIEW.padding + 3 * VIEW.row + 2 * VIEW.gap }) &&
            same(sizeOf([]), { width: VIEW.width, height: 2 * VIEW.padding }),
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
    const state = { seats: [seat('1', 'Host')] };
    const calls = { follow: [], set: [], removed: 0, opened: [], toggled: 0, resized: [] };
    const heard = { change: null, connect: null, exports: null, styles: '' };
    const ui = {
        element: made,
        addStyle: (rules) => (heard.styles += rules),
        row: () => ({ element: made('div', { className: 'deckit-row' }) }),
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
            onChange: (listener) => {
                heard.change = listener;
                return () => (heard.change = null);
            },
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
    const [host, ada] = rowsNow();
    check(
        'the view is a group of rows, each seat a button in its colour, and nothing else',
        opened.content.attributes.role === 'group' &&
            opened.content.attributes['aria-label'] === 'Seats' &&
            rowsNow().length === 2 &&
            host.attributes.role === 'button' &&
            host.attributes['aria-label'] === 'Host' &&
            ada.attributes['aria-label'] === 'Ada' &&
            ada.properties['--seats-colour'] === 'var(--deckit-seat-green)' &&
            ada.children[1].textContent === 'Ada',
        rowsNow().map(({ attributes }) => attributes)
    );
    await change({ seats: [seat('1', 'Host'), seat('2', 'Ada', { colour: 'green', idle: true })] });
    const stood = [rowsNow()[0] === host, rowsNow()[1] === ada];
    check(
        "as a seat's state changes the rows keep their elements, and the seat's row says the state",
        same(stood, [true, true]) && ada.children[2].textContent === 'idle',
        [stood, ada.children[2]?.textContent]
    );
    ada.fire('click');
    await change({ seats: [seat('1', 'Host'), seat('2', 'Ada', { colour: 'green', following: true, idle: true })] });
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
