DeckitModule.define(
    'deckit/service/plugin/host/setting',
    {
        uses: ['deckit/service/storage', 'deckit/service/plugin/identity', 'deckit/service/plugin/host/model/protocol'],
        provides: ['start', 'declare', 'valuesOf'],
        runs: 'main',
    },
    (STORAGE, IDENTITY, PROTOCOL) => {
        // MARK: - Property
        const TYPES = new Set(['toggle', 'number', 'text', 'choice', 'action']);
        const declared = new Map(); // plugin id -> { name, settings: { key: declaration } }

        // MARK: - Initializer
        // MARK: - Public
        function start() {
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

        // What a plugin declared as it started. A declaration of an unknown type is left out.
        function declare(plugin, settings) {
            const kept = {};
            for (const [key, declaration] of Object.entries(settings)) {
                if (TYPES.has(declaration.type)) kept[key] = declaration;
            }
            declared.set(plugin.id, { name: plugin.name, settings: kept });
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
            const view = IDENTITY.viewOf(pluginId);
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
        function optionsOf(pluginId, key, declaration) {
            if (!declaration.computed) return declaration.options || [];
            const view = IDENTITY.viewOf(pluginId);
            return view ? PROTOCOL.settingOptions.invoke(view, { key }) : [];
        }

        async function run(pluginId, key) {
            const declaration = declared.get(pluginId)?.settings[key];
            if (declaration?.type !== 'action') throw new Error(`${pluginId} has no action "${key}"`);
            const view = IDENTITY.viewOf(pluginId);
            if (!view) throw new Error(`${pluginId} is not running`);
            return PROTOCOL.runSetting.invoke(view, { key });
        }

        // A saved value no option offers now (one this machine lacks, or one an update took away) is offered
        // marked absent, and left as it is.
        async function list() {
            const out = [];
            for (const [id, { name, settings }] of declared) {
                if (!Object.keys(settings).length) continue;
                const values = valuesOf(id);
                const items = [];
                for (const [key, declaration] of Object.entries(settings)) {
                    const value = values[key];
                    const options = declaration.type === 'choice' ? await optionsOf(id, key, declaration) : [];
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

        return { start, declare, valuesOf };
    }
);
