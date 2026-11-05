// The Notifications mod's center (mods/notifications/src/center/center.js) over a stand-in for deckit: what a sender
// posts through its connection is listed, signalled and kept, removed only by its sender, let through at the rate and
// queued behind the toasts on screen, shown as the system's while the app is not in front, and a press runs the
// sender's token and releases it. Then a sender, Calendar's notices, with an owner to post to and with none. Exits 1
// with a line for each check that failed.
const path = require('path');

const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (count = 5) => {
    for (let index = 0; index < count; index++) await tick();
};

async function main() {
    const mods = path.join(__dirname, '..', '..', 'deckit', 'mods');
    const { center, RATE, TOASTS } = require(path.join(mods, 'notifications', 'src', 'center', 'center.js'));
    const failed = [];
    let count = 0;
    const check = (name, ok, seen) => {
        count++;
        if (!ok) failed.push(`FAIL ${name}: ${JSON.stringify(seen)}`);
    };

    let time = 1000;
    let active = false;
    const records = new Map();
    const emitted = [];
    const ran = [];
    const released = [];
    const system = []; // { title, press }
    const deckit = {
        storage: {
            records: {
                get: (key, fallback) => structuredClone(records.get(key) ?? fallback),
                set: async (key, value) => records.set(key, structuredClone(value)),
            },
        },
        events: { emit: (name, ...args) => emitted.push([name, ...args]) },
        active: async () => active,
        commands: {
            tokens: {
                run: async (token) => (ran.push(token), null),
                release: async (token) => released.push(token),
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
    const sut = center(deckit, { now: () => time });
    const calendar = sut.exportsFor({ mod: { id: 'calendar', name: 'Calendar' } });
    const browser = sut.exportsFor({ mod: { id: 'browser', name: 'Browser' } });

    // While the app is not in front, the system shows it.
    const first = await calendar.post({ title: 'Standup', body: 'in 5 min', token: 'token-1' });
    await ticks();
    const listed = await browser.list();
    check(
        'a post is listed for any sender, with its sender, and without its token',
        listed.length === 1 && listed[0].id === first && listed[0].mod.name === 'Calendar' && !('token' in listed[0]),
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
    check('a press on the system’s runs the sender’s token', ran.join() === 'token-1', ran);
    check('a press releases the token once it ran', released.join() === 'token-1', released);
    check('a pressed notification is taken away', (await calendar.list()).length === 0, await calendar.list());

    // Removing is the sender's own.
    const second = await calendar.post({
        title: 'Review',
        token: 'token-2',
        actions: [{ title: 'Snooze', token: 'token-3' }],
    });
    await ticks();
    check('another sender does not remove it', (await browser.remove(second)) === false, null);
    check('its sender removes it', (await calendar.remove(second)) === true, null);
    check('a removal releases its tokens', released.slice(1).join() === 'token-2,token-3', released);
    check(
        'a removal is signalled as removed',
        emitted.some(([name, id]) => name === 'deckit/notifications:removed' && id === second),
        emitted
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
    sut.drawWith({ show: (notification) => drawn.push(notification.id), hide: (id) => hidden.push(id) });
    const posts = [];
    for (let index = 0; index < TOASTS + 1; index++) {
        time += RATE.within;
        posts.push(await calendar.post({ title: `t${index}`, token: `toast-${index}` }));
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
    check('a press on a toast runs its token', ran.at(-1) === 'toast-1', ran);
    check('a pressed toast is taken off the screen', hidden.includes(posts[1]), hidden);

    // A sender, Calendar's notices: none is posted while no owner is connected, and one is once an owner is, with a
    // token of its own command; a post the owner's ended connection rejects gives its token back.
    const { notice } = require(path.join(mods, 'calendar', 'src', 'notice', 'notice.js'));
    let connected = null;
    const minted = [];
    const cancelled = [];
    const sender = notice({
        dependencies: { onConnect: (name, listener) => name === 'deckit/notifications' && (connected = listener) },
        commands: {
            tokens: {
                mint: async (command, args) => (minted.push([command, args]), `minted-${minted.length}`),
                cancel: async (token) => cancelled.push(token),
            },
        },
    });
    const date = new Date(2026, 10, 6);
    check('with no owner a sender’s notice is not posted', (await sender.post({ title: 'a', date })) === false, minted);
    const posted = [];
    const disconnect = connected({ post: async (notification) => (posted.push(notification), 'id') });
    check('with an owner it is posted', (await sender.post({ title: 'b', date })) === true, posted);
    check(
        'its token is of the sender’s own command, with the day',
        minted[0]?.[0] === 'show-date' && minted[0]?.[1].date === '2026-11-06' && posted[0]?.token === 'minted-1',
        { minted, posted }
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
    check('and its token is cancelled', cancelled.join() === 'minted-2', cancelled);

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
