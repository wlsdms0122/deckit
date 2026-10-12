DeckitModule.define(
    'deckit/service/log/view',
    {
        uses: ['deckit/service/log/protocol'],
        provides: ['info', 'warn', 'error'],
    },
    (PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        function info(...parts) {
            say('info', parts);
        }

        function warn(...parts) {
            say('warn', parts);
        }

        function error(...parts) {
            say('error', parts);
        }

        // MARK: - Private
        // Said here too, so a page's own developer tools show it where it happened.
        function say(level, parts) {
            (level === 'info' ? console.log : console[level])('[deckit]', ...parts);
            PROTOCOL.line.send({ level, parts: parts.map(textOf) });
        }

        function textOf(part) {
            if (part instanceof Error) return part.stack || part.message;
            return typeof part === 'string' ? part : String(part);
        }

        return { info, warn, error };
    }
);
