DeckitModule.define(
    'deckit/service/open/page',
    {
        uses: ['deckit/service/open/model/scheme', 'deckit/service/open/protocol'],
        provides: ['open', 'answer', 'reveal', 'fileURL', 'filePath', 'handlerLists', 'setHandlers', 'EVERY'],
    },
    (SCHEME, PROTOCOL) => {
        // MARK: - Property
        const EVERY = SCHEME.EVERY;

        // MARK: - Initializer
        // MARK: - Public
        function open(url, { activates = true, userInitiated = false, usesDefaultApp = false, target = '' } = {}) {
            return PROTOCOL.open.invoke({
                url: String(url),
                activates,
                userInitiated,
                usesDefaultApp,
                target: String(target),
            });
        }

        // The mod's open(url, options), asked when an address of a scheme it names is opened.
        function answer(openURL) {
            PROTOCOL.offer.handle(async ({ url, options }) => (await openURL(url, options)) === true);
            PROTOCOL.handles.send();
        }

        function reveal(file) {
            return PROTOCOL.reveal.invoke({ file: String(file) });
        }

        // Each part escaped, so a space or a # stays part of the name.
        function fileURL(file) {
            const written = String(file);
            return written.startsWith('/') ? 'file://' + written.split('/').map(encodeURIComponent).join('/') : '';
        }

        function filePath(url) {
            try {
                const parsed = new URL(String(url));
                if (parsed.protocol !== 'file:' || (parsed.host && parsed.host !== 'localhost')) return '';
                const file = decodeURIComponent(parsed.pathname);
                return file.startsWith('/') ? file : '';
            } catch {
                return '';
            }
        }

        function handlerLists() {
            return PROTOCOL.handlerLists.invoke();
        }

        function setHandlers(scheme, { order = [], off = [] } = {}) {
            return PROTOCOL.setHandlers.invoke({ scheme, order, off });
        }

        // MARK: - Private

        return { open, answer, reveal, fileURL, filePath, handlerLists, setHandlers, EVERY };
    }
);
