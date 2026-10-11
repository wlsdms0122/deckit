DeckitModule.define(
    'deckit/module/log',
    {
        uses: [],
        provides: ['open', 'text', 'guard'],
        runs: 'node',
    },
    () => {
        const fs = require('fs');
        const path = require('path');

        const LIMIT = 1024 * 1024;

        // Writing never throws; a file that cannot be opened is written to nowhere.
        const open = ({ dir, name }) => {
            const file = path.join(dir, name + '.log');
            let stream = null;
            let written = 0;
            const start = () => {
                try {
                    // Opened synchronously, so the file exists to be renamed even if it fills before a write flushes.
                    const own = fs.createWriteStream(null, { fd: fs.openSync(file, 'a') });
                    // After a rotation the old stream may still be flushing; its error must not stop the new one.
                    own.on('error', () => {
                        if (stream === own) stream = null;
                    });
                    stream = own;
                } catch {
                    stream = null;
                }
            };
            /* Decided only on the bytes handed to the stream: the size on disk lags while writes are queued.
       The old stream's queued lines follow its inode into <name>.1.log. */
            const rotate = () => {
                try {
                    stream?.end();
                } catch {}
                stream = null;
                try {
                    fs.renameSync(file, path.join(dir, name + '.1.log'));
                } catch {}
                written = 0;
                start();
            };
            const write = (where, level, line) => {
                if (!stream) return;
                const out = `${new Date().toISOString()} [${where}] ${level}: ${line}\n`;
                try {
                    stream.write(out);
                } catch {
                    return;
                }
                written += Buffer.byteLength(out);
                if (written > LIMIT) rotate();
            };
            // An earlier run's file counts toward the limit; read once, before anything is queued.
            try {
                fs.mkdirSync(dir, { recursive: true });
                try {
                    written = fs.statSync(file).size;
                } catch {
                    written = 0;
                }
                if (written > LIMIT) rotate();
                else start();
            } catch {
                stream = null;
            }
            return Object.freeze({ file, write });
        };

        const text = (args) =>
            args
                .map((a) => {
                    if (typeof a === 'string') return a;
                    if (a instanceof Error) return a.stack || a.message;
                    try {
                        return JSON.stringify(a);
                    } catch {
                        return String(a);
                    }
                })
                .join(' ');

        // An exception nobody catches in main ends the app with no dialog: every listener of ours goes through this.
        const guard = (emitter, event, fn, { once = false } = {}) => {
            const wrapped = (...args) => {
                try {
                    const out = fn(...args);
                    if (out && typeof out.catch === 'function')
                        out.catch((e) => console.error('[deckit] ' + event + ' failed', e));
                    return out;
                } catch (e) {
                    console.error('[deckit] ' + event + ' failed', e);
                }
            };
            emitter[once ? 'once' : 'on'](event, wrapped);
            return wrapped;
        };

        return { open, text, guard };
    }
);
