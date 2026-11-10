// The Notifications mod's center (mods/notifications/src/center/center.js) over a stand-in for deckit: what a sender
// posts through its connection is listed, signalled and kept, removed only by its sender, let through at the rate and
// queued behind the toasts on screen, shown as the system's while the app is not in front, and a press runs the
// sender's command through deckit/commands. Then a sender, Calendar's notices, with an owner to post to and with none.
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
    const emitted = [];
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
        events: { emit: (name, ...args) => emitted.push([name, ...args]) },
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

    // While the app is not in front, the system shows it.
    const first = await calendar.post({
        title: 'Standup',
        body: 'in 5 min',
        command: 'show-date',
        args: { date: '2026-11-06' },
    });
    await ticks();
    const listed = await browser.list();
    check(
        'a post is listed for any sender, with its sender, and without its command',
        listed.length === 1 && listed[0].id === first && listed[0].mod.name === 'Calendar' && !('command' in listed[0]),
        listed
    );
    check(
        'a post is signalled as posted',
        emitted.some(([name, id]) => name === 'deckit/notifications:posted' && id === first),
        emitted
    );
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
    check(
        'a removal is signalled as removed',
        emitted.some(([name, id]) => name === 'deckit/notifications:removed' && id === second),
        emitted
    );
    check(
        'an action that names no command is refused',
        await browser.post({ title: 'x', actions: [{ title: 'Open' }] }).then(
            () => false,
            () => true
        ),
        null
    );
    check(
        'a post with neither title nor body is refused',
        await browser.post({}).then(
            () => false,
            () => true
        ),
        null
    );

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

    // While the app is in front and a drawer is there, toasts, as many as fit, the rest queued.
    active = true;
    const drawn = [];
    const hidden = [];
    sut.drawWith({
        show: (notification) => drawn.push(notification.id),
        hide: (id) => hidden.push(id),
        active: async () => active,
    });
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

    for (const line of failed) console.error(line);
    if (failed.length) {
        console.error(`${failed.length} of ${count} notifications checks failed`);
        process.exit(1);
    }
    console.log(`ok: ${count} notifications checks`);
}

main().catch((error) => {
    console.error('[notifications] ' + (error.stack || error.message));
    process.exit(1);
});
