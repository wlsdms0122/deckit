// A party on a transport connection from outside, checked against the app under test through the client of the wire
// (cli/outside): a key registered for a user attaches as a run of it once the local seat let it sit, any other proof is
// refused and told nothing, a principal that runs takes no second party, and the run asks what a run asks, bounded by
// a job that grants only the seat permission: its own records and events, no connection, and what a seat does and
// reads. The users and the keys are made, listed and removed as a host does it, by `deckit user` and `deckit key`
// against the app's folder, while the app runs. The shell serves the seats: a user that asks to sit is a row of the
// Seats mod's view under its item in the status bar, which the local seat answers as the machine presses, yes, no
// for one user and never for another: a user is known there by its name. The app is started with asking on, and
// while `deckit seat asking` has it off a user sits unasked. Two users, each
// a terminal of its own, press and type in the windows of the
// desktop beside the local seat, `windowsNow()` and `desktopLaid()` reading what the local seat sees of them, and
// `idleTime` the seconds a seat is idle after, as the app was started with. With `reads`, the second user reads the
// desktop it sits at too (reading.js). With `bar`, the status bar as the walk through the desktop left it, `{ barPage,
// capsuleNow, joins, frame, overlay }`, `joins()` the page of the mod that joins it, `frame()` the page of the bar's
// own mod and `overlay()` that page's overlay, a user scrolls the bar in a narrow room and reads it, and the local seat
// and that user fix an item of it and let it scroll again.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { makeKey, readKey, connect } = require('../outside/client.js');
const RELAY = require('../outside/relay.js');
const { sleep, until } = require('./devtools.js');
const READING = require('./reading.js');

// How long an admission waits for the local seat's answer, in ms (deckit-shell/deckit/seat).
const ASK_TIME = 60000;
// The users the local seat answers no, and never.
const DENIED = 'outside-denied';
const WAITS = 'outside-waiting';
// The local seat's user, as the view of Seats names it.
const LOCAL_NAME = 'Deckit';

const refusedWith = (promise) =>
    promise.then(
        () => null,
        ({ message, code, kind = null, stage = null }) => ({ message, code, kind, stage })
    );
// What a command wrote as it exited with an error, or null for one that did not.
const refusedBy = (run) => {
    try {
        run();
        return null;
    } catch (error) {
        return String(error.stderr);
    }
};
const settled = (promise, limit = 5000) =>
    Promise.race([promise.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), limit))]);

