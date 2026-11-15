// MARK: - Property
// The longest path a local socket is bound at, in bytes: the system refuses a longer one.
const LIMIT = 103;

// MARK: - Initializer
// MARK: - Public
// A local stream socket named `path`, a message a line each way, which only the account that runs the app can open: a
// file left there by a run that did not end well is removed first, and the file goes as its process ends. Where `path`
// is longer than a socket's may be, the socket is bound at a short path in the system's temporary folder and `path` is
// a link to it, there while it listens: whoever connects follows the link. Each transport connection that arrives is
// handed to `opened({ send(line), close(), limit(bytes) })`, which answers `{ onMessage(line), onEnd() }`: a line
// longer than its limit, `limit` at first, closes it unheard, and `onEnd` hears once that it closed. `failed(why)`
// hears that nothing listens. Answers `{ close() }`.
function listen({ path, limit }, { opened, failed }) {
    const fs = require('fs');
    const net = require('net');
    const sockets = new Set();
    const server = net.createServer((socket) => {
        let rest = '';
        let bound = limit;
        let ended = false;
        sockets.add(socket);
        socket.setEncoding('utf8');
        const listeners = opened({
            send: (line) => {
                if (!ended) socket.write(line + '\n');
            },
            close: () => socket.destroy(),
            limit: (bytes) => {
                bound = bytes;
            },
        });
        socket.on('data', (chunk) => {
            const lines = (rest + chunk).split('\n');
            rest = lines.pop();
            for (const line of lines) {
                if (ended) return;
                if (Buffer.byteLength(line) > bound) return socket.destroy();
                if (line) listeners.onMessage(line);
            }
            if (Buffer.byteLength(rest) > bound) socket.destroy();
        });
        socket.on('error', () => {});
        socket.on('close', () => {
            ended = true;
            sockets.delete(socket);
            listeners.onEnd();
        });
    });
    const place = placeOf(path);
    const close = () => {
        server.close();
        for (const socket of sockets) socket.destroy();
        remove(path);
        remove(place);
    };
    const fail = (error) => {
        close();
        failed(error.message);
    };
    server.on('error', fail);
    try {
        if (Buffer.byteLength(place) > LIMIT) throw new Error(tooLong(place));
        remove(path);
        remove(place);
        // The file is made for its owner alone, never open to another account for a moment.
        const mask = process.umask(0o177);
        try {
            server.listen(place);
        } finally {
            process.umask(mask);
        }
        if (place !== path) fs.symlinkSync(place, path);
    } catch (error) {
        fail(error);
    }
    process.once('exit', close);
    return { close };
}

// MARK: - Private
// Where the socket named `name` is bound: at `name`, or where that is too long for one, at a name made of it in the
// system's temporary folder.
function placeOf(name) {
    if (Buffer.byteLength(name) <= LIMIT) return name;
    const hash = require('crypto').createHash('sha256').update(name).digest('hex').slice(0, 16);
    return require('path').join(require('os').tmpdir(), `deckit-${hash}.sock`);
}

// `file` is taken away, a link to nothing as any file: what stays in the way is told by what is put there next.
function remove(file) {
    try {
        require('fs').unlinkSync(file);
    } catch {}
}

function tooLong(place) {
    return `${place} is ${Buffer.byteLength(place)} bytes long, and a local socket's path holds at most ${LIMIT}`;
}

export { listen };
