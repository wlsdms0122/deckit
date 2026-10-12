DeckitModule.define(
    'deckit/service/plugin/runtime/settings',
    {
        uses: ['deckit/service/plugin/host/protocol'],
        provides: ['of', 'declarationsOf'],
        runs: 'page',
    },
    (PROTOCOL) => {
        // MARK: - Property
        const TYPES = new Set(['toggle', 'number', 'text', 'choice', 'action']);

        // MARK: - Initializer
        // MARK: - Public
        // A plugin's settings as it reads them: what was saved, over what it declared by default. Changed by main,
        // which checks and keeps them, and tells this view, so a change made in Settings arrives here as on().
        function of({ declared, saved, context, deliver, fail }) {
            const values = { ...saved };
            const listeners = new Set();
            PROTOCOL.settingChanged.on(({ key, value }) => {
                values[key] = value;
                for (const listener of listeners) deliver('settings.on', listener, key, value);
            });
            // Options worked out when Settings draws them, and actions Settings runs, are asked of this view.
            PROTOCOL.settingOptions.handle(({ key }) => {
                const options = declared[key]?.options;
                return typeof options === 'function' ? options(context()) : options || [];
            });
            PROTOCOL.runSetting.handle(async ({ key }) => {
                const said = await declared[key]?.run?.(context());
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