async function run({
    check,
    home,
    logged,
    main,
    windowsNow,
    desktopLaid,
    idleTime,
    asksNow,
    pressAt,
    pageAt,
    desktopShot,
    answer,
    allowed,
    seatsView,
    reads,
    anchors,
    bar,
}) {
    const socket = path.join(home, 'deckit.sock');
    const principal = 'outside-party';
    const key = makeKey();
    const command = path.join(__dirname, '..', 'deckit');
    const cli = (...args) => execFileSync(command, [...args, '--home', home], { encoding: 'utf8', stdio: 'pipe' });
    const deckit = (...args) => cli('key', ...args);
    // A user made with a key pair of its own, the private half in a file beside the app's folder.
    const userWithKey = (id, name) => {
        const file = path.join(home, '..', `${id}.key`);
        cli('user', 'add', id, '--name', name, '--key', file);
        return { file, ...readKey(fs.readFileSync(file, 'utf8')) };
    };
    const inPage = async (id, script) => {
        const told = await main(`return webkit.evaluate(${id}, ${JSON.stringify(`return ${script}`)}, 'page')`);
        try {
            return JSON.parse(told);
        } catch {
            return told;
        }
    };
    const desk = (await desktopLaid())?.pages.find(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''))?.id;
    // The users at a seat, by name, as the view of Seats has a row of each in the order they sat; none while the bar
    // has no Seats item. The view is put away again, so the local seat's keyboard is left with its key window.
    const seatsNow = async () => {
        const { seats } = await seatsView.rows();
        await seatsView.away();
        return seats.map(({ name }) => name);
    };

    // Nobody answers the ask for this user: its party waits as long as an admission waits, while the rest goes on.
    const waiting = userWithKey(WAITS, 'Waits');
    const waits = await connect(socket);
    let waitsTold = 0;
    let waitsAnswered = false;
    waits.on('attach/asking', () => waitsTold++);
    const began = Date.now();
    const unanswered = refusedWith(waits.authenticate({ principal: WAITS, ...waiting })).then((refusal) => {
        waitsAnswered = true;
        return { refusal, after: Date.now() - began };
    });

    deckit('add', principal, key.publicKey, '--name', 'test');
    const keyed = await connect(socket);
    const recordless = await refusedWith(keyed.authenticate({ principal, ...key }));
    cli('user', 'add', principal, '--name', 'Outside Party');
    const users = cli('user', 'list');
    check(
        'outside: the users are listed, the local one among them',
        users === `local Deckit\n${principal} Outside Party\n${WAITS} Waits\n`,
        users
    );
    const asMod = refusedBy(() => cli('user', 'add', 'editor', '--name', 'Editor'));
    check('outside: no user is made under the id of a mod', /editor/.test(asMod ?? ''), String(asMod));
    const started = { contributions: { exportedIn: {}, awaits: {} } };
    const nothing = { message: 'not authenticated', code: -32803, kind: 'NOT_AUTHENTICATED', stage: 'call' };
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

    check('outside: only its owner opens the socket', (fs.statSync(socket).mode & 0o777) === 0o600, '');
    check(
        'outside: a registered key of a principal that is no user is refused as a wrong key is',
        same(recordless, nothing),
        JSON.stringify(recordless)
    );

    const early = await connect(socket);
    const before = await refusedWith(early.request('record/keys', {}));
    check('outside: a request before authentication is refused', before?.code === -32002, JSON.stringify(before));
    early.close();

    const stranger = await connect(socket);
    const wrong = await refusedWith(stranger.authenticate({ principal, ...makeKey() }));
    check('outside: a key not registered is refused and told nothing', same(wrong, nothing), JSON.stringify(wrong));
    check('outside: a refused transport connection is closed', await settled(stranger.closed), '');
    const nobody = await connect(socket);
    const unknown = await refusedWith(nobody.authenticate({ principal: 'no-such-principal', ...key }));
    check(
        'outside: a principal with no key is refused as a wrong key is',
        same(unknown, nothing),
        JSON.stringify(unknown)
    );

    const pending = await refusedWith(waits.request('seat/read', { of: 'desktop' }));
    check(
        'outside: a party whose admission waits sits at no seat, and what it asks of one is refused',
        pending?.code === -32002 && waitsTold === 1,
        JSON.stringify({ pending, waitsTold })
    );
    const denying = userWithKey(DENIED, 'Denied');
    const unwelcome = await connect(socket);
    let deniedTold = 0;
    unwelcome.on('attach/asking', () => deniedTold++);
    const refusing = refusedWith(unwelcome.authenticate({ principal: DENIED, ...denying }));
    const askedDenied = await answer('Denied', 'deny');
    const denied = await refusing;
    check(
        "outside: a user the local seat's press on Deny denies is told it was asked, refused, and closed",
        same(askedDenied, ['Waits', 'Denied']) &&
            denied?.kind === 'REFUSED' &&
            deniedTold === 1 &&
            (await settled(unwelcome.closed)),
        JSON.stringify({ askedDenied, denied, deniedTold })
    );

    const party = await connect(socket);
    let told = 0;
    party.on('attach/asking', () => told++);
    const attaching = party.authenticate({ principal, ...key });
    const askedParty = await answer('Outside Party', 'allow');
    const attached = await attaching;
    check(
        'outside: a registered key of a user attaches as a run of it, granted the seat permission only',
        attached.principal === principal &&
            attached.run === 1 &&
            same(attached.permissions, ['deckit.seat']) &&
            attached.end > 0,
        JSON.stringify(attached)
    );
    const seat = { id: 's1', local: false, user: { id: principal, name: 'Outside Party' } };
    check(
        "outside: a user the local seat's press on Allow allows is told it was asked, then sits at a seat that opened",
        told === 1 && same(attached.seat, seat) && same(askedParty, ['Waits', 'Outside Party']),
        JSON.stringify({ told, seat: attached.seat, askedParty })
    );
    const open = {
        seats: await until(async () => same(await seatsNow(), [LOCAL_NAME, 'Outside Party']) && seatsNow(), 3000),
        asks: await until(async () => same(await asksNow(), ['Waits']) && asksNow(), 3000),
    };
    check(
        'outside: the seat that opened has a row in the view of Seats, and the ask that was answered is gone from it',
        same(open, { seats: [LOCAL_NAME, 'Outside Party'], asks: ['Waits'] }),
        JSON.stringify(open)
    );
    const second = await connect(socket);
    const running = await refusedWith(second.authenticate({ principal, ...key }));
    check(
        'outside: a principal that runs takes no second party',
        running?.kind === 'ALREADY_RUNNING',
        JSON.stringify(running)
    );

    const delivered = [];
    party.on('event/deliver', (event) => delivered.push(event));
    await party.request('runner/started', started);
    const press = { event: 'pointer', type: 'down', x: 40, y: 30, button: 0, count: 1 };
    const pressed = await party.request('seat/input', press);
    const typed = await party.request('seat/input', { event: 'text', type: 'insert', text: 'seen' });
    check(
        'outside: what a seat does enters the shell, which answers what its pointer reached and where its text went',
        pressed && 'over' in pressed && typed && 'to' in typed,
        JSON.stringify({ pressed, typed })
    );
    const reading = await party.request('seat/read', { of: 'desktop' });
    const asData = await party.request('seat/read', { of: 'desktop', format: 'json' });
    const malformed = await refusedWith(party.request('seat/input', { event: 'pointer', type: 'down' }));
    const [first, ...lines] = String(reading?.text).split('\n');
    check(
        'outside: a reading is answered by the shell, as text or as data, and what is malformed is refused',
        first === `desktop ${asData?.data?.desktop.width}x${asData?.data?.desktop.height} mark ${reading.mark}` &&
            lines.some((line) =>
                new RegExp(`^seat ${seat.id} "Outside Party" [a-z]+ at 40,30( key w\\d+)? \\(you\\)$`).test(line)
            ) &&
            asData.data.seats.some(({ id, you }) => id === seat.id && you) &&
            asData.data.seats.some(({ id, name }) => id === 'local' && name === 'Deckit') &&
            !!malformed,
        JSON.stringify({ reading, asData, malformed })
    );
    const changed = [];
    party.on('seat/output', ({ of, ...change }) => of === 'changes' && changed.push(change));
    // A press in the middle of each window: the seat's key window changes, which its line and the window's tell.
    const pressIn = async ({ rect }) => {
        const point = { x: Math.round(rect.x + rect.width / 2), y: Math.round(rect.y + rect.height / 2) };
        await party.request('seat/input', { ...press, ...point });
        await party.request('seat/input', { ...press, ...point, type: 'up' });
    };
    const [front, ...behind] = (await windowsNow()).filter(({ scaled }) => !scaled).reverse();
    await pressIn(front);
    await sleep(200);
    const untold = changed.length;
    const watching = await party.request('seat/watch', { of: 'changes', on: true });
    const since = (await party.request('seat/read', { of: 'changes' })).mark;
    for (const window of behind) await pressIn(window);
    check(
        'outside: a seat that watches is told the desktop changed, and one that does not is told nothing',
        watching === true &&
            untold === 0 &&
            (await until(() => changed.some(({ mark }) => mark > since), 3000)) &&
            changed.every(({ mark }) => Number.isInteger(mark)),
        JSON.stringify({ since, changed })
    );
    await party.request('record/write', { key: 'note', value: { text: 'kept' } });
    const read = await party.request('record/read', { key: 'note' });
    const keys = await party.request('record/keys', {});
    await party.request('record/remove', { key: 'note' });
    const removed = await party.request('record/read', { key: 'note' });
    check(
        'outside: a record round-trips under its principal',
        same(read, { text: 'kept' }) && same(keys, ['note']) && removed === null,
        JSON.stringify({ read, keys, removed })
    );
    await party.request('event/listen', { names: [`${principal}:ping`] });
    await party.request('event/emit', { name: 'ping', args: [1] });
    const heard = await until(() => delivered.length > 0, 3000);
    check(
        'outside: an event arrives, named after its principal',
        heard && same(delivered[0], { name: `${principal}:ping`, args: [1] }),
        JSON.stringify(delivered)
    );
    const connections = await party.request('connection/begin', { lifecycle: 0 });
    const reach = await refusedWith(party.request('connection/reach', { lifecycle: 0, target: 'probe' }));
    check(
        'outside: the job of a user has no connection and reaches none',
        same(connections, []) && reach?.kind === 'NOT_PERMITTED',
        JSON.stringify({ connections, reach })
    );
    const missing = await refusedWith(party.request('no/such', {}));
    check('outside: a method that is none is refused', missing?.code === -32601, JSON.stringify(missing));

    party.close();
    const crashed = await until(() => logged().includes(`${principal}: its transport connection closed`), 5000);
    check('outside: a close without quit is a failed run', crashed, '');
    const closed = await until(async () => !(await seatsNow()).includes('Outside Party'), 3000);
    check('outside: a seat closes with its run, and its row goes', closed, JSON.stringify(await seatsNow()));
    const again = await connect(socket);
    const next = await until(async () => (await refusedWith(again.request('record/keys', {})))?.code === -32002, 1000);
    const reattached =
        next &&
        (await allowed(
            'Outside Party',
            again.authenticate({ principal, ...key }).catch((error) => error)
        ));
    check(
        'outside: its principal runs again in a new run',
        reattached?.run === 2,
        JSON.stringify(reattached?.message ?? reattached)
    );
    let stopped = false;
    again.on('runner/stop', () => {
        stopped = true;
    });
    await again.request('runner/started', started);
    await again.request('runner/quit', {});
    check(
        'outside: a run that quits is asked to stop, then closed',
        (await settled(again.closed)) && stopped,
        String(stopped)
    );

    // A terminal: one command attaches and sits, the others ask through it. Its user's id is short, as the path of
    // its relay, a local socket in the app's folder, is bounded by the system.
    const terminal = 'tty';
    const { file, ...terminalKey } = userWithKey(terminal, 'Terminal');
    const sitting = spawn(command, ['seat', 'attach', terminal, '--key', file, '--home', home]);
    let said = '';
    let refused = '';
    sitting.stdout.on('data', (chunk) => (said += chunk));
    sitting.stderr.on('data', (chunk) => (refused += chunk));
    const exited = new Promise((resolve) => sitting.once('exit', resolve));
    const sat = await allowed(
        'Terminal',
        until(() => /^attached as tty, seat (s\d+)$/m.exec(said)?.[1], 10000)
    );
    const relay = path.join(home, 'seats', `${terminal}.sock`);
    check(
        'outside: deckit seat attach says it asks, then sits, and only its owner opens its relay',
        sat && said.startsWith('asking the local seat ...\n') && (fs.statSync(relay).mode & 0o777) === 0o600,
        said + refused
    );
    const printed = sat && [cli('seat', 'read', 'desktop'), cli('seat', 'press', '10,20'), cli('seat', 'changes')];
    check(
        'outside: deckit seat read desktop prints the desktop with its seat, a press what it reached, changes the marks',
        printed &&
            /^desktop \d+x\d+ mark \d+\n/.test(printed[0]) &&
            new RegExp(`^seat ${sat} "Terminal" [a-z]+ \\(you\\)$`, 'm').test(printed[0]) &&
            /^over \S+/.test(printed[1]) &&
            /^changes \d+ to \d+$/m.test(printed[2]),
        JSON.stringify(printed)
    );
    if (sat) cli('seat', 'detach');
    else sitting.kill();
    check(
        'outside: deckit seat detach ends the run, and its seat and its relay go',
        sat &&
            (await exited) === 0 &&
            said.endsWith('detached\n') &&
            !fs.existsSync(relay) &&
            (await until(async () => !(await seatsNow()).includes('Terminal'), 3000)),
        said
    );

    // Asking is the host's to turn off as the app runs: the next user sits at once, and no row asks for it.
    const words = [cli('seat', 'asking'), cli('seat', 'asking', 'off')];
    const unasked = await connect(socket);
    let unaskedTold = 0;
    unasked.on('attach/asking', () => unaskedTold++);
    const proving = unasked.authenticate({ principal: terminal, ...terminalKey }).catch((error) => error);
    const atOnce = await Promise.race([proving, sleep(5000)]);
    const unaskedAsks = await asksNow();
    words.push(cli('seat', 'asking', 'on'), cli('seat', 'asking'));
    if (atOnce?.seat) {
        await unasked.request('runner/started', started);
        await unasked.request('runner/quit', {});
    } else unasked.close();
    check(
        'outside: with asking turned off as the app runs a user sits at once, unasked, until it is turned on again',
        same(words, ['on\n', 'off\n', 'on\n', 'on\n']) &&
            atOnce?.seat?.user.id === terminal &&
            unaskedTold === 0 &&
            !unaskedAsks.includes('Terminal') &&
            (await settled(unasked.closed)) &&
            (await until(async () => !(await seatsNow()).includes('Terminal'), 3000)),
        JSON.stringify({ words, atOnce: atOnce?.message ?? atOnce, unaskedTold, unaskedAsks })
    );

    // Two users at once, each at a terminal, beside the local seat: the first in a window whose content alone takes
    // its press, the second in the region parent's window, on the child laid over its content. A seat that just sat
    // has the windows in its own order, so it looks for a point where the window shows for it, where its scroll
    // answers the window, and its press there brings the window in front for it, the field with it.
    const sit = async (id, name) => {
        const { file: keyFile } = userWithKey(id, name);
        const sits = spawn(command, ['seat', 'attach', id, '--key', keyFile, '--home', home]);
        let told = '';
        sits.stdout.on('data', (chunk) => (told += chunk));
        const seat = await allowed(
            name,
            until(() => new RegExp(`^attached as ${id}, seat (s\\d+)$`, 'm').exec(told)?.[1], 10000)
        );
        const as = (...args) => {
            try {
                return cli('seat', ...args, '--as', id).trim();
            } catch (error) {
                return String(error.stderr).trim();
            }
        };
        return { seat, as, gone: new Promise((resolve) => sits.once('exit', resolve)) };
    };
    const FIELD = 'deckit-seat-field';
    const field = (page) =>
        inPage(
            page,
            `(() => {
                const field = Object.assign(document.createElement('input'), { id: '${FIELD}' });
                field.style.cssText =
                    'position:fixed;left:8px;top:8px;width:150px;height:24px;z-index:99999;font:16px monospace';
                document.body.append(field);
                return true;
            })()`
        );
    const valueOf = (page) => inPage(page, `document.querySelector('#${FIELD}')?.value ?? null`);
    const focusedIn = (page) => inPage(page, `document.activeElement?.id === '${FIELD}'`);
    // The end of the field in a page laid at `rect`, past what is typed in it.
    const at = ({ rect }, dx = 0) => `${Math.round(rect.x + 148 + dx)},${Math.round(rect.y + 20)}`;
    const showsFor = (seat, { id, rect }) => {
        for (const down of [0.5, 0.25, 0.75])
            for (let across = 12; across < rect.width - 12; across += 36) {
                const point = `${Math.round(rect.x + across)},${Math.round(rect.y + rect.height * down)}`;
                if (seat.as('scroll', point, '0,1') === `over ${id}`) return point;
            }
        return null;
    };
    const laid = (await desktopLaid())?.pages ?? [];
    // The pages of a window, its content first and what is laid over it after.
    const pagesOf = ({ id }) => {
        const from = laid.findIndex(({ name }) => name === `frame-${id}`);
        const to = laid.findIndex(({ name }) => name === `buttons-${id}`);
        return from < 0 || to < from ? [] : laid.slice(from + 1, to);
    };
    await seatsView.away();
    const standing = (await windowsNow()).filter(({ scaled }) => !scaled);
    const windowA = standing.find((window) => !window.key && pagesOf(window).length === 1);
    const windowB = standing.find(({ key, mod }) => !key && mod === 'region-parent');
    const child = windowB && pagesOf(windowB)[1];
    const localKey = standing.find(({ key }) => key);
    if (!windowA || !child || !localKey) {
        check(
            'outside: windows stand for two seats and the local one',
            false,
            JSON.stringify({ standing, laid: laid.map(({ id, name }) => ({ id, name })) })
        );
    } else {
        const [seatA, seatB] = [await sit('ta', 'First'), await sit('tb', 'Second')];
        for (const page of [windowA.content, windowB.content, child.id, localKey.content]) await field(page);
        const texts = async () => [
            await valueOf(windowA.content),
            await valueOf(child.id),
            await valueOf(windowB.content),
            await valueOf(localKey.content),
        ];
        const shown = [seatA.as('press', showsFor(seatA, windowA)), seatB.as('press', showsFor(seatB, windowB))];
        const answered = [seatA.as('press', at(windowA)), seatB.as('press', at(child))];
        const tookPress = { content: await focusedIn(windowB.content), child: await focusedIn(child.id) };
        const typing = [
            seatA.as('type', 'al'),
            seatB.as('type', 'be'),
            seatA.as('type', 'pha'),
            seatB.as('type', 'ta'),
        ];
        const inFields =
            (await until(async () => {
                const now = await texts();
                return same(now.slice(0, 2), ['alpha', 'beta']) && now;
            }, 3000)) || (await texts());
        check(
            'outside: two seats press two windows and type at once, and each text is in its own window',
            seatA.seat &&
                seatB.seat &&
                same(answered, [`over ${windowA.id}, key`, `over ${windowB.id}, key`]) &&
                same(inFields, ['alpha', 'beta', '', '']),
            JSON.stringify({ shown, answered, typing, inFields })
        );
        // Where each of the two types, as the desktop's page draws it over a window the machine's keyboard is not in:
        // a ring round the field and a caret in it, where no window in front of it for the local seat is over the
        // field, and nothing where one is.
        const typingOf = async ({ seat }, { id, rect }) => {
            const [left, top, right, bottom] = [rect.x + 10, rect.y + 10, rect.x + 150, rect.y + 28];
            const corners = [left, right].flatMap((x) => [top, bottom].map((y) => ({ x, y })));
            const reached = await Promise.all(corners.map(pageAt));
            const drawn = await inPage(
                desk,
                `(() => {
                    const rects = (name) => [...document.querySelectorAll(name + '[data-seat="${seat}"]')].map((node) => {
                        const { x, y, width, height } = node.getBoundingClientRect();
                        return { x, y, right: x + width, bottom: y + height };
                    });
                    return { rings: rects('.deckit-seat-focus'), carets: rects('.deckit-seat-bar[data-caret]') };
                })()`
            );
            const [ring] = drawn.rings ?? [];
            const [caret] = drawn.carets ?? [];
            const inPlace =
                ring && caret && ring.x <= left && ring.y <= top && ring.right >= right && ring.bottom >= bottom;
            const inRing = inPlace && caret.x >= ring.x && caret.right <= ring.right && caret.y >= ring.y;
            const shows = reached.every((page) => page === id);
            return { ok: shows ? !!inRing : drawn.rings?.length === 0, inRing: !!inRing, shows, reached, drawn };
        };
        const ofA = { id: windowA.content, rect: windowA.rect };
        const typings = (await until(async () => {
            const now = [await typingOf(seatA, ofA), await typingOf(seatB, child)];
            return now.every(({ ok }) => ok) && now;
        }, 3000)) || [await typingOf(seatA, ofA), await typingOf(seatB, child)];
        check(
            'outside: where each of two seats types is drawn on the desktop, a ring round its field and its caret in it',
            typings.every(({ ok }) => ok),
            JSON.stringify(typings)
        );
        check(
            "outside: a seat's text goes to the page of its key window that took its press, a child over the content",
            tookPress.child && !tookPress.content && inFields[1] === 'beta' && inFields[2] === '',
            JSON.stringify({ tookPress, inFields })
        );
        const acted = [
            seatA.as('scroll', at(windowA), '0,40'),
            seatA.as('drag', at(windowA), at(windowA, -2)),
            seatA.as('move', '2,300'),
        ];
        check(
            'outside: deckit seat scroll, drag and move print what the pointer reached',
            same(acted, [`over ${windowA.id}`, `over ${windowA.id}, key`, 'over nothing']),
            JSON.stringify(acted)
        );
        // What the desktop's page draws of the two seats: in the cursors' surface, the last page laid on the desktop,
        // which takes the pointer nowhere, a cursor each where its pointer last went and a ring where a press began,
        // noted as it is drawn since it fades; and its colour round the title bar of its key window.
        const pageNamed = (test) => laid.find(test)?.id;
        const desktopPage = pageNamed(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''));
        const over = ((await desktopLaid())?.pages ?? []).filter(({ hidden }) => !hidden).at(-1);
        const cursorsPage = over?.name === 'cursors' ? over.id : null;
        check(
            "outside: the seats' cursors are in a surface laid over everything on the desktop, which takes no pointer",
            cursorsPage !== null && Array.isArray(over.input) && over.input.length === 0,
            JSON.stringify({ name: over?.name, input: over?.input, rect: over?.rect })
        );
        await inPage(
            cursorsPage,
            `(() => {
                window.deckitRings = [];
                new MutationObserver((records) => {
                    for (const { addedNodes } of records)
                        for (const node of addedNodes)
                            if (node.className === 'deckit-seat-press') window.deckitRings.push(node.style.transform);
                }).observe(document.querySelector('.deckit-seat-cursors'), { childList: true });
                return true;
            })()`
        );
        const pressedAt = at(windowA);
        seatA.as('press', pressedAt);
        const read = seatB.as('read', 'desktop').split('\n');
        const colourOf = ({ seat }) => new RegExp(`^seat ${seat} "\\w+" ([a-z]+) `, 'm').exec(read.join('\n'))?.[1];
        const placed = (point) => `translate(${point.split(',').join('px, ')}px)`;
        const worn = (seat) => `var(--deckit-seat-${colourOf(seat)})`;
        const drawnSeats = await until(async () => {
            const seen = await inPage(
                cursorsPage,
                `({ rings: window.deckitRings, cursors: [...document.querySelectorAll('.deckit-seat-cursor')].map(
                    (node) => [
                        node.dataset.seat,
                        node.querySelector('.deckit-seat-name').textContent,
                        node.style.getPropertyValue('--deckit-seat'),
                        node.style.transform,
                    ].join(' ')
                ) })`
            );
            return seen?.rings?.length > 0 && seen.cursors?.length === 2 && seen;
        }, 3000);
        const holderOf = ({ id }) =>
            inPage(
                pageNamed(({ name }) => name === `frame-${id}`),
                `(() => {
                    const holder = document.querySelector('.deckit-window-holder');
                    return !!holder && !holder.hidden && holder.style.getPropertyValue('--deckit-seat');
                })()`
            );
        const holders = [await holderOf(windowA), await holderOf(windowB)];
        check(
            'outside: each seat has a cursor in its colour where its pointer last went, and a press leaves a ring',
            drawnSeats &&
                colourOf(seatA) &&
                colourOf(seatA) !== colourOf(seatB) &&
                same(drawnSeats.cursors, [
                    `${seatA.seat} First ${worn(seatA)} ${placed(pressedAt)}`,
                    `${seatB.seat} Second ${worn(seatB)} ${placed(at(child))}`,
                ]) &&
                same(drawnSeats.rings, [placed(pressedAt)]),
            JSON.stringify({ drawnSeats, read: read.slice(0, 4), pressedAt, child: at(child) })
        );
        check(
            "outside: a key window's frame wears its holder's colour, each seat's own",
            same(holders, [worn(seatA), worn(seatB)]),
            JSON.stringify({ holders, read: read.slice(0, 4) })
        );
        // The local seat follows the first: its press on that seat's row in the view of Seats shows the seat's view,
        // the window it holds in front and key, until the local seat presses again, which reaches nothing. The view
        // of Seats is put away as the following begins, and its rows are read where it is.
        const viewNow = async () => {
            const standing = (await windowsNow()).filter(({ scaled }) => !scaled);
            const bar = await inPage(
                desktopPage,
                `document.querySelector('.deckit-following:not([hidden]) span')?.textContent ?? ''`
            );
            const cursors = await inPage(
                cursorsPage,
                `[...document.querySelectorAll('.deckit-seat-cursor')].map((n) => n.dataset.seat)`
            );
            return { front: standing.at(-1)?.id, key: standing.find(({ key }) => key)?.id, bar, cursors };
        };
        await seatsView.away();
        const ownView = await viewNow();
        // The rows of the view, as the local seat's press on the item shows it: a row for each seat in the order
        // they sat, in the colour the seat reads of itself, with its user's name.
        const seatsShown = await seatsView.shown();
        const rowsDrawn = (await seatsView.rows(seatsShown)).seats.map(
            ({ name, colour, idle }) => `${name} ${colour} ${idle}`
        );
        check(
            'outside: each attached seat has a row in the view of Seats, in its colour, with its name, not idle',
            same(rowsDrawn.slice(1), [`First ${worn(seatA)} false`, `Second ${worn(seatB)} false`]) &&
                rowsDrawn[0]?.startsWith(`${LOCAL_NAME} `),
            JSON.stringify(rowsDrawn)
        );
        await seatsView.pressIn(seatsShown, '.seats-seat[aria-label^="First"]');
        const followedView = await until(async () => {
            const now = await viewNow();
            return now.bar && now.front === windowA.id && now;
        }, 3000);
        const followedRows = await seatsView.rows(seatsShown);
        check(
            "outside: the local seat's press on a seat's row shows that seat's view, a bar says whose it is, and " +
                'the row says it is followed',
            followedView &&
                followedView.bar === 'Following First' &&
                followedView.key === windowA.id &&
                ownView?.key === localKey.id &&
                same(
                    followedRows.seats.filter(({ following }) => following).map(({ name }) => name),
                    ['First']
                ) &&
                !followedView.cursors.includes(seatA.seat),
            JSON.stringify({ ownView, followedView: followedView || (await viewNow()), followedRows })
        );
        // The followed seat's window is in front in the view shown, so where it types is drawn there.
        const followedTyping = await until(async () => {
            const now = await typingOf(seatA, ofA);
            return now.inRing && now;
        }, 3000);
        await desktopShot('seats-typing');
        check(
            'outside: in the view of a seat that is followed, a ring is round the field it types in and its caret in it',
            !!followedTyping,
            JSON.stringify(followedTyping || (await typingOf(seatA, ofA)))
        );
        const inA = {
            x: Math.round(windowA.rect.x + windowA.rect.width / 2),
            y: Math.round(windowA.rect.y + windowA.rect.height / 2),
        };
        const reached = await pageAt(inA);
        await pressAt(inA);
        const backView = await until(async () => {
            const now = await viewNow();
            return !now.bar && now;
        }, 3000);
        await sleep(300);
        const restedView = await viewNow();
        check(
            'outside: its next press ends the following and reaches nothing: its own view is back as it left it',
            reached === desktopPage && backView && same({ ...restedView, cursors: [] }, { ...ownView, cursors: [] }),
            JSON.stringify({ reached, desktopPage, ownView, backView, restedView })
        );
        // The second seat presses the first one's window right after the first typed in it: held, and typing nothing.
        const shownToB = showsFor(seatB, windowA);
        seatA.as('type', '!');
        const answeredHeld = [seatB.as('press', shownToB), seatB.as('press', at(windowA))];
        const typedHeld = seatB.as('type', 'no');
        const afterHeld = await texts();
        check(
            'outside: a press on a window another seat holds answers held, and what the seat types then is refused',
            same(answeredHeld, Array(2).fill(`over ${windowA.id}, held by ${seatA.seat}`)) &&
                /holds the keyboard/.test(typedHeld) &&
                same(afterHeld, ['alpha!', 'beta', '', '']),
            JSON.stringify({ shownToB, answeredHeld, typedHeld, afterHeld })
        );
        // The first seat gives no input for the idle time: its window is the second one's as it presses it.
        const hears = await connect(RELAY.fileOf(home, 'ta'));
        const heard = [];
        hears.on('seat/output', ({ of, ...told }) => of === 'held' && heard.push(told));
        await new Promise((resolve) => setTimeout(resolve, idleTime * 1000 + 500));
        const taken = seatB.as('press', at(windowA));
        const told = await until(() => heard[0], 3000);
        const typedTaken = seatB.as('type', '?');
        const afterTaken = await until(async () => (await valueOf(windowA.content)) === 'alpha!?', 3000);
        hears.close();
        check(
            "outside: an idle holder's window is taken by the seat that presses it, and the holder is told it is held",
            taken === `over ${windowA.id}, key` && same(told, { window: windowA.id, holder: seatB.seat }) && afterTaken,
            JSON.stringify({ taken, heard, typedTaken, in: await valueOf(windowA.content) })
        );
        const chordSent = seatB.as('key', 'Meta+KeyW');
        const closedOwn = await until(async () => !(await windowsNow()).some(({ id }) => id === windowA.id), 5000);
        const standingAfter = (await windowsNow()).map(({ id }) => id);
        check(
            "outside: a seat's close chord closes its own key window, and no other",
            closedOwn && standingAfter.includes(windowB.id) && standingAfter.includes(localKey.id),
            JSON.stringify({ chordSent, standingAfter, windowA: windowA.id })
        );
        // The second seat, back at the field of the child, reads what it sits at.
        const back = [seatB.as('press', showsFor(seatB, windowB)), seatB.as('press', at(child))];
        const watch = ({ seat }) => {
            const user = seat === seatA.seat ? 'ta' : 'tb';
            const watching = spawn(command, ['seat', 'watch', '--as', user, '--home', home]);
            let told = '';
            watching.stdout.on('data', (chunk) => (told += chunk));
            return { said: () => told, stop: () => watching.kill('SIGINT') };
        };
        try {
            if (back[1] !== `over ${windowB.id}, key`) throw new Error(`the seat is not back: ${back}`);
            if (reads)
                await READING.run({
                    check,
                    reader: seatB,
                    other: seatA,
                    window: (await windowsNow()).find(({ id }) => id === windowB.id),
                    editor: (await windowsNow()).find(({ mod }) => mod === 'editor'),
                    settings: (await windowsNow()).find(({ mod }) => mod === 'settings'),
                    showsFor,
                    inPage,
                    page: child.id,
                    field: FIELD,
                    folder: path.join(home, '..'),
                    watch,
                });
        } catch (error) {
            check('reading: a seat read the desktop', false, error.stack);
        }
        for (const page of [windowB.content, child.id, localKey.content])
            await inPage(page, `document.querySelector('#${FIELD}')?.remove()`);
        if (bar) await barChecks({ seatA });
        await viewChecks({ seatA, seatB });
        await seatsChecks({ seatA, seatB });
        seatA.as('detach');
        seatB.as('detach');
        check('outside: both terminals detach', (await seatA.gone) === 0 && (await seatB.gone) === 0, '');
    }

    // The status bar in a narrow room: the joining mod sets an item 57 wide and opens a band of its own that leaves
    // the status bar room for its clock and 30 more. The capsule is as wide as that room, the clock where it was from
    // the right end, and the item under what is left, from its left end. A seat's turn of the wheel over the item
    // scrolls it sideways, by a sideways turn and by a vertical one, the clock staying, and the seat reads the bar as a
    // panel window: a toolbar, a button an item.
    async function barChecks({ seatA }) {
        const { capsuleNow, joins } = bar;
        const mod = await joins();
        const send = (name, detail) =>
            mod?.evaluate(`document.dispatchEvent(new CustomEvent('${name}', { detail: ${JSON.stringify(detail)} }))`);
        const [CONTROLS, MARGIN, GAP, SHOWN] = [92, 8, 8, 30];
        await send('test-item', { name: 'Star', icon: 'star', command: 'show', count: 120 });
        const wide = await until(async () => {
            const now = await capsuleNow();
            return now.joined?.width === 57 && now.bar?.width === now.clock.x + now.clock.width + 2 && now;
        }, 6000);
        if (!wide) return check('outside: the status bar holds the item of the mod that joins it', false, '');
        const stage = (await desktopLaid())?.rect.width;
        const room = wide.bar.width - (57 - SHOWN);
        const band = stage - CONTROLS - 2 * MARGIN - GAP - room;
        await send('test-band', band);
        const narrow =
            (await until(async () => {
                const now = await capsuleNow();
                return now.bar?.width === room && now.joined && now;
            }, 6000)) || (await capsuleNow());
        const fromRight = ({ bar: laid, clock }) => laid.width - clock.x - clock.width;
        check(
            'outside: in a narrow room the status bar is as wide as its room, the clock where it was from the right ' +
                'end and the item under what is left, from its left end',
            narrow.bar?.width === room &&
                narrow.bar.x + narrow.bar.width === wide.bar.x + wide.bar.width &&
                fromRight(narrow) === 2 &&
                narrow.clock.width === wide.clock.width &&
                narrow.joined.x === 2 &&
                narrow.joined.width === 57,
            JSON.stringify({ wide, room, narrow })
        );
        const over = `${Math.round(narrow.bar.x + 12)},${Math.round(narrow.bar.y + 14)}`;
        const turn = async (by, x) => {
            const said = seatA.as('scroll', over, by);
            const now = await until(async () => {
                const each = await capsuleNow();
                return each.joined?.x === x && each;
            }, 4000);
            return { said, now: now || (await capsuleNow()) };
        };
        const sideways = await turn('27,0', -25);
        await desktopShot('status-bar-scrolled', {
            crop: { x: narrow.bar.x - 60, y: 0, width: narrow.bar.width + 68, height: 52 },
        });
        const read = seatA.as('read', 'desktop');
        const panel = /^panel (w\d+) .* status-bar top at /m.exec(read)?.[1];
        const asWindow = panel ? seatA.as('read', 'window', panel) : read;
        const back = await turn('0,-10', -15);
        const held = await turn('0,-500', 2);
        check(
            "outside: a seat's turn of the wheel over the status bar scrolls its items sideways, by a sideways turn " +
                'and by a vertical one, held at the ends, and the clock stays',
            sideways.now.joined?.x === -25 &&
                back.now.joined?.x === -15 &&
                held.now.joined?.x === 2 &&
                [sideways, back, held].every(({ now }) => now.bar?.width === room && fromRight(now) === 2),
            JSON.stringify({ sideways, back, held })
        );
        check(
            'outside: a seat reads the status bar as a panel window, a toolbar with a button for each item',
            /toolbar "Status Bar"/.test(asWindow) &&
                /button "Clock"/.test(asWindow) &&
                /button "Star, 99\+"/.test(asWindow),
            asWindow
        );
        await fixChecks({ seatA, send, wide, room, band, over, turn });
        await send('test-band', null);
        await send('test-item', null);
        const alone = await until(async () => {
            const now = await capsuleNow();
            return !now.joined && now.bar?.width === wide.bar.width - 57 - 4 && now;
        }, 6000);
        check(
            'outside: as the room is given back and the item goes the status bar is as wide as what is left in it',
            alone,
            JSON.stringify(await capsuleNow())
        );
    }

    // The person fixes an item, in the narrow room `room` wide where the item scrolls: the local seat's context press on
    // it opens a menu of one entry in the frame's overlay, and Keep in Bar stands it whole in the fixed region left of
    // the clock, where no turn of the wheel moves it. The frame's mod run again has it fixed still. Don't Keep in Bar
    // lets it scroll again. A seat does the same at the surface: button 2 on the item as it reads it, then the entry
    // as it reads it in the frame's overlay, and the one bar every screen shows has it fixed, and scrolling again.
    async function fixChecks({ seatA, send, wide, room, band, over, turn }) {
        const { capsuleNow, barPage, frame, overlay } = bar;
        const ENTRY = `.deckit-menu[data-state="open"] [role="menuitem"]`;
        const stands = async (wanted, time = 5000) =>
            (await until(async () => {
                const now = await capsuleNow();
                return wanted(now) && now;
            }, time)) || (await capsuleNow());
        // Whole in the fixed region, right before the clock, which ends the capsule: whatever else the bar holds.
        const fixedWhole = ({ bar: laid, joined, clock }) =>
            joined?.region === 'fixed' &&
            joined.width === 57 &&
            joined.x + joined.width + 4 === clock?.x &&
            clock.x + clock.width + 2 === laid?.width;
        const scrolls = ({ bar: laid, joined }) => joined?.region === 'scrolled' && laid?.width === room;
        // Where the item stands with the bar scrolled to its start: after the items that scroll left of it, 4 apart,
        // whichever order the bar has them in.
        const restOf = ({ items, joined }) => {
            const before = items.filter(({ region, x }) => region === 'scrolled' && x < joined?.x);
            return before.reduce((x, { width }) => x + width + 4, 2);
        };
        // Whether the item is in view whole, left of the clock.
        const inView = ({ joined, clock }) => joined?.x >= 2 && joined.x + joined.width + 4 <= clock?.x;
        // The local seat's context press on the item, and the press on the one entry its menu offers.
        const locally = async (wanted, shot = null) => {
            await (
                await barPage()
            )?.evaluate(`(() => {
                const item = document.querySelector('.status-bar-item[data-item="status-item"]');
                const { x, y } = item.getBoundingClientRect();
                const at = { clientX: x + 4, clientY: y + 4 };
                item.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, ...at }));
            })()`);
            const menu = await until(overlay, 4000);
            const offered = await until(async () => {
                const rows = await menu?.evaluate(
                    `[...document.querySelectorAll('${ENTRY}')].map((row) => row.textContent)`
                );
                return rows?.length && rows;
            }, 4000);
            if (offered && shot) {
                const { x, width } = (await capsuleNow()).bar;
                await desktopShot(shot, { crop: { x: x - 60, y: 0, width: width + 68, height: 84 } });
            }
            if (offered) await menu.press(ENTRY);
            return { offered, now: await stands(wanted) };
        };
        const kept = await locally(fixedWhole, 'status-bar-menu');
        const turnedOn = seatA.as('scroll', over, '27,0');
        await sleep(600);
        const still = await capsuleNow();
        check(
            "outside: the local seat's context press on an item offers Keep in Bar, which stands it whole in the " +
                'fixed region left of the clock, where a turn of the wheel does not move it',
            same(kept.offered, ['Keep in Bar']) &&
                fixedWhole(kept.now) &&
                kept.now.joined.x < kept.now.clock.x &&
                fixedWhole(still) &&
                same(still.joined, kept.now.joined),
            JSON.stringify({ kept, turnedOn, still })
        );
        // The frame's mod runs again, the joining mod's band put away meanwhile so the bar opens first again: the list
        // is the frame's record, so the item that joins again is fixed as it comes.
        await send('test-band', null);
        await (await frame())?.evaluate('location.reload()');
        const gone = await until(async () => !(await capsuleNow()).joined, 4000);
        await stands(({ joined }) => !!joined, 10000);
        await send('test-item', { name: 'Star', icon: 'star', command: 'show', count: 120 });
        await send('test-band', band);
        const survived = await stands((now) => fixedWhole(now) && now.bar.x === kept.now.bar?.x, 8000);
        check(
            "outside: the item is fixed still once the status bar's mod ran again",
            fixedWhole(survived) && survived.bar.x === kept.now.bar?.x,
            JSON.stringify({ gone: !!gone, kept: kept.now, survived })
        );
        const freed = await locally(scrolls);
        const rest = restOf(freed.now);
        await turn('0,-500', rest);
        const scrolled = await turn('27,0', rest - 27);
        const back = await turn('0,-500', rest);
        check(
            "outside: Don't Keep in Bar on the fixed item lets it scroll with the others again",
            same(freed.offered, ["Don't Keep in Bar"]) &&
                scrolls(freed.now) &&
                inView(freed.now) &&
                scrolled.now.joined?.x === rest - 27 &&
                back.now.joined?.x === rest,
            JSON.stringify({ rest, scrolled: scrolled.now.joined, back: back.now.joined, freed })
        );
        // A seat at the surface: what it reads of the bar names the item, button 2 on it opens the menu it reads next,
        // and its press on the entry does what the entry says.
        const refIn = (text, role, name) =>
            new RegExp(`^ *${role} "${name}[^"]*"(?: \\[[^\\]]*\\])? (\\d+\\.\\d+)`, 'm').exec(text)?.[1] ?? null;
        const panelNow = () => /^panel (w\d+) .* status-bar top at /m.exec(seatA.as('read', 'desktop'))?.[1] ?? null;
        const bySeat = async (label, wanted) => {
            const panel = panelNow();
            const item = panel && refIn(seatA.as('read', 'window', panel), 'button', 'Star');
            const pressed = item ? seatA.as('press', item, '--button', '2') : '';
            let read = '';
            const entry = await until(() => {
                read = [seatA.as('read', 'desktop'), panel ? seatA.as('read', 'window', panel) : ''].join('\n');
                return refIn(read, 'menuitem', label);
            }, 4000);
            const taken = entry ? seatA.as('press', entry) : '';
            const now = await stands(wanted);
            const asRead = panelNow();
            return { panel, item, pressed, entry, taken, now, read: entry ? '' : read, asRead };
        };
        const seatKept = await bySeat('Keep in Bar', fixedWhole);
        const seatReadsKept = seatKept.asRead ? seatA.as('read', 'window', seatKept.asRead) : '';
        const seatFreed = await bySeat("Don't Keep in Bar", scrolls);
        const seatReadsFreed = seatFreed.asRead ? seatA.as('read', 'window', seatFreed.asRead) : '';
        check(
            'outside: a seat fixes the item by button 2 on it as it reads it and the entry Keep in Bar as it reads ' +
                "that, and lets it scroll again by Don't Keep in Bar: the bar the local seat sees has it so, and the " +
                'seat reads it after the clock while it is fixed and before it once it is not',
            !!seatKept.entry &&
                fixedWhole(seatKept.now) &&
                /button "Clock"[^\n]*\n +button "Star/.test(seatReadsKept) &&
                !!seatFreed.entry &&
                scrolls(seatFreed.now) &&
                inView(seatFreed.now) &&
                /button "Star[^\n]*\n(?: +button "[^\n]*\n)* +button "Clock"/.test(seatReadsFreed),
            JSON.stringify({ seatKept, seatReadsKept, seatFreed, seatReadsFreed })
        );
    }

    // A view under an anchor is a seat's own: the mod that tells anchors opens a band, and a seat's press on it shows
    // the mod's view for that seat alone, which reads it as a panel window and presses in it. A second seat's press on
    // its anchor toggles it for that seat alone: shown for it too, its keyboard stays the first seat's; a press outside
    // it puts it away for the seat that pressed, the second seat's next toggle for the second, and the one after shows
    // it for the second again and not for the first, which put it away.
    // The Seats mod's item and its view, with two seats beside the local one: the item and its count, the view the
    // local seat's press on the item shows, a user that asks as a row there, an attached seat's press on Allow as it
    // reads it, and a seat followed by a press on its row, which an attached seat's press on that row ends.
    async function seatsChecks({ seatA, seatB }) {
        const { item, shown, rows, pressIn } = seatsView;
        const ASKER = 'outside-asker';
        const desk = ((await desktopLaid())?.pages ?? []).find(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''));
        const followingNow = () =>
            inPage(desk?.id, `document.querySelector('.deckit-following:not([hidden]) span')?.textContent ?? ''`);
        const refIn = (text, name) =>
            new RegExp(`^ *button "${name}"(?: \\[[^\\]]*\\])? (\\d+\\.\\d+)`, 'm').exec(text)?.[1] ?? null;
        // The view as `seat` reads it, shown by its press on the item as it reads that where it is not on its screen.
        const readBy = (seat) => {
            const desktop = seat.as('read', 'desktop');
            const view = /^panel (w\d+) .* seats at /m.exec(desktop)?.[1];
            if (view) return seat.as('read', 'window', view);
            const band = /^panel (w\d+) .* status-bar top at /m.exec(desktop)?.[1];
            const ref = band && refIn(seat.as('read', 'window', band), 'Seats[^"]*');
            if (ref) seat.as('press', ref);
            return '';
        };
        const stood = await until(async () => {
            const now = await item();
            return now && /2/.test(now.name) && now;
        }, 6000);
        await desktopShot('seats-item');
        check(
            'outside: while seats sit beside the first the status bar has the Seats item, with their count',
            /^Seats\b/.test(stood?.name ?? '') && /2/.test(stood.text),
            JSON.stringify(stood || (await item()))
        );
        const view = await shown();
        const sat = await rows();
        check(
            "outside: the local seat's press on the item shows the view under it, a row for every seat in the order " +
                'they sat, each in a colour of its own with its name',
            view &&
                view.rect.y > (stood?.y ?? Infinity) &&
                same(
                    sat.seats.slice(1).map(({ name, says, idle, following }) => [name, says, idle, following]),
                    [
                        ['First', '', false, false],
                        ['Second', '', false, false],
                    ]
                ) &&
                new Set(sat.seats.map(({ colour }) => colour)).size === 3 &&
                sat.seats.every(({ colour }) => /^var\(--deckit-seat-\w+\)$/.test(colour)),
            JSON.stringify({ view, sat })
        );
        const asker = await connect(socket);
        const sitting = asker
            .authenticate({ principal: ASKER, ...userWithKey(ASKER, 'Asker') })
            .catch((error) => error);
        const asked = await until(async () => {
            const [now, wants] = [await rows(), await item()];
            return now.asks.includes('Asker') && /attention/.test(wants?.name ?? '') && { now, wants };
        }, 8000);
        await desktopShot('seats-ask');
        check(
            'outside: with asking on a user that asks to sit is a row of the view, and the item asks for attention',
            !!asked,
            JSON.stringify(asked || { now: await rows(), wants: await item() })
        );
        let read = '';
        const allow = await until(() => {
            read = readBy(seatA);
            return refIn(read, 'Allow Asker');
        }, 8000);
        const pressed = allow ? seatA.as('press', allow) : '';
        const admitted = await Promise.race([sitting, sleep(8000)]);
        const greeted = await until(async () => /Asker/.test((await item())?.text ?? ''), 3000);
        check(
            'outside: an attached seat reads the view, its rows buttons by name, and its press on Allow seats the ' +
                'user that asks, whose name the item says as it sits',
            !!refIn(read, 'Deny Asker') &&
                !!refIn(read, 'First') &&
                !!refIn(read, 'Second') &&
                admitted?.seat?.user.id === ASKER &&
                greeted,
            JSON.stringify({ read, pressed, admitted: admitted?.message ?? admitted, item: await item() })
        );
        if (admitted?.seat) {
            await asker.request('runner/started', started);
            await asker.request('runner/quit', {});
        } else asker.close();
        const left = await until(async () => (await rows()).seats.length === 3, 5000);
        const pressedRow = await pressIn(await shown(), '.seats-seat[aria-label^="First"]');
        const followed = await until(async () => (await followingNow()) === 'Following First', 4000);
        await desktopShot('seats-followed');
        let byB = '';
        const marked = await until(() => {
            byB = readBy(seatB);
            return refIn(byB, 'First, following');
        }, 8000);
        const ending = marked ? seatB.as('press', marked) : '';
        const ended = await until(async () => (await followingNow()) === '', 4000);
        check(
            "outside: a press on a seat's row follows that seat, the row says so to every seat, and a press on it " +
                'again ends it',
            left && pressedRow && followed && marked && ended,
            JSON.stringify({ left, pressedRow, followed, byB, ending, following: await followingNow() })
        );
    }

    async function viewChecks({ seatA, seatB }) {
        const mod = await anchors();
        const mark = (name) => mod?.evaluate(`document.documentElement.dataset.${name} ?? ''`);
        // The mod marks the anchor it told as it attaches: it hears the test from then on.
        await until(async () => !!(await mark('anchor')), 8000);
        await mod?.evaluate(`document.dispatchEvent(new CustomEvent('test-seat'))`);
        // What the host window lays of the mod's windows over the desktop's page, by the text of each: the local
        // seat's screen. A view on another seat's screen alone lies under the backdrop and is left out.
        const laidOfMod = async () => {
            const found = {};
            const pages = (await desktopLaid())?.pages ?? [];
            const over = pages.findIndex(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''));
            for (const { id, opener, name, rect } of pages.slice(over + 1)) {
                if (!opener?.startsWith('deckit://anchor-user.mod') || !/^deckit-window-/.test(name)) continue;
                found[await inPage(id, 'document.body.textContent')] = rect;
            }
            return found;
        };
        // The mod's view as a seat reads it on the desktop, `{ id, x, y, key }`, or null where it reads none.
        const readBy = (seat) => {
            const line = /^panel (w\d+) .* anchor-user at (\d+),(\d+) 320x200(?: \[key (\w+)\])?$/m.exec(
                seat.as('read', 'desktop')
            );
            return line && { id: line[1], x: Number(line[2]), y: Number(line[3]), key: line[4] ?? null };
        };
        // The band alone, once it rests where the windows the mod closed left it.
        const band = await until(async () => {
            const [once, open] = [await laidOfMod(), await mark('seat')];
            const again = await laidOfMod();
            return open === 'open' && !again.View && once.Band && same(once.Band, again.Band) && again.Band;
        }, 8000);
        if (!band) return check('outside: the mod that tells anchors opens its band', false, await mark('seat'));
        const onAnchor = `${Math.round(band.x + 96)},${Math.round(band.y + 14)}`;
        seatA.as('press', onAnchor);
        const mine = await until(() => readBy(seatA), 6000);
        const inView = mine && `${mine.x + 160},${mine.y + 100}`;
        const outside = mine && `${mine.x - 60},${mine.y + 320}`;
        const alone = { mine, other: readBy(seatB), local: Object.keys(await laidOfMod()), told: await mark('mine') };
        check(
            "outside: a view its mod shows at a seat's press is on that seat's screen alone, its keyboard that seat's",
            mine &&
                mine.key === seatA.seat &&
                alone.other === null &&
                same(alone.local, ['Band']) &&
                alone.told === 'didAppear,',
            JSON.stringify(alone)
        );
        const asWindow = mine ? seatA.as('read', 'window', mine.id) : '';
        const foreign = mine ? seatB.as('read', 'window', mine.id) : '';
        const pressed = mine ? seatA.as('press', inView) : '';
        const took = await until(async () => (await mark('pressed')) === '1', 4000);
        check(
            'outside: the seat reads the view as a window and presses in it, and a seat it is not shown for reads none',
            / content 320x200$/m.test(asWindow) &&
                /no window/.test(foreign) &&
                pressed === `over ${mine?.id.slice(1)}, key` &&
                took,
            JSON.stringify({ asWindow, foreign, pressed, marked: await mark('pressed') })
        );
        seatB.as('press', onAnchor);
        const second = await until(() => readBy(seatB), 6000);
        const typed = second ? seatB.as('type', 'x') : '';
        check(
            "outside: toggled by a second seat it is shown for that seat too and stays on the first seat's screen, " +
                "its keyboard the first seat's, and the second's key is refused",
            second && second.key === seatA.seat && readBy(seatA) && /HELD|holds the keyboard/.test(typed),
            JSON.stringify({ second, first: readBy(seatA), typed })
        );
        if (outside) seatA.as('press', outside);
        const away = await until(() => !readBy(seatA) && readBy(seatB), 6000);
        check(
            'outside: a press outside a view puts it away for the seat that pressed alone',
            away && (await mark('mine')) === 'didAppear,' && !Object.keys(await laidOfMod()).includes('Mine'),
            JSON.stringify({ first: readBy(seatA), second: readBy(seatB), told: await mark('mine') })
        );
        seatB.as('press', onAnchor);
        const gone = await until(
            async () => !readBy(seatB) && (await mark('mine')) === 'didAppear,didDisappear,',
            6000
        );
        check(
            'outside: a press on its anchor, which toggles the view, puts it away for the last seat, and it is told',
            gone,
            JSON.stringify({ first: readBy(seatA), second: readBy(seatB), told: await mark('mine') })
        );
        seatB.as('press', onAnchor);
        const again = await until(() => readBy(seatB), 6000);
        const apart = { first: readBy(seatA), second: again, told: await mark('mine') };
        check(
            "outside: a seat that put the view away does not get it by another seat's toggle",
            again && again.key === seatB.seat && apart.first === null && apart.told.endsWith('didDisappear,didAppear,'),
            JSON.stringify(apart)
        );
        await mod?.evaluate(`document.dispatchEvent(new CustomEvent('test-close'))`);
    }

    const listed = deckit('list', principal);
    check('outside: a key registered is listed', listed === `ed25519 ${key.publicKey} test\n`, listed);
    deckit('remove', principal, key.publicKey);
    const late = await connect(socket);
    const revoked = await refusedWith(late.authenticate({ principal, ...key }));
    check(
        'outside: a key removed as the app runs is refused from then on',
        same(revoked, nothing) && deckit('list', principal) === '',
        JSON.stringify(revoked)
    );

    const { refusal, after } = await unanswered;
    const asking = await until(async () => same(await asksNow(), []), 3000);
    check(
        'outside: an ask nobody answers is answered no once its time has passed, and its row goes',
        refusal?.kind === 'REFUSED' && after >= ASK_TIME && after < ASK_TIME + 5000 && waitsTold === 1 && asking,
        JSON.stringify({ refusal, after, asks: await asksNow() })
    );
}

module.exports = { run };
