// A party's end of a transport connection into the app: JSON-RPC 2.0, a message a line, over the local socket in
// deckit's folder. It proves which principal it is by signing the host's challenge with an Ed25519 key (RFC 8032) and
// is from then on a run of that principal's job.
const crypto = require('crypto');
const net = require('net');
const SOCKET = require('./socket.js');

const LABEL = 'deckit-authenticate-1';

// A new key pair: `publicKey` as it is registered, base64 of its 32 bytes, and `privateKey`, which signs.
function makeKey() {
    return pairOf(crypto.generateKeyPairSync('ed25519').privateKey);
}

// The key pair of a private key written as PEM, as a person keeps it in a file.
function readKey(pem) {
    return pairOf(crypto.createPrivateKey(pem));
}

function pairOf(privateKey) {
    const { x } = crypto.createPublicKey(privateKey).export({ format: 'jwk' });
    return { publicKey: Buffer.from(x, 'base64url').toString('base64'), privateKey };
}

// The transport connection to the socket named `file` (socket.js), once it is open: `request(method, params)` resolves
// with the result or rejects with the error, its `code`, `kind` and `stage` on it; `notify(method, params)` asks for no
// answer; `on(method, handler(params))` hears what the host tells, and answers what it asks; `authenticate({
// principal, publicKey, privateKey })` proves the principal and resolves with what the host answers; `close()` closes
// it, and `closed` settles once it is closed, by either end.
function connect(file) {
    return new Promise((resolve, reject) => {
        const socket = net.createConnection(SOCKET.placeOf(file));
        const pending = new Map();
        const handlers = new Map();
        let sequence = 0;
        let rest = '';
        const closed = new Promise((done) => socket.once('close', done));
        const send = (message) => socket.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
        const request = (method, params) =>
            new Promise((answered, refused) => {
                pending.set(++sequence, { answered, refused });
                send({ id: sequence, method, params });
            });
        const receive = async ({ id = null, method, params, result = null, error = null }) => {
            if (method === undefined) {
                const asked = pending.get(id);
                pending.delete(id);
                if (error) asked?.refused(Object.assign(new Error(error.message), { code: error.code, ...error.data }));
                else asked?.answered(result);
                return;
            }
            const answer = await handlers.get(method)?.(params);
            if (id !== null) send({ id, result: answer ?? null });
        };
        const authenticate = async ({ principal, publicKey, privateKey }) => {
            const nonce = crypto.randomBytes(32);
            const { challenge } = await request('initialize', { protocol: 1, nonce: nonce.toString('base64') });
            const signed = Buffer.concat([
                Buffer.from(LABEL),
                Buffer.from([0]),
                Buffer.from(principal),
                Buffer.from([0]),
                Buffer.from(challenge, 'base64'),
                nonce,
            ]);
            const signature = crypto.sign(null, signed, privateKey).toString('base64');
            return request('authenticate', { principal, scheme: 'ed25519', key: publicKey, signature });
        };
        socket.setEncoding('utf8');
        socket.on('data', (chunk) => {
            const lines = (rest + chunk).split('\n');
            rest = lines.pop();
            for (const line of lines) if (line) receive(JSON.parse(line));
        });
        socket.once('error', reject);
        socket.once('close', () => {
            for (const { refused } of pending.values()) refused(Object.assign(new Error('closed'), { kind: 'CLOSED' }));
            pending.clear();
        });
        socket.once('connect', () =>
            resolve({
                request,
                notify: (method, params) => send({ method, params }),
                on: (method, handler) => handlers.set(method, handler),
                authenticate,
                close: () => socket.destroy(),
                closed,
            })
        );
    });
}

module.exports = { makeKey, readKey, connect };
