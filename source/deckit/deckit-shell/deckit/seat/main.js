import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as REFUSAL from '../../../deckit-sdk/deckit/request/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// The user whose devices are this machine's hardware.
const LOCAL = 'local';
// How long an admission waits for the local seat's answer, in milliseconds.
const ASK_TIME = 60000;
// What the shell may serve: `input(seat, event) -> result`, the entry, `event` one of `pointer`, `key`, `text` and
// `act` under `event` beside its fields; `read(seat, query)`, `changes(seat, { since })` and `capture(seat, what)`,
// the reading; and `onAsk({ user }, { signal }) -> Promise of boolean`, whether the local seat lets `user` sit,
// `signal` aborted once no answer is waited for.
const SERVED = Object.freeze(['input', 'read', 'changes', 'capture', 'onAsk']);

// Its channels as a run a transport connection hosts speaks them (outside/): `asked`, method -> the channel, and
// `told`, channel -> method.
export const OUTSIDE = Object.freeze({
    asked: {
        'seat/pointer': { channel: DECLARED.pointer },
        'seat/key': { channel: DECLARED.key },
        'seat/text': { channel: DECLARED.text },
        'seat/act': { channel: DECLARED.act },
        'seat/read': { channel: DECLARED.read },
        'seat/changes': { channel: DECLARED.changes },
        'seat/capture': { channel: DECLARED.capture },
        'seat/watch': { channel: DECLARED.watch },
    },
    told: {
        [DECLARED.changed.channel]: 'seat/changed',
        [DECLARED.held.channel]: 'seat/held',
    },
});

