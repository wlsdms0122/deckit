import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as REFUSAL from '../../../deckit-sdk/deckit/request/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// The user whose devices are this machine's hardware.
const LOCAL = 'local';
// How long an admission waits for an answer, in milliseconds.
const ASK_TIME = 60000;
// What the shell may serve: `input(seat, event) -> result`, the entry, `event` of a kind of device `events` names
// with its fields and `source`; `read(seat, { of, ...query })`, an output `reads` names, asked once; and `onAsk({
// user }, { signal }) -> Promise of boolean`, whether a seated user lets `user` sit, `signal` aborted once no answer
// is waited for.
const SERVED = Object.freeze(['input', 'read', 'onAsk']);
// What the shell names beside what it serves: `events`, each kind of device by its name, `{ types, fields }`, served
// with `input`; `reads`, each output read by its name, the fields it is asked with, served with `read`; and `tells`,
// each output told by its name, `{ fields, on }`, `on` whether a seat is told it from the moment it opens.
const NAMED = Object.freeze({ events: 'input', reads: 'read', tells: null });

// Its channels as a run a transport connection hosts speaks them (outside/): `asked`, method -> the channel, and
// `told`, channel -> method.
export const OUTSIDE = Object.freeze({
    asked: {
        'seat/input': { channel: DECLARED.input },
        'seat/read': { channel: DECLARED.read },
        'seat/watch': { channel: DECLARED.watch },
    },
    told: { [DECLARED.output.channel]: 'seat/output' },
});

