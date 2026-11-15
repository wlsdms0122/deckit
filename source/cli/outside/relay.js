// The relay of a party that sits at a seat: a local socket in deckit's folder, `<home>/seats/<user>.sock`, which only
// its owner opens. One user is one run, so a terminal attaches once and whatever else acts for that user speaks to the
// relay, as the party speaks to the host: JSON-RPC 2.0, a message a line (client.js connects to both).
const fs = require('fs');
const net = require('net');
const path = require('path');

// What the host tells a seat, passed on to everything connected.
const TOLD = ['seat/output'];
// What ends the party's run, answered by the relay itself.
const DETACH = 'detach';

// Where the relay of `user` listens, in deckit's folder `home`.
function fileOf(home, user) {
    return path.join(home, 'seats', `${user}.sock`);
}

// The users a relay is there for, in deckit's folder `home`.
function attached(home) {
    const folder = path.join(home, 'seats');
    const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
    return files.filter((file) => file.endsWith('.sock')).map((file) => file.slice(0, -'.sock'.length));
}

// `party`, attached (client.js), is asked what arrives at `file` from now on, and each answer goes back as the host
// gave it. What changes, `seat/read` of `changes`, with no mark is asked since the last mark a reading here answered.
// `detach()` is asked once something asks to detach. Resolves with `close()`, which takes the socket away, once it
// listens.
function serve({ party, file, detach }) {
    const connections = new Set();
    let mark = null; // the mark of the last reading answered here
    const answer = async (method, params) => {
        if (method === DETACH) return (detach(), true);
        const changes = method === 'seat/read' && params.of === 'changes' && params.since === undefined;
        const since = changes && mark !== null ? { since: mark } : {};
        const result = await party.request(method, { ...params, ...since });
        if (typeof result?.mark === 'number') mark = result.mark;
        return result;
    };
    const server = net.createServer((socket) => {
        let rest = '';
        const send = (message) =>
            socket.writable && socket.write(JSON.stringify({ jsonrpc: '2.0', ...message }) + '\n');
        const entry = { send };
        connections.add(entry);
        socket.setEncoding('utf8');
        socket.on('data', (chunk) => {
            const lines = (rest + chunk).split('\n');
            rest = lines.pop();
            for (const line of lines.filter(Boolean)) {
                const { id = null, method, params = {} } = JSON.parse(line);
                answer(method, params).then(
                    (result) => send({ id, result }),
                    ({ message, code = -32803, kind = null, stage = null }) =>
                        send({ id, error: { code, message, data: { kind, stage } } })
                );
            }
        });
        socket.on('error', () => {});
        socket.on('close', () => connections.delete(entry));
    });
    for (const method of TOLD)
        party.on(method, (params) => {
            for (const { send } of connections) send({ method, params });
        });
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.rmSync(file, { force: true });
    const mask = process.umask(0o177);
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(file, () => {
            process.umask(mask);
            resolve(() => fs.rmSync(file, { force: true }));
        });
    });
}

module.exports = { DETACH, fileOf, attached, serve };