// The seats, as the core opens and closes them: where a user sits while a run of theirs is hosted, and the local one,
// whose devices are this machine's hardware. Main keeps each seat's clock and whose seat a sender's is, and hands what
// a seat does and reads to what the shell serves, as plain data with the seat; it handles no input and reads nothing
// itself. `name` is what a person reads of the local user until one is kept.
export function createSeat({ CORE, LOG, IDENTITY, RUNNER, name }) {
    // MARK: - Property
    const seats = new Map(); // a user's id -> its seat, `{ id, user: { id, name }, local }`, in the order they opened
    const clocks = new Map(); // a seat's id -> when its devices last gave input, in milliseconds
    const watching = new Set(); // the ids of the seats told as the desktop changes
    const openListeners = new Set();
    const closeListeners = new Set();
    let served = Object.freeze({}); // what the shell serves so far, each of SERVED once it does
    let local = null; // the local seat, once it opened

    // MARK: - Initializer
    // MARK: - Public
    // The local user is kept from the first start on and sits at the local seat from every start on. Resolves once
    // the seat is open; a core that refuses either leaves no local seat, and what asks to sit is then refused.
    async function start() {
        listen();
        RUNNER.onOutside((run) => run.state === 'notRunning' && close(run.mod.id));
        try {
            const users = await CORE.request('user/list', {});
            if (!users.some(({ id }) => id === LOCAL)) await CORE.request('user/add', { id: LOCAL, name });
            local = open(await CORE.request('seat/open-local', { id: LOCAL }));
        } catch (error) {
            LOG.error('the local seat did not open', error);
        }
    }

    function localSeat() {
        return local;
    }

    // Every seat open, in the order they opened.
    function list() {
        return [...seats.values()];
    }

    // `listener(seat)` is told of each seat as it opens, or as it closes. Each answers its off.
    function onOpen(listener) {
        openListeners.add(listener);
        return () => openListeners.delete(listener);
    }

    function onClose(listener) {
        closeListeners.add(listener);
        return () => closeListeners.delete(listener);
    }

    // Whether the seat's devices gave no input for the idle time: the one judgment of a seat's clock.
    function isIdle(seat) {
        return Date.now() - clocks.get(opened(seat).id) >= CORE.seatIdleTime();
    }

    // The entry: what a seat's devices did, handed to what the shell serves, which answers what the seat can see
    // happened. It is the seat's input whatever carried it, so its clock is stamped here and nowhere else.
    async function input(seat, event) {
        const at = opened(seat);
        clocks.set(at.id, Date.now());
        return need('input')(at, event);
    }

    // What the shell answers the entry, the readings and the ask with from now on: each of SERVED is handed over once,
    // together or by the part of the shell that answers it. Answers what the shell tells a seat a transport
    // connection opened: `changed(seat, { mark })`, told while
    // the seat watches, and `held(seat, { window, holder })`.
    function serve(answers) {
        if (CHANNEL.kindOf(answers) !== 'object') throw new Error('[deckit] what serves the seats is an object');
        for (const [key, answer] of Object.entries(answers)) {
            if (!SERVED.includes(key)) throw new Error(`[deckit] the seats are served no ${key}`);
            if (typeof answer !== 'function') throw new Error(`[deckit] ${key} is served as a function`);
            if (served[key]) throw new Error(`[deckit] the seats are served ${key} already`);
        }
        served = Object.freeze({ ...served, ...answers });
        return Object.freeze({
            changed: (seat, { mark }) => watching.has(seat.id) && tell(seat, PROTOCOL.changed, { mark }),
            held: (seat, { window, holder }) => tell(seat, PROTOCOL.held, { window, holder }),
        });
    }

    // A party's proof handed to the core, with how long the local seat has been idle: the core seats its user at
    // once, or has the local seat asked. `asking()` is told once the admission waits for that answer, which is no
    // where nothing serves the ask, none came in time, or the party left, as `whenEnds(listener)` hears. Resolves with
    // `{ effects, seat }` once the user sits; rejects with what the core refused.
    async function admit(proof, { asking, whenEnds }) {
        const effectsOf = ({ effects = [] }) => effects;
        const idle = local ? (Date.now() - clocks.get(local.id)) / 1000 : 0;
        let admitted = await RUNNER.ask('authentication/verify', { ...proof, idle }, effectsOf);
        if (admitted.asking) {
            asking();
            const allow = await ask(admitted.asking.user, whenEnds);
            admitted = await RUNNER.ask('seat/answer', { transport: proof.transport, allow }, effectsOf);
        }
        open(admitted.seat);
        return admitted;
    }

    // MARK: - Private
    function open(seat) {
        const opening = Object.freeze({ ...seat, user: Object.freeze({ ...seat.user }) });
        seats.set(opening.user.id, opening);
        clocks.set(opening.id, Date.now());
        for (const listener of openListeners) listener(opening);
        return opening;
    }

    // A seat closes as its user's run reaches not running.
    function close(user) {
        const closing = seats.get(user);
        if (!closing || closing.local) return;
        seats.delete(user);
        clocks.delete(closing.id);
        watching.delete(closing.id);
        for (const listener of closeListeners) listener(closing);
    }

    // The seat as it is kept, for one the shell names: refused for one that is not open.
    function opened(seat) {
        const kept = seats.get(seat?.user?.id);
        if (!kept || kept.id !== seat.id) throw REFUSAL.refusal('call', 'NOT_FOUND', 'no such seat is open');
        return kept;
    }

    // The seat a sender sits at: refused for one that sits at none.
    function seatFrom(sender) {
        const seat = seats.get(IDENTITY.modFrom(sender).id);
        if (!seat) throw REFUSAL.refusal('call', 'REFUSED', 'only a user at a seat asks this');
        return seat;
    }

    function need(answer) {
        if (!served[answer]) throw REFUSAL.refusal('call', 'REFUSED', `nothing here answers a seat's ${answer}`);
        return served[answer];
    }

    // Whether the local seat lets `user` sit, as what the shell serves answers: no once ASK_TIME has passed or the
    // party left, and for an ask that throws.
    function ask(user, whenEnds) {
        if (!served.onAsk) return Promise.resolve(false);
        const waiting = new AbortController();
        return new Promise((resolve) => {
            const timer = setTimeout(resolve, ASK_TIME, false);
            whenEnds(() => resolve(false));
            Promise.resolve()
                .then(() => served.onAsk({ user }, { signal: waiting.signal }))
                .then(
                    (allow) => resolve(allow === true),
                    (error) => {
                        LOG.error('the ask of the local seat failed', error);
                        resolve(false);
                    }
                )
                .finally(() => clearTimeout(timer));
        }).finally(() => waiting.abort());
    }

    // What main tells a seat goes to what hosts its user's run; the local seat is told nothing, the shell draws it.
    function tell(seat, channel, payload) {
        const sender = seats.get(seat?.user?.id) === seat && !seat.local ? IDENTITY.pageOf(seat.user.id) : null;
        if (sender) channel.send(sender, payload);
    }

    function listen() {
        const enters = (event) => async (payload, sender) => input(seatFrom(sender), { event, ...payload });
        const reads = (answer) => async (payload, sender) => need(answer)(seatFrom(sender), payload);
        PROTOCOL.pointer.handle(enters('pointer'));
        PROTOCOL.key.handle(enters('key'));
        PROTOCOL.text.handle(enters('text'));
        PROTOCOL.act.handle(enters('act'));
        PROTOCOL.read.handle(reads('read'));
        PROTOCOL.changes.handle(reads('changes'));
        PROTOCOL.capture.handle(reads('capture'));
        PROTOCOL.watch.handle(({ on }, sender) => {
            const { id } = seatFrom(sender);
            if (on) watching.add(id);
            else watching.delete(id);
            return true;
        });
    }

    return { start, local: localSeat, list, onOpen, onClose, isIdle, input, serve, admit };
}
