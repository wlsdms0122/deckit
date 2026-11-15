// The Notifications mod's center (mods/notifications/src/center/center.js) over a stand-in for deckit: what a sender
// posts through its connection is kept and listed to its sender alone, removed only by its sender, refused for what it
// does not take, let through at the rate and
// shown as a toast while a drawer is there, queued behind the toasts on screen, and as the system's besides while the
// app is not in front, and a press runs the sender's command through deckit/commands. Then a sender, Calendar's notices, with an owner to post to and with none;
// the mod's item in the status bar (src/item), what it declares held to what the bar takes, its count and its
// attention as one arrives; the sizes of its two views (src/screen/model/screen.js); and the screen itself
// (src/screen/screen.js) over stand-ins for the document, the kit and the shell's windows: the toasts in one view at
// the top right that takes no keyboard, open while it holds any, and the center in a view under the item.
// Exits 1 with a line for each check that failed.
const path = require('path');
const { pathToFileURL } = require('url');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (count = 5) => {
    for (let index = 0; index < count; index++) await tick();
};

async function main() {
    const mods = path.join(__dirname, '..', '..', 'deckit', 'mods');
    const { center, RATE, TOASTS } = require(path.join(mods, 'notifications', 'src', 'center', 'center.js'));
    const { valueProblem } = await import(
        pathToFileURL(path.join(__dirname, '..', '..', 'deckit', 'deckit-sdk', 'deckit', 'request', 'index.js')).href
    );
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let time = 1000;
    let active = false;
    const records = new Map();
    const refused = []; // what storage refused to keep, as it refuses what is no value
    const ran = []; // [mod, command, args]
    const system = []; // { title, press }
    const deckit = {
        storage: {
            records: {
                get: (key, fallback) => structuredClone(records.get(key) ?? fallback),
                set: async (key, value) => {
                    const problem = valueProblem(value);
                    if (problem) return refused.push(problem);
                    records.set(key, JSON.parse(JSON.stringify(value)));
                },
            },
        },
        notifications: {
            show: async ({ title }) => {
                const shown = { title, press: null };
                system.push(shown);
                return { shown: true, onPress: (listener) => (shown.press = listener) };
            },
        },
    };
    const commands = { run: async (mod, command, args) => (ran.push([mod, command, args]), null) };
    const sut = center(deckit, { commands: () => commands, now: () => time });
    const json = (value) => JSON.stringify(value);
    const calendar = sut.exportsFor({ mod: { name: 'Calendar' }, credential: { mod: 'calendar', permissions: [] } });
    const browser = sut.exportsFor({ mod: { name: 'Browser' }, credential: { mod: 'browser', permissions: [] } });

    // With no drawer and the app not in front, the system shows it.
    const first = await calendar.post({
        title: 'Standup',
        body: 'in 5 min',
        command: 'show-date',
        args: { date: '2026-11-06' },
    });
    await ticks();
    const listed = await calendar.list();
    check(
        'a post is listed to its sender, without its sender and its command',
        listed.length === 1 && listed[0].id === first && !('mod' in listed[0]) && !('command' in listed[0]),
        listed
    );
    check('a post is not listed to another sender', (await browser.list()).length === 0, await browser.list());
    check('the owner lists it with its sender', sut.list()[0]?.mod.name === 'Calendar', sut.list());
    check('a post is kept', records.get('notifications')?.[0]?.id === first, records.get('notifications'));
    check('while the app is not in front a post is shown as the system’s', system[0]?.title === 'Standup', system);

    system[0].press();
    await ticks();
    check(
        'a press on the system’s runs the sender’s command with its args',
        json(ran) === json([['calendar', 'show-date', { date: '2026-11-06' }]]),
        ran
    );
    check('a pressed notification is taken away', (await calendar.list()).length === 0, await calendar.list());

    // Removing is the sender's own.
    const second = await calendar.post({
        title: 'Review',
        command: 'review',
        actions: [{ title: 'Snooze', command: 'snooze', args: { minutes: 5 } }],
    });
    await ticks();
    check('another sender does not remove it', (await browser.remove(second)) === false, null);
    check('its sender removes it', (await calendar.remove(second)) === true, null);
    check('a removal runs nothing', ran.length === 1, ran);
    const kindOf = (promise) =>
        promise.then(
            () => null,
            (error) => error.kind ?? null
        );
    for (const [what, notification] of [
        ['no notification', undefined],
        ['a notification of another type', 'x'],
        ['neither title nor body', {}],
        ['a title of another type', { title: 5 }],
        ['silent of another type', { title: 'x', silent: 'yes' }],
        ['an empty command', { title: 'x', command: '' }],
        ['args of another type', { title: 'x', command: 'show', args: [1] }],
        ['actions of another type', { title: 'x', actions: {} }],
        ['an action that names no command', { title: 'x', actions: [{ title: 'Open' }] }],
        ['an action title of another type', { title: 'x', actions: [{ title: 5, command: 'open' }] }],
    ])
        check(
            `a post with ${what} is refused for its argument`,
            (await kindOf(browser.post(notification))) === 'INVALID_ARGUMENT'
        );
    check('a remove of an id of another type is refused', (await kindOf(browser.remove(1))) === 'INVALID_ARGUMENT');
    check('a post refused keeps nothing', (await browser.list()).length === 0, await browser.list());

    // The rate: a sender's posts beyond it within its window are kept, not shown.
    system.length = 0;
    time += RATE.within;
    for (let index = 0; index < RATE.count + 2; index++) await browser.post({ title: `site ${index}` });
    await ticks(20);
    check('a sender is shown at most the rate allows', system.length === RATE.count, system.length);
    check('what is past the rate is still listed', (await browser.list()).length >= RATE.count + 2, null);
    time += RATE.within;
    await browser.post({ title: 'later' });
    await ticks();
    check('once the window has passed a sender is shown again', system.at(-1)?.title === 'later', system);

    // While a drawer is there and the app is not in front, each is a toast and the system's too: the toasts as many
    // as fit, the system's waiting for no room.
    const drawn = [];
    const hidden = [];
    const drawer = {
        show: (notification) => drawn.push(notification.id),
        hide: (id) => hidden.push(id),
        active: async () => active,
    };
    let off = sut.drawWith(drawer);
    system.length = 0;
    const away = [];
    for (let index = 0; index < TOASTS + 1; index++) {
        time += RATE.within;
        away.push(await browser.post({ title: `away ${index}`, command: 'open' }));
    }
    await ticks(20);
    check(
        'while the app is not in front a post is a toast all the same, as many as fit',
        drawn.join() === away.slice(0, TOASTS).join(),
        drawn
    );
    check(
        'and the system’s besides, each at once in the order posted',
        system.map(({ title }) => title).join() === away.map((_, index) => `away ${index}`).join(),
        system
    );
    system[0].press();
    await ticks();
    check(
        'a press on the system’s takes its toast off the screen and lets the queued one out',
        hidden.join() === away[0] &&
            drawn.at(-1) === away[TOASTS] &&
            json(ran.at(-1)) === json(['browser', 'open', {}]),
        { hidden, drawn, ran: ran.at(-1) }
    );
    time += RATE.within;
    const waiting = await browser.post({ title: 'waits' });
    await ticks();
    off();
    off = sut.drawWith(drawer);
    await ticks();
    check(
        'a drawer’s off lets go of what waited for room: the next drawer draws none of it',
        !drawn.includes(waiting) && (await browser.list()).some(({ id }) => id === waiting),
        drawn
    );
    for (const { id } of await browser.list()) await browser.remove(id);

    // While the app is in front, toasts alone.
    active = true;
    drawn.length = hidden.length = system.length = 0;
    const posts = [];
    for (let index = 0; index < TOASTS + 1; index++) {
        time += RATE.within;
        posts.push(
            await calendar.post({
                title: `t${index}`,
                command: 'show',
                actions: [{ title: 'Snooze', command: 'snooze', args: { minutes: index } }],
            })
        );
    }
    await ticks(20);
    check(
        'while the app is in front posts are toasts, as many as fit',
        drawn.join() === posts.slice(0, TOASTS).join(),
        drawn
    );
    check('and the system shows none of them', system.length === 0, system);
    sut.toastGone(posts[0]);
    await ticks();
    check('a toast gone lets the queued one out', drawn.at(-1) === posts[TOASTS], drawn);
    await sut.press(posts[1]);
    check(
        'a press on a toast runs its command, `{}` for no args',
        json(ran.at(-1)) === json(['calendar', 'show', {}]),
        ran
    );
    check('a pressed toast is taken off the screen', hidden.includes(posts[1]), hidden);
    await sut.press(posts[2], 0);
    check(
        'a press on an action runs its own command',
        json(ran.at(-1)) === json(['calendar', 'snooze', { minutes: 2 }]),
        ran
    );

    // A sender, Calendar's notices: none is posted while no owner is connected, and one is once an owner is, naming
    // the sender's own command with the day; a post the owner's ended connection refuses rejects.
    const { notice } = require(path.join(mods, 'calendar', 'src', 'notice', 'notice.js'));
    let connected = null;
    const sender = notice({
        dependencies: { onConnect: (name, listener) => name === 'deckit/notifications' && (connected = listener) },
    });
    const date = new Date(2026, 10, 6);
    check('with no owner a sender’s notice is not posted', (await sender.post({ title: 'a', date })) === false, null);
    const posted = [];
    const disconnect = connected({ post: async (notification) => (posted.push(notification), 'id') });
    check('with an owner it is posted', (await sender.post({ title: 'b', body: 'in 5 min', date })) === true, posted);
    check(
        'it names the sender’s own command, with the day',
        json(posted[0]) === json({ title: 'b', body: 'in 5 min', command: 'show-date', args: { date: '2026-11-06' } }),
        posted
    );
    disconnect();
    connected({ post: async () => Promise.reject(new Error('the mod on the other end has ended')) });
    check(
        'a post the connection rejects rejects',
        await sender.post({ title: 'c', date }).then(
            () => false,
            () => true
        ),
        null
    );

    check('every record written is a value storage keeps', !refused.length, refused);

    // The item: declared in the manifest, set by the holder as the record changes.
    const fs = require('fs');
    const TOML = require(path.join(__dirname, '..', 'conformance', 'toml.js'));
    const BAR = require(path.join(mods, 'status-bar', 'src', 'bar', 'model', 'bar.js'));
    const ITEM = require(path.join(mods, 'notifications', 'src', 'item', 'model', 'item.js'));
    const { item } = require(path.join(mods, 'notifications', 'src', 'item', 'item.js'));
    const manifest = TOML.read(fs.readFileSync(path.join(mods, 'notifications', 'manifest.toml'), 'utf8'));
    const declared = BAR.declaredOf(manifest.contributes?.['status-bar/items']?.[0]);
    check(
        'the item is declared as the bar takes one: a bell whose press runs toggle',
        json(declared) === json({ name: 'Notifications', icon: 'bell', command: 'toggle' }) &&
            manifest.contributes['deckit/commands'].some(({ id }) => id === declared.command),
        declared
    );
    check('its mod is one whose item a new machine keeps fixed', BAR.FIXED.includes(manifest.id), BAR.FIXED);
    check(
        'the mod asks for no window outside the stage',
        !Object.keys(manifest.permissions).includes('system.overlay-windows') &&
            !('notifications/center' in manifest.interfaces.provides),
        manifest
    );
    check(
        'an empty record sets no count, a record its length, and one that arrived attention',
        json([ITEM.itemOf(0), ITEM.itemOf(3), ITEM.itemOf(3, true)]) ===
            json([
                { count: null, tone: 'plain' },
                { count: 3, tone: 'plain' },
                { count: 3, tone: 'attention' },
            ]),
        [ITEM.itemOf(0), ITEM.itemOf(3), ITEM.itemOf(3, true)]
    );
    check(
        'what it sets is what the bar holds of a declared item',
        [ITEM.itemOf(0), ITEM.itemOf(120, true)].every((set) => BAR.heldTo(set, declared) !== null),
        BAR.heldTo(ITEM.itemOf(0), declared)
    );
    check(
        'one arrived where the newest was not there before, not as one goes',
        ITEM.arrivedOf(['a'], ['b', 'a']) &&
            ITEM.arrivedOf([], ['a']) &&
            !ITEM.arrivedOf(['b', 'a'], ['a']) &&
            !ITEM.arrivedOf(['a'], []) &&
            !ITEM.arrivedOf(['a'], ['a']),
        null
    );
    // The holder over the record `sut`, a stand-in for the bar and a clock of the test's.
    const sets = [];
    const timers = [];
    const real = { setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
    global.setTimeout = (run, wait) => timers.push({ run, wait }) && timers.at(-1);
    global.clearTimeout = (timer) => timers.includes(timer) && timers.splice(timers.indexOf(timer), 1);
    try {
        for (const each of sut.list()) sut.remove(each.id);
        let connect = null;
        const held = item({ dependencies: { onConnect: (name, connected) => (connect = { name, connected }) } }, sut);
        const disconnect = connect.connected({ set: async (given) => sets.push(given) });
        check(
            'as the bar connects the item is set with an empty record: no count',
            connect.name === 'status-bar/items' && json(sets) === json([{ count: null, tone: 'plain' }]),
            sets
        );
        time += RATE.within;
        const rung = await calendar.post({ title: 'rings' });
        check(
            'as one arrives the item counts it and asks for attention, for a while',
            json(sets.at(-1)) === json({ count: 1, tone: 'attention' }) &&
                timers.length === 1 &&
                timers[0].wait === ITEM.RINGS,
            { sets, timers }
        );
        timers.shift().run();
        check('after it the item is plain again', json(sets.at(-1)) === json({ count: 1, tone: 'plain' }), sets);
        await calendar.post({ title: 'again' });
        sut.remove(rung);
        check(
            'one taken away while the item rings leaves it ringing, one fewer',
            json(sets.at(-1)) === json({ count: 1, tone: 'attention' }) && timers.length === 1,
            { sets, timers }
        );
        const before = sets.length;
        disconnect();
        await calendar.post({ title: 'unheard' });
        held.end();
        await calendar.post({ title: 'ended' });
        check(
            'with no bar, and once ended, nothing is set and no timer waits',
            sets.length === before && !timers.length,
            {
                sets,
                timers,
            }
        );
    } finally {
        Object.assign(global, real);
    }

    // The sizes of the two views.
    const SCREEN = require(path.join(mods, 'notifications', 'src', 'screen', 'model', 'screen.js'));
    check(
        'the center is 360 wide, as high as its head and rows, 8 apart, in 16 of room',
        json(SCREEN.centerSize([60, 80])) === json({ width: 360, height: 16 + 32 + 8 + 60 + 8 + 80 + 16 }),
        SCREEN.centerSize([60, 80])
    );
    check(
        'an empty record has room for its words, and a long one is held to the most',
        SCREEN.centerSize([]).height === 16 + 32 + 8 + SCREEN.EMPTY + 16 &&
            SCREEN.centerSize(Array(40).fill(60)).height === SCREEN.MOST,
        [SCREEN.centerSize([]), SCREEN.centerSize(Array(40).fill(60))]
    );
    check(
        'the toasts are 360 wide and as high as the cards, 8 apart, in 8 of room',
        json(SCREEN.toastsSize([60.4])) === json({ width: 360, height: 77 }) &&
            SCREEN.toastsSize([60, 80, 44]).height === 8 + 60 + 8 + 80 + 8 + 44 + 8,
        [SCREEN.toastsSize([60.4]), SCREEN.toastsSize([60, 80, 44])]
    );
    check(
        'a card is guessed higher with a body and with actions',
        SCREEN.guessOf({ title: 'a' }) === SCREEN.CARD.plain &&
            SCREEN.guessOf({ body: 'b', actions: [{ title: 'c' }] }) ===
                SCREEN.CARD.plain + SCREEN.CARD.body + SCREEN.CARD.actions,
        null
    );
    const shows = [
        SCREEN.cardOf({ title: '', mod: { id: 'c', name: 'Calendar' }, actions: [{ title: 'Later', command: 'l' }] }),
        SCREEN.cardOf({ title: 'Standup', body: 'now', mod: { id: 'c', name: 'Calendar' } }, { icon: 'i', time: '9' }),
    ];
    check(
        "a card shows its title, the sender's name for none, its body, icon and time, and its actions' titles",
        json(shows) ===
            json([
                { title: 'Calendar', body: '', sender: 'Calendar', icon: '', time: '', actions: ['Later'] },
                { title: 'Standup', body: 'now', sender: 'Calendar', icon: 'i', time: '9', actions: [] },
            ]),
        shows
    );

    await screenChecks({ check, json, mods });

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} notifications checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} notifications checks`);
}

// An element as the screen uses one: its children, its listeners, and a height the test names for its class.
function element(tag) {
    const made = {
        tag,
        className: '',
        dataset: {},
        children: [],
        listeners: {},
        isConnected: true,
        textContent: '',
        classList: { add: (name) => (made.className += ' ' + name) },
        append: (...nodes) => made.children.push(...nodes),
        replaceChildren: (...nodes) => (made.children = nodes),
        addEventListener: (type, listener) => (made.listeners[type] = listener),
        toggleAttribute: () => {},
        setAttribute: () => {},
        getBoundingClientRect: () => ({
            height: / notifications-card|^notifications-card/.test(made.className) ? 60 : 0,
        }),
        ownerDocument: PAGE,
    };
    return made;
}
const PAGE = {
    listeners: {},
    addEventListener: (type, listener) => (PAGE.listeners[type] = listener),
    defaultView: { requestAnimationFrame: (run) => setImmediate(run) },
};

async function screenChecks({ check, json, mods }) {
    global.document = { createElement: element };
    const { screen } = require(path.join(mods, 'notifications', 'src', 'screen', 'screen.js'));
    const windows = []; // every window opened: its options, and what was asked of it since
    const kit = {
        addStyle: () => {},
        icon: () => element('svg'),
        appIcon: () => element('img'),
        emptyState: () => ({ element: element('div') }),
        button: ({ label, onClick }) => ({
            element: Object.assign(element('button'), { textContent: label, onClick }),
        }),
        iconButton: ({ title, onClick }) => ({ element: Object.assign(element('button'), { title, onClick }) }),
        motion: { come: () => {}, go: () => ({ finished: Promise.resolve() }), glide: (_nodes, then) => then() },
        list: ({ key, create, update }) => {
            const rows = new Map();
            const list = element('div');
            const set = (items) => {
                for (const each of items) {
                    if (rows.has(key(each))) update(rows.get(key(each)), each);
                    else rows.set(key(each), create(each));
                }
                list.children = items.map((each) => rows.get(key(each)));
            };
            return { element: list, set, elementOf: (id) => rows.get(id) };
        },
        listbox: () => {
            let at = 0;
            let size = 0;
            return {
                active: () => at,
                move: (by) => (at = Math.max(0, Math.min(size - 1, at + by))),
                set: (items, { active }) => ([size, at] = [items.length, Math.max(0, active)]),
            };
        },
    };
    const shell = {
        ui: kit,
        active: async () => true,
        mods: { icon: async () => '' },
        windows: {
            open: (options) => {
                const asked = [];
                const handle = Object.fromEntries(
                    ['resize', 'close', 'toggle', 'makeKeyAndOrderFront'].map((name) => [
                        name,
                        (...args) => asked.push([name, ...args]),
                    ])
                );
                windows.push({ options, asked });
                return handle;
            },
        },
    };
    let drawer = null;
    const record = [];
    const calls = [];
    const listeners = new Set();
    const told = () => listeners.forEach((listener) => listener());
    const center = {
        list: () => record,
        drawWith: (given) => ((drawer = given), () => (drawer = null)),
        onChange: (listener) => (listeners.add(listener), () => listeners.delete(listener)),
        press: (...args) => calls.push(['press', ...args]),
        remove: (...args) => calls.push(['remove', ...args]),
        clear: () => calls.push(['clear']),
        toastGone: (id) => calls.push(['toastGone', id]),
    };
    const note = (id, more = {}) => ({
        id,
        mod: { id: 'calendar', name: 'Calendar' },
        title: id,
        body: '',
        actions: [],
        ...more,
    });
    const actions = [{ title: 'Snooze' }];
    const sut = screen(shell, center);
    const settle = () => new Promise((resolve) => setTimeout(resolve, 5));

    // Toasts.
    await drawer.show(note('a', { actions }));
    await settle();
    const [toasts] = windows;
    const { content, didClose, ...opened } = toasts.options;
    check(
        'the first toast opens one view at the top right that takes no keyboard, as high as it is guessed',
        windows.length === 1 &&
            json(opened) ===
                json({ name: 'toasts', level: 'panel', place: 'top-right', width: 360, height: 92, activates: false }),
        opened
    );
    check(
        'laid out, the view is sized to the toast it holds',
        json(toasts.asked) === json([['resize', 360, 76]]),
        toasts
    );
    await drawer.show(note('b', { actions }));
    await settle();
    check(
        'a second toast stands in the same view, sized to both',
        windows.length === 1 &&
            content.children.length === 2 &&
            json(toasts.asked.at(-1)) === json(['resize', 360, 144]),
        { windows: windows.length, asked: toasts.asked }
    );
    const [card, words] = [content.children[0], content.children[0].children[1]];
    card.listeners.click();
    words.children.at(-1).children[0].onClick();
    check(
        "a press on a toast and on its action are the record's",
        json(calls) ===
            json([
                ['press', 'a'],
                ['press', 'a', 0],
            ]),
        calls
    );
    drawer.hide('a');
    await settle();
    const one = { cards: content.children.length, closed: toasts.asked.some(([name]) => name === 'close') };
    content.children[0].children.at(-1).onClick();
    await settle();
    check(
        'the view stays while it holds a toast and closes as the last goes, which the record is told of one it closed',
        one.cards === 1 &&
            !one.closed &&
            json(toasts.asked.at(-1)) === json(['close']) &&
            json(calls.at(-1)) === json(['toastGone', 'b']),
        { one, asked: toasts.asked, calls }
    );
    didClose();
    await drawer.show(note('c'));
    await settle();
    check(
        'the next toast opens the view again',
        windows.length === 2 && windows[1].options.place === 'top-right',
        null
    );

    // The center.
    record.push(note('x', { posted: 0 }), note('y', { posted: 0, body: 'words' }));
    await sut.toggle();
    await settle();
    const view = windows[2];
    const { content: list, didAppear, ...under } = view?.options ?? {};
    check(
        "toggle first opens the center under the mod's item, with the keyboard, as high as its rows are guessed",
        json(under) ===
            json({
                name: 'center',
                level: 'panel',
                anchor: { mod: 'status-bar', id: 'notifications' },
                width: 360,
                height: 16 + 32 + 8 + 44 + 8 + 84 + 16,
            }) && typeof didAppear === 'function',
        under
    );
    check(
        'laid out, it is sized to its rows',
        json(view.asked) === json([['resize', 360, 16 + 32 + 8 + 128 + 16]]),
        view
    );
    await sut.toggle();
    await sut.showList();
    check(
        'toggle then toggles the view that stands, and show shows it',
        windows.length === 3 && json(view.asked.slice(1)) === json([['toggle'], ['makeKeyAndOrderFront']]),
        view.asked
    );
    const key = (name, more = {}) => {
        const event = { key: name, prevented: false, preventDefault: () => (event.prevented = true), ...more };
        PAGE.listeners.keydown(event);
        return event.prevented;
    };
    calls.length = 0;
    const taken = [key('ArrowDown'), key('Enter'), key('Backspace', { metaKey: true }), key('Escape'), key('a')];
    check(
        'the arrows move along the rows, Return runs the row and Command-Delete removes it; Escape is left to the shell',
        json(taken) === json([true, true, true, false, false]) &&
            json(calls) ===
                json([
                    ['press', 'y'],
                    ['remove', 'y'],
                ]),
        { taken, calls }
    );
    // What a seat read of the center names its buttons: they stand as the record changes around them.
    const rowOf = (id) =>
        list.children[1].children.find((row) => row.children[1].children[0].children[0].textContent === id);
    const held = {
        head: list.children[0],
        clear: list.children[0].children.at(-1),
        remove: rowOf('x').children.at(-1),
    };
    record.unshift(note('z', { posted: 0 }));
    told();
    await settle();
    const stood = {
        rows: list.children[1].children.length,
        head: list.children[0] === held.head,
        clear: list.children[0].children.at(-1) === held.clear,
        remove: rowOf('x').children.at(-1) === held.remove,
    };
    record.find(({ id }) => id === 'x').body = 'now with words';
    told();
    await settle();
    check(
        'as a notification comes the head, Clear All and the rows that stood keep their elements, and a row whose ' +
            'notification says another thing is drawn anew',
        json(stood) === json({ rows: 3, head: true, clear: true, remove: true }) &&
            rowOf('x').children.at(-1) !== held.remove &&
            rowOf('x').children[1].children[1]?.textContent === 'now with words',
        stood
    );
    held.clear.onClick();
    record.length = 0;
    told();
    await settle();
    check(
        'Clear All clears the record, and the view is sized to the empty record',
        json(calls.at(-1)) === json(['clear']) &&
            json(view.asked.at(-1)) === json(['resize', 360, 16 + 32 + 8 + 168 + 16]),
        { calls, asked: view.asked }
    );
    sut.end();
}

main().catch((error) => {
    console.error('[notifications] ' + (error.stack || error.message));
    process.exit(1);
});
