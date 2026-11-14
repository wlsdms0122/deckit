import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';
import { OUTSIDE as RUNNER_WIRE } from '../runner/main.js';
import { OUTSIDE as CONNECTION_WIRE } from '../connection/main.js';
import { OUTSIDE as EVENT_WIRE } from '../event/main.js';
import { OUTSIDE as RECORD_WIRE } from '../record/main.js';

// What a run asks and is told, each module's channels by their methods.
const WIRES = [RUNNER_WIRE, CONNECTION_WIRE, EVENT_WIRE, RECORD_WIRE];
const ASKED = Object.assign({}, ...WIRES.map(({ asked }) => asked));
const TOLD = Object.assign({}, ...WIRES.map(({ told }) => told));

// The transport connections that arrive from outside. Nobody made one, so whose it is, is a claim: main relays the
// claimant's proof to the core, which alone checks it against the keys authorized for the principal, and learns the
// principal only from what the core answers. From then on the transport connection hosts a run of that principal's job
// as a page hosts one, and what it sends is that run's, held to the guards a page's is held to. `transport` is the
// environment's (environment/: MAIN.transport), `path` where it listens.
export function createOutside({ CORE, LOG, RUNNER, transport: TRANSPORT, path }) {
    // MARK: - Property
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        TRANSPORT.listen(
            { path, limit: DECLARED.LIMIT.before },
            { opened: open, failed: (why) => LOG.error(`nothing listens at ${path}: ${why}`) }
        );
    }

    // MARK: - Private
    function open(connection) {
        const transport = `t${++sequence}`;
        const sender = Object.freeze({ transport });
        const ends = []; // told once, as it closed
        const asked = new Map(); // the id of what the party was asked -> { channel, id }, main's question
        let state = 'opened'; // then 'challenged', 'verifying', 'bound', and 'closed'
        let run = null; // the number of the run it hosts, once bound
        let questions = 0;
        const carried = IPC.carryOutside(sender, {
            tell,
            isGone: () => state === 'closed',
            whenEnds: (listener) => ends.push(listener),
        });
        const host = {
            sender,
            whenEnds: (listener) => ends.push(listener),
            load: () => {},
            kill: connection.close,
            close: connection.close,
        };
        return { onMessage: receive, onEnd: end };

        function receive(line) {
            let message;
            try {
                message = JSON.parse(line);
            } catch {
                return connection.close();
            }
            if (!message || typeof message !== 'object') return connection.close();
            if (typeof message.method !== 'string') return answeredBy(message);
            const { id = null, method, params = {} } = message;
            respond(id, method, params && typeof params === 'object' ? params : {}).then(
                (result) => id !== null && send({ id, result }),
                (error) => {
                    const data = error.kind ? { data: { stage: error.stage ?? 'call', kind: error.kind } } : {};
                    const code = error.code ?? DECLARED.CODE.failed;
                    if (id !== null) send({ id, error: { code, message: error.message, ...data } });
                    if (error.closes) connection.close();
                }
            );
        }

        // `initialize` first, once, then `authenticate`, then what a run asks. Whatever fails of the proof is one
        // refusal, which tells nothing of the principal, and the transport connection closes.
        async function respond(id, method, params) {
            if (state === 'opened' && method === 'initialize') {
                if (params.protocol !== DECLARED.PROTOCOL) throw refusal(`protocol ${DECLARED.PROTOCOL} is spoken`);
                const answer = await CORE.request('authentication/challenge', { transport, nonce: params.nonce });
                state = 'challenged';
                return { protocol: DECLARED.PROTOCOL, ...answer };
            }
            if (method === 'initialize') throw refusal('a transport connection is initialized once');
            if (state === 'challenged' && method === 'authenticate') return authenticate(params);
            if (state !== 'bound') throw refusal(`${method} before authenticate`, DECLARED.CODE.notInitialized);
            const declared = Object.hasOwn(ASKED, method) ? ASKED[method] : null;
            if (!declared) throw refusal(`no method ${method}`, DECLARED.CODE.methodNotFound);
            const payload = { ...params, ...(declared.adding ?? {}), ...(declared.run ? { run } : {}) };
            const message = { channel: declared.channel.channel, payload };
            if (!declared.channel.reply) return (carried.told(message), true);
            const answer = await carried.asked(message);
            if (answer.error) throw Object.assign(new Error(answer.error.message), answer.error);
            return answer.value ?? null;
        }

        async function authenticate({ principal, scheme, key, signature }) {
            state = 'verifying';
            const withdraw = RUNNER.offer(transport, host);
            try {
                const effects = await RUNNER.ask('authentication/verify', {
                    transport,
                    principal,
                    scheme,
                    key,
                    signature,
                });
                const opened = effects.find((effect) => effect.effect === 'open' && effect.transport === transport);
                run = RUNNER.runOf(opened.mod).number;
                state = 'bound';
                connection.limit(DECLARED.LIMIT.after);
                const end = CORE.timeout().end / 1000;
                return { principal: opened.mod, run, permissions: opened.permissions, end };
            } catch (error) {
                withdraw();
                throw Object.assign(error, { closes: true });
            }
        }

        // What main tells the run it hosts, and asks it: a question is a request, answered by its response.
        function tell({ channel, id, payload }) {
            const method = TOLD[channel];
            if (id === undefined) return method && send({ method, params: payload });
            if (!method) return carried.told({ channel, id, error: { message: `${channel} is not asked outside` } });
            asked.set(++questions, { channel, id });
            send({ id: questions, method, params: payload });
        }

        function answeredBy({ id, result = null, error = null }) {
            const question = asked.get(id);
            if (!question) return;
            asked.delete(id);
            const refused = error && {
                message: String(error.message ?? ''),
                kind: error.data?.kind ?? null,
                stage: error.data?.stage ?? null,
            };
            carried.told(refused ? { ...question, error: refused } : { ...question, value: result });
        }

        function end() {
            state = 'closed';
            CORE.request('authentication/close', { transport }).catch(() => {});
            for (const listener of ends.splice(0)) listener();
        }

        function send(message) {
            connection.send(JSON.stringify({ jsonrpc: '2.0', ...message }));
        }

        function refusal(message, code = DECLARED.CODE.invalidRequest) {
            return Object.assign(new Error(message), { code });
        }
    }

    return { start };
}
