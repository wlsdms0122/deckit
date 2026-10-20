import * as CHANNEL from '../channel/index.js';
import * as IPC from '../ipc/main.js';
import * as DECLARED from './protocol.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// Deck's log: what main and its pages say, on the console and in the file the environment keeps (`log`), which it
// opens as deckit starts. `about()` is what the environment says it is, as it starts.
export function createLog({ log, about }) {
    // MARK: - Property
    const LEVELS = new Set(['info', 'warn', 'error']);
    let writer = null;

    // MARK: - Initializer
    // MARK: - Public
    function info(...parts) {
        say('main', 'info', parts);
    }

    function warn(...parts) {
        say('main', 'warn', parts);
    }

    function error(...parts) {
        say('main', 'error', parts);
    }

    // `nameOf(page)` names the page a line came from, as main knows it: no page says who it is.
    function start({ nameOf }) {
        writer = log.open();
        PROTOCOL.line.on(({ level, parts }, sender) => say(nameOf(sender), LEVELS.has(level) ? level : 'info', parts));
        const { app, engine } = about();
        info(`start, ${app}, ${engine}`);
    }

    // The file the log is written to, once it is open.
    function file() {
        return writer?.file ?? null;
    }

    // MARK: - Private
    function say(where, level, parts) {
        const line = ['[deckit]', ...parts];
        if (level === 'error') console.error(...line);
        else if (level === 'warn') console.warn(...line);
        else console.log(...line);
        writer?.write(where, level, parts);
    }

    return { info, warn, error, file, start };
}
