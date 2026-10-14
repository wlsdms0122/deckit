DeckitModule.define(
    'core/log',
    {
        uses: [],
        provides: ['open'],
        runs: 'node',
    },
    () => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');
        const LIMIT = 1024 * 1024;

        // MARK: - Initializer
        // MARK: - Public
        // A log file kept under LIMIT by moving it aside to <name>.1.log. Writing never throws: a file that
        // cannot be opened is written to nowhere.
        function open({ folder, name }) {
            const file = path.join(folder, name + '.log');
            let stream = null;
            let written = 0;

            fs.mkdirSync(folder, { recursive: true });
            written = sizeOf(file);
            if (written > LIMIT) rotate();
            else start();

            function start() {
                try {
                    // Opened at once, so the file is there to be moved even before a write flushes.
                    const own = fs.createWriteStream(null, { fd: fs.openSync(file, 'a') });
                    own.on('error', () => {
                        if (stream === own) stream = null;
                    });
                    stream = own;
                } catch {
                    stream = null;
                }
            }

            // Decided on the bytes handed to the stream: the size on disk lags while writes are queued.
            function rotate() {
                stream?.end();
                stream = null;
                if (fs.existsSync(file)) fs.renameSync(file, path.join(folder, name + '.1.log'));
                written = 0;
                start();
            }

            function write(where, level, parts) {
                if (!stream) return;
                const line = `${new Date().toISOString()} [${where}] ${level}: ${parts.map(textOf).join(' ')}\n`;
                stream.write(line);
                written += Buffer.byteLength(line);
                if (written > LIMIT) rotate();
            }

            return { file, write };
        }

        // MARK: - Private
        function sizeOf(file) {
            return fs.existsSync(file) ? fs.statSync(file).size : 0;
        }

        function textOf(part) {
            if (typeof part === 'string') return part;
            if (part instanceof Error) return part.stack || part.message;
            try {
                return JSON.stringify(part);
            } catch {
                return String(part);
            }
        }

        return { open };
    }
);
