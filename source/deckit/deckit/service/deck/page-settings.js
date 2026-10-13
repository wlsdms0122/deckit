DeckitModule.define(
    'deckit/service/deck/page-settings',
    {
        uses: ['deckit/service/deck/protocol'],
        provides: ['of', 'declarationsOf'],
        runs: 'page',
    },
    (PROTOCOL) => {
        // MARK: - Property
        const TYPES = new Set(['toggle', 'number', 'text', 'choice', 'action']);

        // MARK: - Initializer
        // MARK: - Public
        // A plugin's settings as it reads them: what was saved, over what it declared by default. Changed by main,
        // which checks and keeps them, and tells this sandbox, so a change made in Settings arrives here as on().
        // `deck` is a promise of the plugin's deck, rejected when it does not start.
        function of({ declared, saved, deck, deliver, fail }) {
            const values = { ...saved };
            const listeners = new Set();
            PROTOCOL.settingChanged.on(({ key, value }) => {
                values[key] = value;
                for (const listener of listeners) deliver('settings.on', listener, key, value);
            });
            // Options worked out when Settings draws them, and actions Settings runs, are asked of this view.
            // Worked-out options and actions are the plugin's to answer once it has its deck.
            PROTOCOL.settingOptions.handle(async ({ key }) => {
                const options = declared[key]?.options;
                return typeof options === 'function' ? options(await deck) : options || [];
            });
            PROTOCOL.runSetting.handle(async ({ key }) => {
                const said = await declared[key]?.run?.(await deck);
                return said == null ? '' : String(said);
            });
            return {
                get(key) {
                    if (Object.hasOwn(values, key)) return values[key];
                    return declared[key]?.default;
                },
                set(key, value) {
                    return PROTOCOL.setSetting.invoke({ key, value }).catch((error) => {
                        fail(`could not set "${key}": ${error.message}`);
                        throw error;
                    });
                },
                on(listener) {
                    listeners.add(listener);
                    return () => listeners.delete(listener);
                },
            };
        }

        // What main is told of the declarations: their data, without functions. A type deckit does not know is
        // left out and told to `invalid`.
        function declarationsOf(declared, invalid) {
            const out = {};
            for (const [key, declaration] of Object.entries(declared || {})) {
                if (!TYPES.has(declaration?.type)) {
                    invalid(`setting "${key}" has no type deckit knows: ${declaration?.type}`);
                    continue;
                }
                const { run, options, ...data } = declaration;
                out[key] = {
                    ...data,
                    options: Array.isArray(options) ? options : [],
                    computed: typeof options === 'function',
                };
            }
            return out;
        }

        // MARK: - Private

        return { of, declarationsOf };
    }
);
