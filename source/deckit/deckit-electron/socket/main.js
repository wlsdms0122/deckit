// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// A local stream socket at `path`, a message a line each way, which only the account that runs the app can open: a
// file left there by a run that did not end well is removed first, and the file goes as its process ends. Each transport
// connection that arrives is handed to `opened({ send(line), close(), limit(bytes) })`, which answers `{ onMessage(line),
// onEnd() }`: a line longer than its limit, `limit` at first, closes it unheard, and `onEnd` hears once that it closed.
// `failed(why)` hears that nothing listens. Answers `{ close() }`.
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
    const close = () => {
        server.close();
        for (const socket of sockets) socket.destroy();
        fs.rmSync(path, { force: true });
    };
    server.on('error', (error) => failed(error.message));
    fs.rmSync(path, { force: true });
    // The file is made for its owner alone, never open to another account for a moment.
    const mask = process.umask(0o177);
    try {
        server.listen(path);
    } finally {
        process.umask(mask);
    }
    process.once('exit', close);
    return { close };
}

// MARK: - Private

export { listen };
