DeckitModule.define(
    'shell/theme/page',
    {
        uses: ['shell/ui/token', 'shell/theme/protocol'],
        provides: ['start'],
        runs: 'page',
    },
    (TOKEN, PROTOCOL) => {
        // MARK: - Property
        // MARK: - Initializer
        // MARK: - Public
        // The page's theme, worn as the token's custom properties and the page's color scheme, and taken in place
        // when the host app gives a new one. Answers the token's members, each read at its use, and
        // `onChange(listener)`, which answers its off.
        function start() {
            const listeners = new Set();
            const sheet = new CSSStyleSheet();
            document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
            let token = wear(PROTOCOL.setup.invoke().theme);
            PROTOCOL.change.on(({ theme }) => {
                token = wear(theme);
                for (const listener of listeners) tell(listener);
            });
            const read = {
                onChange(listener) {
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                },
            };
            for (const key of Object.keys(token))
                Object.defineProperty(read, key, { get: () => token[key], enumerable: true });
            return Object.freeze(read);

            function wear(theme) {
                const worn = TOKEN.tokenOf(theme || TOKEN.FALLBACK_THEME);
                sheet.replaceSync(TOKEN.propertiesOf(worn));
                // So what the browser draws itself (scrollbars, native controls) follows it.
                document.documentElement.style.colorScheme = worn.dark ? 'dark' : 'light';
                return worn;
            }
        }

        // MARK: - Private
        // One listener's failure is its own: the others still hear the change.
        function tell(listener) {
            try {
                listener();
            } catch (error) {
                console.error(error);
            }
        }

        return { start };
    }
);