// The seats, as the core opens and closes them: where a user sits while a run of theirs is hosted, and the local one,
// whose devices are this machine's hardware. Main keeps each seat's clock and whose seat a sender's is, and hands what
// a seat does and reads to what the shell serves, as plain data with the seat; it handles no input and reads nothing
// itself. A seat's `source` names its set of devices, a word made as it opens that says who to no one: every event
// that enters for the seat carries it. `name` is what a person reads of the local user until one is kept.
export function createSeat({ CORE, LOG, IDENTITY, RUNNER, name }) {
    // MARK: - Property
    // a user's id -> its seat, `{ id, user: { id, name }, local, source }`, in the order they opened
    const seats = new Map();
    const clocks = new Map(); // a seat's id -> when its devices last gave input, in milliseconds
    const watching = new Map(); // a seat's id -> the names of the outputs it is told of
    const openListeners = new Set();
    const closeListeners = new Set();
    let served = Object.freeze({}); // what the shell serves so far, each of SERVED once it does
    let named = Object.freeze({ events: {}, reads: {}, tells: {} }); // what it named so far, each name once
    let local = null; // the local seat, once it opened
    let idleTime = null; // how long a seat gives no input before it is idle, in milliseconds, once it was asked here

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

    // Whether the seat's devices gave no input for the idle time: the one judgment of a seat's clock. The time is
    // the one the core started with until `settings` was answered another.
    function isIdle(seat) {
        return Date.now() - clocks.get(opened(seat).id) >= (idleTime ?? CORE.seatIdleTime());
    }

    // The seats' settings as the core keeps them, `{ idleTime, asking }`: the seconds a seat's devices give no input
    // for before the seat is idle, and whether a user that attaches waits until a seated user lets it sit. Each
    // that `change` names is set and kept first; refused for what is no value of its setting.
    async function settings(change = {}) {
        const kept = await CORE.request('seat/settings', change);
        idleTime = kept.idleTime * 1000;
        return kept;
    }

    // The entry: what a seat's devices did, handed to what the shell serves with the seat's `source`, which answers
    // what the seat can see happened. It is the seat's input whatever carried it, so its clock is stamped here and
    // nowhere else.
    async function input(seat, event) {
        const at = opened(seat);
        clocks.set(at.id, Date.now());
        return need('input')(at, { ...event, source: at.source });
    }

    // What the shell answers the entry, the outputs and the ask with from now on, and the names of NAMED: each of
    // SERVED is handed over once, together or by the part of the shell that answers it, with what it names, and each
    // name is named once. Answers `{ tell(seat, output) }`, what the shell tells a seat: `output` is `{ of, ... }` with
    // what that output tells, and reaches a seat that watches it.
    function serve({ events, reads, tells, ...answers } = {}) {
        for (const [key, answer] of Object.entries(answers)) {
            if (!SERVED.includes(key)) throw new Error(`[deckit] the seats are served no ${key}`);
            if (typeof answer !== 'function') throw new Error(`[deckit] ${key} is served as a function`);
            if (served[key]) throw new Error(`[deckit] the seats are served ${key} already`);
        }
        const naming = { events, reads, tells };
        for (const [key, names] of Object.entries(naming)) {
            const by = NAMED[key];
            if (by && !answers[by] !== (names === undefined)) throw new Error(`[deckit] ${key} is named with ${by}`);
            if (names === undefined) continue;
            if (CHANNEL.kindOf(names) !== 'object') throw new Error(`[deckit] ${key} is named as an object`);
            const again = Object.keys(names).find((name) => Object.hasOwn(named[key], name));
            if (again) throw new Error(`[deckit] ${again} is named already`);
        }
        served = Object.freeze({ ...served, ...answers });
        named = Object.freeze(
            Object.fromEntries(Object.entries(named).map(([key, was]) => [key, { ...was, ...(naming[key] ?? {}) }]))
        );
        // A seat open already is told from now on what a seat is told from the moment it opens.
        for (const [name, { on }] of Object.entries(tells ?? {}))
            if (on) for (const watched of watching.values()) watched.add(name);
        return Object.freeze({
            tell: (seat, { of, ...data } = {}) => {
                const told = Object.hasOwn(named.tells, of) ? named.tells[of].fields : null;
                if (!told) throw new Error(`[deckit] a seat is told no output ${of}`);
                const problem = CHANNEL.problemOf({ channel: `the output ${of}`, fields: told }, data);
                if (problem) throw new Error(`[deckit] ${problem}`);
                if (watching.get(seat?.id)?.has(of)) send(seat, { of, ...data });
            },
        });
    }

    // A party's proof handed to the core, which seats its user at once or, as the seats' settings have it, has it
    // ask to sit. `asking()` is told once the admission waits for that answer, which is no where nothing serves the
    // ask, none came in time, or the party left, as `whenEnds(listener)` hears. Resolves with `{ effects, seat }`
    // once the user sits; rejects with what the core refused.
    async function admit(proof, { asking, whenEnds }) {
        const effectsOf = ({ effects = [] }) => effects;
        let admitted = await RUNNER.ask('authentication/verify', proof, effectsOf);
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
        const source = crypto.randomUUID();
        const opening = Object.freeze({ ...seat, user: Object.freeze({ ...seat.user }), source });
        seats.set(opening.user.id, opening);
        clocks.set(opening.id, Date.now());
        const told = Object.entries(named.tells).filter(([, { on }]) => on);
        watching.set(opening.id, new Set(told.map(([name]) => name)));
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

    // Whether a seated user lets `user` sit, as what the shell serves answers: no once ASK_TIME has passed or the
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
                        LOG.error('the ask to sit failed', error);
                        resolve(false);
                    }
                )
                .finally(() => clearTimeout(timer));
        }).finally(() => waiting.abort());
    }

    // What main tells a seat goes to what hosts its user's run; the local seat is told nothing, the shell draws it.
    function send(seat, output) {
        const sender = seats.get(seat?.user?.id) === seat && !seat.local ? IDENTITY.pageOf(seat.user.id) : null;
        if (sender) PROTOCOL.output.send(sender, output);
    }

    // What `names` holds under `name`: refused for a name it has not.
    function rowOf(names, name, what) {
        if (!Object.hasOwn(names, name)) throw REFUSAL.refusal('call', 'INVALID_ARGUMENT', `${what} is not ${name}`);
        return names[name];
    }

    // What was sent beside a row's name is that row's `fields` and no other.
    function hold(name, fields, sent) {
        const problem = CHANNEL.problemOf({ channel: name, fields }, sent);
        if (problem) throw REFUSAL.refusal('call', 'INVALID_ARGUMENT', problem);
    }

    function listen() {
        PROTOCOL.input.handle(async ({ event, type, ...fields }, sender) => {
            const seat = seatFrom(sender);
            need('input');
            const row = rowOf(named.events, event, "what a seat's devices do");
            hold(event, row.fields, fields);
            if (!row.types.includes(type))
                throw REFUSAL.refusal('call', 'INVALID_ARGUMENT', `a ${event} event is one of ${row.types.join(', ')}`);
            return input(seat, { event, type, ...fields });
        });
        PROTOCOL.read.handle(async ({ of, ...query }, sender) => {
            const seat = seatFrom(sender);
            const answer = need('read');
            hold(of, rowOf(named.reads, of, 'what a seat reads'), query);
            return answer(seat, { of, ...query });
        });
        PROTOCOL.watch.handle(({ of, on }, sender) => {
            const seat = seatFrom(sender);
            rowOf(named.tells, of, 'what a seat is told of');
            if (on) watching.get(seat.id).add(of);
            else watching.get(seat.id).delete(of);
            return true;
        });
    }

    return { start, local: localSeat, list, onOpen, onClose, isIdle, settings, input, serve, admit };
}
