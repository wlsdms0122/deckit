// A party on a transport connection from outside, checked against the app under test through the client of the wire
// (cli/outside): a key registered for a user attaches as a run of it once the local seat let it sit, any other proof is
// refused and told nothing, a principal that runs takes no second party, and the run asks what a run asks, bounded by
// a job that grants only the seat permission: its own records and events, no connection, and what a seat does and
// reads. The users and the keys are made, listed and removed as a host does it, by `deckit user` and `deckit key`
// against the app's folder, while the app runs. The shell serves the seats: a user that asks to sit is a chip on the
// desktop's page, which the local seat answers as the machine presses, yes, no for one user and never for another:
// the app is started with asking on, and while `deckit seat asking` has it off a user sits unasked. Two users, each
// a terminal of its own, press and type in the windows of the
// desktop beside the local seat, `windowsNow()` and `desktopLaid()` reading what the local seat sees of them, and
// `idleTime` the seconds a seat is idle after, as the app was started with. With `reads`, the second user reads the
// desktop it sits at too (reading.js).
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
    answerOf,
    pressAt,
    pageAt,
    desktopShot,
    answer,
    allowed,
    reads,
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
    // The seats the desktop's page draws a chip of at its bottom right, by id.
    const desk = (await desktopLaid())?.pages.find(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''))?.id;
    const seatsNow = () =>
        inPage(desk, `[...document.querySelectorAll('.deckit-seat-chip[data-seat]')].map((node) => node.dataset.seat)`);

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
    const askedDenied = await answer(DENIED, 'deny');
    const denied = await refusing;
    check(
        "outside: a user the local seat's press on Deny denies is told it was asked, refused, and closed",
        same(askedDenied, [WAITS, DENIED]) &&
            denied?.kind === 'REFUSED' &&
            deniedTold === 1 &&
            (await settled(unwelcome.closed)),
        JSON.stringify({ askedDenied, denied, deniedTold })
    );

    const party = await connect(socket);
    let told = 0;
    party.on('attach/asking', () => told++);
    const attaching = party.authenticate({ principal, ...key });
    const askedParty = await answer(principal, 'allow');
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
        told === 1 && same(attached.seat, seat) && same(askedParty, [WAITS, principal]),
        JSON.stringify({ told, seat: attached.seat, askedParty })
    );
    const open = {
        seats: await until(async () => same(await seatsNow(), ['s1']) && seatsNow(), 3000),
        asks: await until(async () => same(await asksNow(), [WAITS]) && asksNow(), 3000),
    };
    check(
        'outside: the seat that opened has a chip on the desktop, and the ask that was answered is gone from it',
        same(open, { seats: ['s1'], asks: [WAITS] }),
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
    // The ask is put to the local seat: an attached seat's press on Allow reaches the desktop and answers nothing.
    const allowOfWaits = await answerOf(WAITS, 'allow', 1000);
    const byOther = allowOfWaits && [
        await party.request('seat/input', { ...press, ...allowOfWaits }),
        await party.request('seat/input', { ...press, ...allowOfWaits, type: 'up' }),
    ];
    await sleep(500);
    check(
        "outside: an attached seat's press on Allow answers nothing",
        byOther?.[0]?.over === 'desktop' && same(await asksNow(), [WAITS]) && !waitsAnswered,
        JSON.stringify({ allowOfWaits, byOther, asks: await asksNow(), waitsAnswered })
    );
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
    const closed = await until(async () => same(await seatsNow(), []), 3000);
    check('outside: a seat closes with its run, and its chip goes', closed, JSON.stringify(await seatsNow()));
    const again = await connect(socket);
    const next = await until(async () => (await refusedWith(again.request('record/keys', {})))?.code === -32002, 1000);
    const reattached =
        next &&
        (await allowed(
            principal,
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
        terminal,
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
            (await until(async () => !(await seatsNow()).includes(sat), 3000)),
        said
    );

    // Asking is the host's to turn off as the app runs: the next user sits at once, and no chip asks for it.
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
            !unaskedAsks.includes(terminal) &&
            (await settled(unasked.closed)) &&
            (await until(async () => !(await seatsNow()).includes(atOnce.seat.id), 3000)),
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
            id,
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
        // What the desktop's page draws of the two seats: a cursor each where its pointer last went, a ring where a
        // press began, noted as it is drawn since it fades, and its colour round the title bar of its key window.
        const pageNamed = (test) => laid.find(test)?.id;
        const desktopPage = pageNamed(({ url }) => /^deckit:\/\/desktop\//.test(url ?? ''));
        await inPage(
            desktopPage,
            `(() => {
                window.deckitRings = [];
                new MutationObserver((records) => {
                    for (const { addedNodes } of records)
                        for (const node of addedNodes)
                            if (node.className === 'deckit-seat-press') window.deckitRings.push(node.style.transform);
                }).observe(document.querySelector('.deckit-seats'), { childList: true });
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
                desktopPage,
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
        // The chips as the page draws them, each from the desktop's right and bottom edges, against where the model
        // lays them (desktop/model/seats.js CHIP): 12 from the edges, 148 by 28, 6 apart.
        const chipsDrawn = await inPage(
            desktopPage,
            `[...document.querySelectorAll('.deckit-seat-chip[data-seat]')].map((node) => {
                const { right, bottom, width, height } = node.getBoundingClientRect();
                return [
                    node.dataset.seat,
                    node.textContent,
                    node.style.getPropertyValue('--deckit-seat'),
                    node.hasAttribute('data-idle'),
                    innerWidth - right,
                    innerHeight - bottom,
                    width,
                    height,
                ].join(' ');
            })`
        );
        check(
            'outside: each attached seat has a chip at the bottom right, in its colour, with its name, not idle',
            same(chipsDrawn, [
                `${seatA.seat} First ${worn(seatA)} false 12 12 148 28`,
                `${seatB.seat} Second ${worn(seatB)} false 12 46 148 28`,
            ]),
            JSON.stringify(chipsDrawn)
        );
        // The local seat follows the first: its press on that seat's chip shows the seat's view, the window it holds
        // in front and key, until the local seat presses again, which reaches nothing.
        const viewNow = async () => {
            const standing = (await windowsNow()).filter(({ scaled }) => !scaled);
            const drawn = await inPage(
                desktopPage,
                `({
                    bar: document.querySelector('.deckit-following:not([hidden]) span')?.textContent ?? '',
                    chips: [...document.querySelectorAll('.deckit-seat-chip[data-seat]')].map((n) => n.dataset.seat),
                    cursors: [...document.querySelectorAll('.deckit-seat-cursor')].map((n) => n.dataset.seat),
                })`
            );
            return { front: standing.at(-1)?.id, key: standing.find(({ key }) => key)?.id, ...drawn };
        };
        const chipOf = (seat) =>
            inPage(
                desktopPage,
                `(() => {
                    const chip = document.querySelector('.deckit-seat-chip[data-seat="${seat}"]');
                    if (!chip) return null;
                    const { x, y, width, height } = chip.getBoundingClientRect();
                    return { x: Math.round(x + width / 2), y: Math.round(y + height / 2) };
                })()`
            );
        const ownView = await viewNow();
        await pressAt(await chipOf(seatA.seat));
        const followedView = await until(async () => {
            const now = await viewNow();
            return now.bar && now.front === windowA.id && now;
        }, 3000);
        check(
            "outside: the local seat's press on a seat's chip shows that seat's view, and a bar says whose it is",
            followedView &&
                followedView.bar === 'Following First' &&
                followedView.key === windowA.id &&
                ownView.key === localKey.id &&
                same(followedView.chips, ['local', seatB.seat]) &&
                !followedView.cursors.includes(seatA.seat),
            JSON.stringify({ ownView, followedView: followedView || (await viewNow()) })
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
        seatA.as('detach');
        seatB.as('detach');
        check('outside: both terminals detach', (await seatA.gone) === 0 && (await seatB.gone) === 0, '');
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
        'outside: an ask nobody answers is answered no once its time has passed, and its chip goes',
        refusal?.kind === 'REFUSED' && after >= ASK_TIME && after < ASK_TIME + 5000 && waitsTold === 1 && asking,
        JSON.stringify({ refusal, after, asks: await asksNow() })
    );
}

module.exports = { run };
