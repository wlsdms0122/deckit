DeckitModule.define(
    'deckit/service/deck/setting',
    {
        uses: ['deckit/service/storage', 'deckit/service/deck/identity', 'deckit/service/deck/protocol'],
        provides: ['start', 'declare', 'forget', 'valuesOf'],
        runs: 'main',
    },
    (STORAGE, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        const TYPES = new Set(['toggle', 'number', 'text', 'choice', 'action']);
        // How long a plugin has to work out a setting's options: a plugin still starting answers once it has.
        const OPTIONS_LIMIT_MS = 5000;
        const declared = new Map(); // plugin id -> { name, settings: { key: declaration } }
        let order = () => []; // the ids of the plugins that load, in the person's order

        // MARK: - Initializer
        // MARK: - Public
        // `ordered()` gives the ids of the plugins that load, in the person's order, which Settings lists them in.
        function start({ ordered }) {
            order = ordered;
            PROTOCOL.setSetting.handle(({ key, value }, sender) => set(IDENTITY.pluginFrom(sender).id, key, value));
            PROTOCOL.pluginSettings.handle((_payload, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugin-settings');
                return list();
            });
            PROTOCOL.setPluginSetting.handle(({ plugin, key, value }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugin-settings');
                return set(plugin, key, value);
            });
            PROTOCOL.runPluginSetting.handle(({ plugin, key }, sender) => {
                IDENTITY.pluginFrom(sender, 'deckit.plugin-settings');
                return run(plugin, key);
            });
        }

        // What a plugin declares as its entry is read. A declaration of an unknown type is left out.
        function declare(plugin, settings) {
            const kept = {};
            for (const [key, declaration] of Object.entries(settings)) {
                if (TYPES.has(declaration.type)) kept[key] = declaration;
            }
            declared.set(plugin.id, { name: plugin.name, settings: kept });
        }

        function forget(pluginId) {
            declared.delete(pluginId);
        }

        // A value saved for a setting the plugin no longer declares is not handed back.
        function valuesOf(pluginId) {
            const saved = STORAGE.settings.read(pluginId);
            const settings = declared.get(pluginId)?.settings || {};
            const values = {};
            for (const [key, declaration] of Object.entries(settings)) {
                if (declaration.type === 'action') continue;
                values[key] = Object.hasOwn(saved, key) ? saved[key] : declaration.default;
            }
            return values;
        }

        // MARK: - Private
        async function set(pluginId, key, value) {
            const declaration = declared.get(pluginId)?.settings[key];
            if (!declaration) throw new Error(`${pluginId} has no setting "${key}"`);
            const next = await coerce(pluginId, key, declaration, value);
            const values = STORAGE.settings.read(pluginId);
            if (values[key] === next) return next;
            STORAGE.settings.write(pluginId, { ...values, [key]: next });
            const view = IDENTITY.pageOf(pluginId);
            if (view) PROTOCOL.settingChanged.send(view, { key, value: next });
            return next;
        }

        async function coerce(pluginId, key, declaration, value) {
            switch (declaration.type) {
                case 'toggle':
                    return !!value;
                case 'text':
                    return String(value ?? '');
                case 'number': {
                    const number = Number(value);
                    if (!Number.isFinite(number)) throw new Error(`not a number for ${key}: ${value}`);
                    return Math.min(declaration.max ?? Infinity, Math.max(declaration.min ?? -Infinity, number));
                }
                case 'choice': {
                    const options = await optionsOf(pluginId, key, declaration);
                    if (!options.some((option) => option.value === value))
                        throw new Error(`not an option of ${key}: ${value}`);
                    return value;
                }
                default:
                    throw new Error(`${key} is a button, not a value`);
            }
        }

        // Options worked out when Settings draws them (the fonts on this Mac) are the plugin's to answer.
        async function optionsOf(pluginId, key, declaration) {
            if (!declaration.computed) return declaration.options || [];
            const view = IDENTITY.pageOf(pluginId);
            return view ? PROTOCOL.settingOptions.invoke(view, { key }, { timeout: OPTIONS_LIMIT_MS }) : [];
        }

        async function run(pluginId, key) {
            const declaration = declared.get(pluginId)?.settings[key];
            if (declaration?.type !== 'action') throw new Error(`${pluginId} has no action "${key}"`);
            const view = IDENTITY.pageOf(pluginId);
            if (!view) throw new Error(`${pluginId} is not running`);
            return PROTOCOL.runSetting.invoke(view, { key });
        }

        // A saved value no option offers now (one this machine lacks, or one an update took away) is offered
        // marked absent, and left as it is.
        async function list() {
            const out = [];
            for (const id of order().filter((id) => declared.has(id))) {
                const { name, settings } = declared.get(id);
                if (!Object.keys(settings).length) continue;
                const values = valuesOf(id);
                const items = [];
                for (const [key, declaration] of Object.entries(settings)) {
                    const value = values[key];
                    // A plugin that cannot say its options now is listed with none, and the value kept marked absent.
                    const options =
                        declaration.type === 'choice' ? await optionsOf(id, key, declaration).catch(() => []) : [];
                    const offered = options.some((option) => option.value === value)
                        ? options
                        : declaration.type === 'choice'
                          ? [...options, { value, label: String(value), absent: true }]
                          : [];
                    items.push({ key, ...declaration, value, options: offered });
                }
                out.push({ id, name, items });
            }
            return out;
        }

        return { start, declare, forget, valuesOf };
    }
);
