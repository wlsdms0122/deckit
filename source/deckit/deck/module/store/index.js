DeckitModule.define(
    'deck/module/store',
    {
        uses: [],
        provides: ['read', 'write', 'remove'],
        runs: 'node',
    },
    () => {
        // MARK: - Property
        const fs = require('fs');
        const path = require('path');

        // MARK: - Initializer
        // MARK: - Public
        // A file that is not there, or not JSON, reads as `fallback`: either way there is no value to give.
        function read(file, fallback = null) {
            try {
                return JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch {
                return fallback;
            }
        }

        // Through a temporary file and a rename, so a crash mid-write leaves the previous version whole.
        function write(file, value) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const temporary = file + '.tmp';
            fs.writeFileSync(temporary, JSON.stringify(value));
            fs.renameSync(temporary, file);
        }

        function remove(file) {
            fs.rmSync(file, { force: true });
        }

        // MARK: - Private

        return { read, write, remove };
    }
);
