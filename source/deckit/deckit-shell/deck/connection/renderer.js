import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as WIRE from './model/wire.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The page's ends of its connections. For each it keeps a table of the functions it handed over, by number, and the
// references it was handed, by number, and drops both as the connection ends. A reference is a function that calls the
// other end and resolves with what that answers; one the page holds no more is let go on the other end. A function the
// page was handed is never handed on: what calls the far end is always the mod connected to it. `RUN` is the page's run.
export function createConnection({ RUN }) {
    // MARK: - Property
    // Connection id -> { id, mod, lifecycle, dependent, lasting, given, held, connection, exports, cleanups, ended }:
    // `lifecycle` is the page's own, `dependent` whether the page is the end that depends on `mod`, `lasting` whether
    // its exports are the lifecycle's for as long as it lasts, as `dependencies.<id>`; `given` its numbers by function,
    // and by number each function with how many times it was handed over; `held` its references by number, each with
    // how many times it was handed in; `connection` what the exports' `connect` was called with; `cleanups` what each
    // `onConnect` answered for it; `ended` whether the other end ended it, as opposed to the page's lifecycle.
    const connections = new Map();
    const handed = new WeakSet(); // every reference made, which is never handed on
    const released = new FinalizationRegistry(({ id, number }) => {
        const entry = connections.get(id);
        const held = entry?.held.get(number);
        if (!held || held.reference.deref()) return;
        entry.held.delete(number);
        PROTOCOL.release.send({ run: RUN.number, connection: id, number, count: held.count });
    });
    // Lifecycle -> mod id -> the listeners its `onConnect` added.
    const listening = new Map();
    const begun = new Set(); // the lifecycles begun and not left
    let giving = null; // { lifecycle, connect, disconnect }, once the lifecycle that opened the exports has joined
    let refused = () => {}; // told of a required connection its dependency refused, once its lifecycle has begun

    // MARK: - Initializer
    PROTOCOL.connect.handle((asked) => answerConnect(asked));
    PROTOCOL.connected.on((told) => opened(told));
    PROTOCOL.disconnected.on(({ id }) => ended(id));
    PROTOCOL.called.handle((asked) => answerCall(asked));
    PROTOCOL.released.on(({ connection, number, count }) => {
        const entry = connections.get(connection);
        if (entry) letGo(entry, number, count);
    });

    // MARK: - Public
    // The `lifecycle`th lifecycle begins: answers its `dependencies`, the exports each required mod opened in the
    // lowest lifecycle by its id, with `onConnect(id, connected)`, and the problems of the connections refused, each
    // `{ mod, required, problem }`. What `onConnect` adds is cut with `scope`.
    async function begin(lifecycle, scope) {
        begun.add(lifecycle);
        const answered = await PROTOCOL.begin.invoke({ run: RUN.number, lifecycle });
        const problems = [];
        const lasting = {};
        for (const told of answered) {
            if (told.problem) problems.push({ mod: told.mod, required: told.required, problem: told.problem });
            else {
                const entry = open({ ...told, lifecycle });
                if (entry.lasting) lasting[told.mod] = entry.exports;
            }
        }
        const dependencies = Object.freeze({
            ...lasting,
            onConnect: (id, connected) => listen(lifecycle, String(id), connected, scope),
        });
        return { dependencies, problems };
    }

    // `listener(lifecycle, problem)` is told of a required connection its dependency refused after its lifecycle
    // began.
    function onRefused(listener) {
        refused = listener;
    }

    // The exports opened in `lifecycle`, which answer each connection from now on: `connect(connection)` makes them,
    // `disconnect(connection)` hears the connection end while the exports are open.
    function give(lifecycle, { connect, disconnect }) {
        giving = { lifecycle, connect, disconnect };
    }

    // The mods the run listens for, each by the lowest lifecycle that does.
    function awaited() {
        const awaits = {};
        for (const [lifecycle, byMod] of listening) {
            for (const [id, listeners] of byMod) {
                if (listeners.size && !(awaits[id] <= lifecycle)) awaits[id] = lifecycle;
            }
        }
        return awaits;
    }

    // The `lifecycle`th lifecycle has ended, its end method run and what its handles made cut: its connections end
    // with no hook called, as do those of the exports it opened, and main is told.
    function leave(lifecycle) {
        for (const entry of [...connections.values()]) {
            if (entry.lifecycle === lifecycle) connections.delete(entry.id);
        }
        if (giving?.lifecycle === lifecycle) giving = null;
        listening.delete(lifecycle);
        begun.delete(lifecycle);
        PROTOCOL.end.send({ run: RUN.number, lifecycle });
    }

    // MARK: - Private
    // A connection the page depends on, its exports read: those of a required mod opened in its lowest lifecycle are
    // the lifecycle's while it lasts, and every other comes and goes, handed to what listens for its mod. `exportedIn`
    // is the lifecycle of `mod` that opened them.
    function open({ id, mod, required, lifecycle, exportedIn, exports }) {
        const entry = makeEntry({ id, mod, lifecycle, dependent: true });
        entry.lasting = required && exportedIn === 0;
        entry.exports = WIRE.materialize(exports, (number) => referenceOf(entry, number));
        connections.set(id, entry);
        if (!entry.lasting) {
            for (const listener of listening.get(lifecycle)?.get(mod) ?? []) hand(entry, listener);
        }
        return entry;
    }

    // A connection that stands since the lifecycle began, or one its dependency refused.
    function opened(told) {
        if (!begun.has(told.lifecycle)) return;
        if (!told.problem) open(told);
        else if (told.required) refused(told.lifecycle, told.problem);
        else RUN.fail(told.problem);
    }

    function listen(lifecycle, id, connected, scope) {
        if (typeof connected !== 'function') throw new Error('dependencies.onConnect() takes a mod id and a function');
        if (!listening.has(lifecycle)) listening.set(lifecycle, new Map());
        const byMod = listening.get(lifecycle);
        if (!byMod.has(id)) byMod.set(id, new Set());
        byMod.get(id).add(connected);
        for (const entry of connections.values()) {
            if (entry.dependent && !entry.lasting && entry.lifecycle === lifecycle && entry.mod === id)
                hand(entry, connected);
        }
        scope.add(() => byMod.get(id)?.delete(connected));
    }

    // The exports go to a listener, and what it answers is called as the connection ends while the listener's
    // lifecycle lasts, at once when the other end ended it while the listener ran.
    function hand(entry, listener) {
        RUN.deliver('dependencies.onConnect()', async () => {
            const cleanup = await listener(entry.exports);
            if (typeof cleanup !== 'function') return;
            if (connections.get(entry.id) === entry) entry.cleanups.push(cleanup);
            else if (entry.ended) RUN.deliver('an onConnect cleanup', cleanup);
        });
    }

    // The exports for a new connection, made by the `connect` of the lifecycle that opened them, or null once it has
    // ended.
    function answerConnect({ id, mod, lifecycle }) {
        if (!giving || giving.lifecycle !== lifecycle) return null;
        const connection = Object.freeze({ mod: Object.freeze({ id: mod.id, name: mod.name }) });
        const exports = giving.connect(connection);
        if (exports && typeof exports.then === 'function')
            throw new Error('exports.register(): connect() answers the exports, not a promise');
        const entry = makeEntry({ id, mod: mod.id, lifecycle, dependent: false });
        entry.connection = connection;
        const described = describe(entry, exports);
        connections.set(id, entry);
        return described;
    }

    // The connection has ended: the page's end hears it while its lifecycle lasts, and its tables are dropped.
    function ended(id) {
        const entry = connections.get(id);
        if (!entry) return;
        connections.delete(id);
        entry.ended = true;
        if (entry.dependent) for (const cleanup of entry.cleanups) RUN.deliver('an onConnect cleanup', cleanup);
        else if (giving?.disconnect)
            RUN.deliver('exports.register(): disconnect()', giving.disconnect, entry.connection);
    }

    async function answerCall({ connection, number, args }) {
        const entry = connections.get(connection);
        const given = entry?.given.byNumber.get(number);
        if (!given) throw new Error('that function was let go');
        try {
            const read = WIRE.materialize(args, (inner) => referenceOf(entry, inner));
            const returned = await given.function.apply(given.holder, read);
            return { returned: describe(entry, returned) };
        } catch (error) {
            return { thrown: { name: String(error?.name ?? 'Error'), message: String(error?.message ?? error) } };
        }
    }

    function makeEntry({ id, mod, lifecycle, dependent }) {
        return {
            id,
            mod,
            lifecycle,
            dependent,
            lasting: false,
            given: { numbers: new Map(), byNumber: new Map(), next: 0 },
            held: new Map(),
            connection: null,
            exports: undefined,
            cleanups: [],
            ended: false,
        };
    }

    // What crosses the connection, each function the page hands over kept by number: one function is one number, and
    // a method one number with the object it is called on. What does not cross hands none of them over.
    function describe(entry, value) {
        const counted = [];
        try {
            return WIRE.describe(value, (fn, holder) => {
                if (handed.has(fn))
                    throw new Error('a function another mod handed over is not handed on: hand a function of its own');
                const key = holder ? keyOf(entry, fn, holder) : fn;
                let number = entry.given.numbers.get(key);
                if (number === undefined) {
                    number = ++entry.given.next;
                    entry.given.numbers.set(key, number);
                    entry.given.byNumber.set(number, { function: fn, holder, key, count: 0 });
                }
                entry.given.byNumber.get(number).count += 1;
                counted.push(number);
                return number;
            });
        } catch (error) {
            for (const number of counted) letGo(entry, number, 1);
            throw error;
        }
    }

    // The other end holds `number` `count` times fewer: at none, the page lets go of its function.
    function letGo(entry, number, count) {
        const given = entry.given.byNumber.get(number);
        if (!given) return;
        given.count -= count;
        if (given.count > 0) return;
        entry.given.byNumber.delete(number);
        entry.given.numbers.delete(given.key);
    }

    // One key for a method held with one object.
    function keyOf(entry, fn, holder) {
        const methods = (entry.given.methods ??= new WeakMap());
        if (!methods.has(holder)) methods.set(holder, new Map());
        const keys = methods.get(holder);
        if (!keys.has(fn)) keys.set(fn, Symbol('method'));
        return keys.get(fn);
    }

    // The function that calls the other end's `number`: one for each number while the page holds it.
    function referenceOf(entry, number) {
        const held = entry.held.get(number);
        const kept = held?.reference.deref();
        if (kept) {
            held.count += 1;
            return kept;
        }
        const reference = async (...args) => {
            if (connections.get(entry.id) !== entry) throw new Error('the mod on the other end has ended');
            const answer = await PROTOCOL.call.invoke({
                run: RUN.number,
                connection: entry.id,
                number,
                args: describe(entry, args),
            });
            if (answer.thrown) throw Object.assign(new Error(answer.thrown.message), { name: answer.thrown.name });
            return WIRE.materialize(answer.returned, (inner) => referenceOf(entry, inner));
        };
        handed.add(reference);
        // A reference let go but not yet finalized hands its count to the one that takes its number.
        entry.held.set(number, { reference: new WeakRef(reference), count: (held?.count ?? 0) + 1 });
        released.register(reference, { id: entry.id, number });
        return reference;
    }

    return { begin, onRefused, give, awaited, leave };
}
