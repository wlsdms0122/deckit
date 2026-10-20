// MARK: - Property
// MARK: - Initializer
// MARK: - Public
// The core's process, a message a line each way: what is sent goes to its stdin, and what it writes to stdout is
// heard. Its stderr is its log. `onEnd` hears once that it ended, whether it exited or never started.
function open(file, { onMessage, onLog, onEnd }) {
    const { spawn } = require('child_process');
    const child = spawn(file, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    let ended = false;
    const end = (why) => {
        if (ended) return;
        ended = true;
        onEnd(why);
    };
    // A core that ended takes its stdin with it: a write that finds it closed is told by the end, not by a throw.
    child.stdin.on('error', () => {});
    linesOf(child.stdout, onMessage);
    linesOf(child.stderr, onLog);
    child.on('error', (error) => end(error.message));
    child.on('exit', (code, signal) => end(signal ? `it was killed by ${signal}` : `it exited with ${code}`));
    return {
        send: (message) => {
            if (!ended) child.stdin.write(message + '\n');
        },
    };
}

// MARK: - Private
function linesOf(stream, listener) {
    let rest = '';
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
        const lines = (rest + chunk).split('\n');
        rest = lines.pop();
        for (const line of lines) if (line) listener(line);
    });
}

export { open };
