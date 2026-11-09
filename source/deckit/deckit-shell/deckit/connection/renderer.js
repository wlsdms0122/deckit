import * as CHANNEL from '../../../deckit-sdk/deckit/channel/index.js';
import * as IPC from '../../../deckit-sdk/deckit/ipc/renderer.js';
import * as DECLARED from './protocol.js';
import * as WIRE from './model/wire.js';
import * as MOD_PERMISSION from '../../../deckit-sdk/deckit/permission/index.js';
import * as REQUEST from '../../../deckit-sdk/deckit/request/index.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
const KIND = /^[A-Z][A-Z_]*$/; // a refusal's kind

// The page's ends of its connections, each for a name, a mod id or an interface. For each it keeps a table of the
// functions it handed over, by number, and the references it was handed, by number, and drops both as the connection
// ends. A reference is a function that calls the other end and resolves with what that answers, or rejects at `call`
// with the kind the function threw, REFUSED for none or one that is not a kind, ENDED once the connection has ended or
// the function is let go, and INVALID_ARGUMENT for what it is called with that does not cross; one the page holds no
// more is let go on the other end. A function the page was handed is never handed on: what calls the far end is always
// the mod connected to it. The end that depends knows the name alone, never the mod that owns an interface. A refusal,
// of a mod the core does not launch, an owner that does not provide the major the mod uses, one that runs with no
// exports for it or a connection its service refused, reaches the code as an error with its `kind` and `stage`, and
// crosses as `{ stage, kind, message }`. `RUN` is the page's run.
export function createConnection({ RUN }) {
    // MARK: - Property
    // Connection id -> { id, name, lifecycle, dependent, given, held, exporting, connection, exports, cleanups,
    // ended }: `lifecycle` is the page's own, `dependent` whether the page is the end that depends on `name`; `given`
    // its numbers by function, and by number each function with how many times it was handed over; `held` its
    // references by number, each with how many times it was handed in; `exporting` the registration that answered it
    // and `connection` what its `connect` was called with; `cleanups` what each `onConnect` answered for it; `ended`
    // whether the other end ended it, as opposed to the page's lifecycle.
    const connections = new Map();
    const handed = new WeakSet(); // every reference made, which is never handed on
    const released = new FinalizationRegistry(({ id, number }) => {
        const entry = connections.get(id);
        const held = entry?.held.get(number);
        if (!held || held.reference.deref()) return;
        entry.held.delete(number);
        PROTOCOL.release.send({ run: RUN.number, connection: id, number, count: held.count });
    });
    // Lifecycle -> interface -> the listeners its `onConnect` added.
    const listening = new Map();
    // Lifecycle -> interface -> the listeners its `onRefuse` added.
    const refusing = new Map();
    // Lifecycle -> interface -> the error of the refusal told last, while no connection by it stands.
    const refusals = new Map();
    // Lifecycle -> mod id -> { count, asked, pending, order }: how many reaches of it are not let go, whether the core
    // holds the ask, the reaches that wait for its connection, each `{ resolve, reject }`, and what was asked of main
    // last, so what is asked after it goes after it.
    const reaching = new Map();
    const begun = new Set(); // the lifecycles begun and not left
    // Interface -> { lifecycle, connect, disconnect }, once the lifecycle that opened its exports has joined.
    const exporting = new Map();

    // MARK: - Initializer
    PROTOCOL.connect.handle((asked) => answerConnect(asked));
    PROTOCOL.connected.on((told) => opened(told));
    PROTOCOL.unreached.on(({ lifecycle, name: named, refusal }) => refuse(lifecycle, named, refusal));
    PROTOCOL.disconnected.on(({ id }) => ended(id));
    PROTOCOL.called.handle((asked) => answerCall(asked));
    PROTOCOL.released.on(({ connection, number, count }) => {
        const entry = connections.get(connection);
        if (entry) letGo(entry, number, count);
    });

    // MARK: - Public
    // The `lifecycle`th lifecycle begins: answers its `dependencies`, `onConnect(name, connected) -> off`,
    // `onRefuse(name, refused) -> off`, each refused INVALID_ARGUMENT for a name that is no string or a listener that
    // is no function, and the requests `reach(id)` and `release(id)`, `reach` refused NOT_PERMITTED for a mod not
    // granted deckit.reach-mods. What `onConnect` and `onRefuse` add is cut with `scope`. The interfaces the mod uses
    // connect as the lifecycle begins, and `onRefuse` hears each refusal of one, the last at once while no connection
    // by it stands. A mod by its id connects as `reach` asks, until as many `release`s let it go or the lifecycle ends,
    // its connection handed to what listens for its id too: `reach` resolves with its exports once it stands, and
    // rejects with the first refusal, which lets the ask go.
    async function begin(lifecycle, scope) {
        begun.add(lifecycle);
        const answered = await PROTOCOL.begin.invoke({ run: RUN.number, lifecycle });
        for (const told of answered) {
            if (told.refusal) refuse(lifecycle, told.name, told.refusal);
            else open({ ...told, lifecycle });
        }
        const { id: mod } = RUN.mod;
        const denied = RUN.granted.includes(MOD_PERMISSION.REACH_MODS)
            ? ''
            : `${mod} does not have the ${MOD_PERMISSION.REACH_MODS} permission`;
        const takes = [['id', 'string']];
        return Object.freeze({
            onConnect: (named, connected) => listen(lifecycle, named, connected, scope),
            onRefuse: (named, refused) => listenRefusals(lifecycle, named, refused, scope),
            reach: REQUEST.requestOf('dependencies.reach', { denied, signature: takes }, (id) => reach(lifecycle, id)),
            release: REQUEST.requestOf('dependencies.release', { signature: takes }, (id) => release(lifecycle, id)),
        });
    }

    // The exports of `named`, an interface, opened in `lifecycle`, which answer each connection for it from now on:
    // `connect(connection)` makes them, `disconnect(connection)` hears the connection end while the exports are open.
    function give(lifecycle, named, { connect, disconnect }) {
        exporting.set(named, { lifecycle, connect, disconnect });
    }

    // The interfaces the run listens for, each by the lowest lifecycle that does.
    function awaited() {
        const awaits = {};
        for (const [lifecycle, byInterface] of listening) {
            for (const [named, listeners] of byInterface) {
                if (listeners.size && !(awaits[named] <= lifecycle)) awaits[named] = lifecycle;
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
        for (const [named, registered] of [...exporting])
            if (registered.lifecycle === lifecycle) exporting.delete(named);
        const ended = refusalOf({ stage: 'call', kind: 'ENDED', message: 'the lifecycle that reached it has ended' });
        for (const reached of reaching.get(lifecycle)?.values() ?? [])
            for (const { reject } of reached.pending) reject(ended);
        reaching.delete(lifecycle);
        listening.delete(lifecycle);
        refusing.delete(lifecycle);
        refusals.delete(lifecycle);
        begun.delete(lifecycle);
        PROTOCOL.end.send({ run: RUN.number, lifecycle });
    }

    // MARK: - Private
    // A connection the page depends on, its exports read and handed to the reaches that wait for it and to what
    // listens for its name, as it comes and goes.
    function open({ id, name: named, lifecycle, exports }) {
        const entry = makeEntry({ id, named, lifecycle, dependent: true });
        entry.exports = WIRE.materialize(exports, (number) => referenceOf(entry, number));
        connections.set(id, entry);
        refusals.get(lifecycle)?.delete(named);
        const reached = reaching.get(lifecycle)?.get(named);
        for (const { resolve } of reached?.pending.splice(0) ?? []) resolve(entry.exports);
        for (const listener of listening.get(lifecycle)?.get(named) ?? []) hand(entry, listener);
    }

    // A connection that stands after the lifecycle began, or one its service refused.
    function opened(told) {
        if (!begun.has(told.lifecycle)) return;
        if (!told.refusal) open(told);
        else refuse(told.lifecycle, told.name, told.refusal);
    }

    // A refusal told for `named` in `lifecycle`: a mod reached by its id rejects the reaches that wait for it and the
    // ask goes, so a later reach asks again; an interface's is handed to what listens for its refusals.
    function refuse(lifecycle, named, refusal) {
        if (!begun.has(lifecycle)) return;
        const error = refusalOf(refusal);
        const reached = reaching.get(lifecycle)?.get(named);
        if (reached) {
            if (!reached.asked) return;
            reached.asked = false;
            const pending = reached.pending.splice(0);
            reached.count -= pending.length;
            ask(reached, PROTOCOL.releaseReach, lifecycle, named).catch(() => {});
            for (const { reject } of pending) reject(error);
            return;
        }
        if (!refusals.has(lifecycle)) refusals.set(lifecycle, new Map());
        refusals.get(lifecycle).set(named, error);
        for (const listener of refusing.get(lifecycle)?.get(named) ?? [])
            RUN.deliver('dependencies.onRefuse()', listener, error);
    }

    function listenRefusals(lifecycle, named, refused, scope) {
        if (typeof named !== 'string' || typeof refused !== 'function')
            throw REQUEST.refusal(
                'call',
                'INVALID_ARGUMENT',
                'dependencies.onRefuse() takes an interface and a function'
            );
        if (!refusing.has(lifecycle)) refusing.set(lifecycle, new Map());
        const byInterface = refusing.get(lifecycle);
        if (!byInterface.has(named)) byInterface.set(named, new Set());
        byInterface.get(named).add(refused);
        const last = refusals.get(lifecycle)?.get(named);
        if (last) RUN.deliver('dependencies.onRefuse()', refused, last);
        return scope.add(() => byInterface.get(named)?.delete(refused));
    }

    // One more reach of the mod `id`: resolves with the exports of its connection once it stands, at once where it
    // does, and asks the core where it does not hold the ask.
    function reach(lifecycle, id) {
        if (!begun.has(lifecycle))
            return Promise.reject(refusalOf({ stage: 'call', kind: 'ENDED', message: 'the lifecycle has ended' }));
        if (!reaching.has(lifecycle)) reaching.set(lifecycle, new Map());
        const byId = reaching.get(lifecycle);
        if (!byId.has(id)) byId.set(id, { count: 0, asked: false, pending: [], order: Promise.resolve() });
        const reached = byId.get(id);
        reached.count += 1;
        const standing = [...connections.values()].find(
            (entry) => entry.dependent && entry.lifecycle === lifecycle && entry.name === id
        );
        if (standing && reached.asked) return Promise.resolve(standing.exports);
        const connected = new Promise((resolve, reject) => reached.pending.push({ resolve, reject }));
        if (!reached.asked) {
            reached.asked = true;
            ask(reached, PROTOCOL.reach, lifecycle, id).catch((error) => {
                reached.asked = false;
                const pending = reached.pending.splice(0);
                reached.count -= pending.length;
                const refused = Object.assign(error, { stage: 'call' });
                for (const { reject } of pending) reject(refused);
            });
        }
        return connected;
    }

    // One reach of the mod `id` let go: once none is left, the core lets the ask go, and the reaches that still wait
    // reject, CANCELLED. Resolves once main took what it was asked.
    function release(lifecycle, id) {
        const reached = reaching.get(lifecycle)?.get(id);
        if (!reached?.count) return Promise.resolve();
        reached.count -= 1;
        if (reached.count || !reached.asked) return reached.order;
        reached.asked = false;
        const gone = refusalOf({ stage: 'call', kind: 'CANCELLED', message: `${id} was let go before it connected` });
        for (const { reject } of reached.pending.splice(0)) reject(gone);
        return ask(reached, PROTOCOL.releaseReach, lifecycle, id);
    }

    // `channel` asked of main for the reach of `id`, after what was asked for it before.
    function ask(reached, channel, lifecycle, id) {
        const asked = reached.order.then(() => channel.invoke({ run: RUN.number, lifecycle, target: id }));
        reached.order = asked.catch(() => {});
        return asked;
    }

    function refusalOf({ stage, kind, message }) {
        return Object.assign(new Error(message), { kind: kind ?? null, stage });
    }

    function listen(lifecycle, named, connected, scope) {
        if (typeof named !== 'string' || typeof connected !== 'function')
            throw REQUEST.refusal(
                'call',
                'INVALID_ARGUMENT',
                'dependencies.onConnect() takes an interface and a function'
            );
        if (!listening.has(lifecycle)) listening.set(lifecycle, new Map());
        const byInterface = listening.get(lifecycle);
        if (!byInterface.has(named)) byInterface.set(named, new Set());
        byInterface.get(named).add(connected);
        for (const entry of connections.values()) {
            if (entry.dependent && entry.lifecycle === lifecycle && entry.name === named) hand(entry, connected);
        }
        return scope.add(() => byInterface.get(named)?.delete(connected));
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

    // The exports for a new connection, made by the `connect` of the interface's exports, opened in `lifecycle`, or
    // null once it has ended. `mod` is the dependent's name, `credential` its mod id and permissions as the core holds
    // them.
    function answerConnect({ id, name: named, mod, lifecycle, credential }) {
        const registered = exporting.get(named);
        if (!registered || registered.lifecycle !== lifecycle) return null;
        const connection = Object.freeze({
            mod: Object.freeze({ name: mod.name }),
            credential: Object.freeze({
                mod: credential.mod,
                permissions: Object.freeze([...credential.permissions]),
            }),
        });
        const exports = registered.connect(connection);
        if (exports && typeof exports.then === 'function')
            throw new Error('exports.register(): connect() answers the exports, not a promise');
        const entry = makeEntry({ id, named, lifecycle, dependent: false });
        entry.exporting = registered;
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
        else if (entry.exporting.disconnect)
            RUN.deliver('exports.register(): disconnect()', entry.exporting.disconnect, entry.connection);
    }

    async function answerCall({ connection, number, args }) {
        const entry = connections.get(connection);
        const given = entry?.given.byNumber.get(number);
        if (!given) {
            const message = entry ? 'that function was let go' : 'the connection has ended';
            throw refusalOf({ stage: 'call', kind: 'ENDED', message });
        }
        try {
            const read = WIRE.materialize(args, (inner) => referenceOf(entry, inner));
            const returned = await given.function.apply(given.holder, read);
            return { returned: describe(entry, returned) };
        } catch (error) {
            const kind = typeof error?.kind === 'string' && KIND.test(error.kind) ? error.kind : 'REFUSED';
            return { thrown: { stage: 'call', kind, message: String(error?.message ?? error) } };
        }
    }

    function makeEntry({ id, named, lifecycle, dependent }) {
        return {
            id,
            name: named,
            lifecycle,
            dependent,
            given: { numbers: new Map(), byNumber: new Map(), next: 0 },
            held: new Map(),
            exporting: null,
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
            if (connections.get(entry.id) !== entry)
                throw refusalOf({ stage: 'call', kind: 'ENDED', message: 'the connection has ended' });
            let described;
            try {
                described = describe(entry, args);
            } catch (error) {
                throw refusalOf({ stage: 'call', kind: 'INVALID_ARGUMENT', message: error.message });
            }
            const answer = await PROTOCOL.call.invoke({
                run: RUN.number,
                connection: entry.id,
                number,
                args: described,
            });
            if (answer.thrown) throw refusalOf(answer.thrown);
            return WIRE.materialize(answer.returned, (inner) => referenceOf(entry, inner));
        };
        handed.add(reference);
        // A reference let go but not yet finalized hands its count to the one that takes its number.
        entry.held.set(number, { reference: new WeakRef(reference), count: (held?.count ?? 0) + 1 });
        released.register(reference, { id: entry.id, number });
        return reference;
    }

    return { begin, give, awaited, leave };
}
