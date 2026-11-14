// A party on a transport connection from outside, checked against the app under test through the client of the wire
// (cli/outside): a key registered for a user attaches as a run of it once the local seat let it sit, any other proof is
// refused and told nothing, a principal that runs takes no second party, and the run asks what a run asks, bounded by
// a job that grants only the seat permission: its own records and events, no connection, and what a seat does and
// reads. The users and the keys are made, listed and removed as a host does it, by `deckit user` and `deckit key`
// against the app's folder, while the app runs. The app's seats are served by the test (served.js): the ask is
// answered yes, no for one user and never for another, and what a seat reads gets fixed answers, which a terminal
// attached by `deckit seat` prints. What a seat does the shell serves: two users, each a terminal of its own, press
// and type in the windows of the desktop beside the local seat, `windowsNow()` and `desktopLaid()` reading what the
// local seat sees of them, and `idleTime` the seconds a seat is idle after, as the app was started with.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');
const { makeKey, readKey, connect } = require('../outside/client.js');
const RELAY = require('../outside/relay.js');
const { until } = require('./devtools.js');
const SERVED = require('./served.js');

// How long an admission waits for the local seat's answer, in ms (deckit-shell/deckit/seat).
const ASK_TIME = 60000;

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

async function run({ check, home, logged, main, windowsNow, desktopLaid, idleTime }) {
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
    const served = (expression) => main(`const kept = globalThis.deckitTestSeats; return ${expression}`);

    // Nobody answers the ask for this user: its party waits as long as an admission waits, while the rest goes on.
    const waiting = userWithKey(SERVED.WAITS, 'Waits');
    const waits = await connect(socket);
    let waitsTold = 0;
    waits.on('attach/asking', () => waitsTold++);
    const began = Date.now();
    const unanswered = refusedWith(waits.authenticate({ principal: SERVED.WAITS, ...waiting })).then((refusal) => ({
        refusal,
        after: Date.now() - began,
    }));

    deckit('add', principal, key.publicKey, '--name', 'test');
    const keyed = await connect(socket);
    const recordless = await refusedWith(keyed.authenticate({ principal, ...key }));
    cli('user', 'add', principal, '--name', 'Outside Party');
    const users = cli('user', 'list');
    check(
        'outside: the users are listed, the local one among them',
        users === `local Deckit\n${principal} Outside Party\n${SERVED.WAITS} Waits\n`,
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

    const pending = await refusedWith(waits.request('seat/read', { level: 'desktop' }));
    check(
        'outside: a party whose admission waits sits at no seat, and what it asks of one is refused',
        pending?.code === -32002 && waitsTold === 1,
        JSON.stringify({ pending, waitsTold })
    );
    const denying = userWithKey(SERVED.DENIED, 'Denied');
    const unwelcome = await connect(socket);
    let deniedTold = 0;
    unwelcome.on('attach/asking', () => deniedTold++);
    const denied = await refusedWith(unwelcome.authenticate({ principal: SERVED.DENIED, ...denying }));
    check(
        'outside: a user the local seat denies is told it was asked, refused, and closed',
        denied?.kind === 'REFUSED' && deniedTold === 1 && (await settled(unwelcome.closed)),
        JSON.stringify({ denied, deniedTold })
    );

    const party = await connect(socket);
    let told = 0;
    party.on('attach/asking', () => told++);
    const attached = await party.authenticate({ principal, ...key });
    check(
        'outside: a registered key of a user attaches as a run of it, granted the seat permission only',
        attached.principal === principal &&
            attached.run === 1 &&
            same(attached.permissions, ['deckit.seat']) &&
            attached.end > 0,
        JSON.stringify(attached)
    );
    const seat = { id: 's1', local: false, user: { id: principal, name: 'Outside Party' } };
    const open = await served(
        `({ asked: kept.asked, opened: kept.opened, list: kept.seats.list(), local: kept.seats.local,
            idle: kept.seats.isIdle(kept.seats.local) })`
    );
    check(
        'outside: a user the local seat allows is told it was asked, then sits at a seat that opened',
        told === 1 && same(attached.seat, seat) && same(open.asked, [SERVED.WAITS, SERVED.DENIED, principal]),
        JSON.stringify({ told, seat: attached.seat, asked: open.asked })
    );
    check(
        'outside: the shell is told of the seat, beside the local seat, which is not idle',
        same(open.opened, ['local', 's1']) &&
            same(open.list, [open.local, seat]) &&
            same(open.local, { id: 'local', local: true, user: { id: 'local', name: 'Deckit' } }) &&
            open.idle === false,
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
    const press = { type: 'down', x: 40, y: 30, button: 0, count: 1 };
    const pressed = await party.request('seat/pointer', press);
    const typed = await party.request('seat/text', { type: 'insert', text: 'seen' });
    check(
        'outside: what a seat does enters the shell, which answers what its pointer reached and where its text went',
        pressed && 'over' in pressed && typed && 'to' in typed,
        JSON.stringify({ pressed, typed })
    );
    const reading = await party.request('seat/read', { level: 'desktop' });
    const unserved = await refusedWith(party.request('seat/capture', {}));
    const malformed = await refusedWith(party.request('seat/pointer', { type: 'down' }));
    check(
        'outside: a reading is answered by what is served, and what nothing serves or is malformed is refused',
        same(reading, { text: SERVED.lineOf(seat), mark: 1 }) && unserved?.kind === 'REFUSED' && !!malformed,
        JSON.stringify({ reading, unserved, malformed })
    );
    const changed = [];
    party.on('seat/changed', (change) => changed.push(change));
    await served(`kept.tells.changed(kept.seats.list()[1], { mark: 2 })`);
    const watching = await party.request('seat/watch', { on: true });
    await served(`kept.tells.changed(kept.seats.list()[1], { mark: 3 })`);
    check(
        'outside: a seat that watches is told the desktop changed',
        watching === true && (await until(() => changed.length > 0, 3000)) && same(changed, [{ mark: 3 }]),
        JSON.stringify(changed)
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
    const closed = await until(async () => same(await served('kept.closed'), ['s1']), 3000);
    check('outside: a seat closes with its run', closed, JSON.stringify(await served('kept.closed')));
    const again = await connect(socket);
    const next = await until(async () => (await refusedWith(again.request('record/keys', {})))?.code === -32002, 1000);
    const reattached = next && (await again.authenticate({ principal, ...key }).catch((error) => error));
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
    const { file } = userWithKey(terminal, 'Terminal');
    const sitting = spawn(command, ['seat', 'attach', terminal, '--key', file, '--home', home]);
    let said = '';
    let refused = '';
    sitting.stdout.on('data', (chunk) => (said += chunk));
    sitting.stderr.on('data', (chunk) => (refused += chunk));
    const exited = new Promise((resolve) => sitting.once('exit', resolve));
    const sat = await until(() => /^attached as tty, seat (s\d+)$/m.exec(said)?.[1], 10000);
    const relay = path.join(home, 'seats', `${terminal}.sock`);
    check(
        'outside: deckit seat attach says it asks, then sits, and only its owner opens its relay',
        sat && said.startsWith('asking the local seat ...\n') && (fs.statSync(relay).mode & 0o777) === 0o600,
        said + refused
    );
    const line = SERVED.lineOf({ id: sat, user: { name: 'Terminal' } });
    const printed = sat && [cli('seat', 'read', 'desktop'), cli('seat', 'press', '10,20'), cli('seat', 'changes')];
    check(
        'outside: deckit seat read desktop prints the line that is served, and a press what it reached',
        printed && same([printed[0], printed[2]], [`${line}\n`, 'changes 1 to 2\n']) && /^over \S+/.test(printed[1]),
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
            (await until(async () => (await served('kept.closed')).includes(sat), 3000)),
        said
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
        const seat = await until(() => new RegExp(`^attached as ${id}, seat (s\\d+)$`, 'm').exec(told)?.[1], 10000);
        const as = (...args) => {
            try {
                return cli('seat', ...args, '--as', id).trim();
            } catch (error) {
                return String(error.stderr).trim();
            }
        };
        return { seat, as, gone: new Promise((resolve) => sits.once('exit', resolve)) };
    };
    const inPage = async (id, script) => {
        const told = await main(`return webkit.evaluate(${id}, ${JSON.stringify(`return ${script}`)}, 'page')`);
        try {
            return JSON.parse(told);
        } catch {
            return told;
        }
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
        hears.on('seat/held', (told) => heard.push(told));
        await new Promise((resolve) => setTimeout(resolve, idleTime * 1000 + 500));
        const taken = seatB.as('press', at(windowA));
        const told = await until(() => heard[0], 3000);
        const typedTaken = seatB.as('type', '?');
        const afterTaken = await until(async () => (await valueOf(windowA.content)) === 'alpha!?', 3000);
        hears.close();
        check(
            "outside: an idle holder's window is taken by the seat that presses it, and the holder is told seat/held",
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
    const withdrawn = await served('kept.withdrawn');
    check(
        'outside: an ask nobody answers is answered no once its time has passed, and is over',
        refusal?.kind === 'REFUSED' &&
            after >= ASK_TIME &&
            after < ASK_TIME + 5000 &&
            waitsTold === 1 &&
            withdrawn.includes(SERVED.WAITS),
        JSON.stringify({ refusal, after, withdrawn })
    );
}

module.exports = { run };
