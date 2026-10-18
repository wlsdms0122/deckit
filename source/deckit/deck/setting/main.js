import * as PROTOCOL from './protocol.js';
import * as SETTING_TYPE from './model/type.js';
import * as MOD_PERMISSION from '../mod/permission.js';

export function createSetting({ STORAGE, IDENTITY, CATALOG, RUNNER }) {
    // MARK: - Property
    // How long a mod has to work out a setting's options: a mod still starting answers once it has.
    const OPTIONS_LIMIT_MS = 5000;
    const declared = new Map(); // mod id -> { name, settings: { key: declaration } }

    // MARK: - Initializer
    // MARK: - Public
    // A mod's settings stand from its entry's declaring them until it no longer loads, or until a later run of
    // it declares them again: one whose start failed can still be set.
    function start() {
        PROTOCOL.declare.on(({ run: number, settings }, sender) => {
            if (RUNNER.currentRun(sender, number)?.state === 'launching') declare(IDENTITY.modFrom(sender), settings);
        });
        CATALOG.onChange(() => {
            const loading = new Set(CATALOG.mods().map(({ id }) => id));
            for (const id of declared.keys()) if (!loading.has(id)) forget(id);
        });
        PROTOCOL.setSetting.handle(({ key, value }, sender) => set(IDENTITY.modFrom(sender).id, key, value));
        PROTOCOL.modSettings.handle((_payload, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MOD_SETTINGS);
            return list();
        });
        PROTOCOL.setModSetting.handle(({ mod, key, value }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MOD_SETTINGS);
            return set(mod, key, value);
        });
        PROTOCOL.runModSetting.handle(({ mod, key }, sender) => {
            IDENTITY.modFrom(sender, MOD_PERMISSION.MOD_SETTINGS);
            return runAction(mod, key);
        });
    }

    // A value saved for a setting the mod no longer declares is not handed back.
    function valuesOf(modId) {
        const saved = STORAGE.settings.read(modId);
        const settings = declared.get(modId)?.settings || {};
        const values = {};
        for (const [key, declaration] of Object.entries(settings)) {
            if (declaration.type === 'action') continue;
            values[key] = Object.hasOwn(saved, key) ? saved[key] : declaration.default;
        }
        return values;
    }

    // MARK: - Private
    // What a mod declares as its entry is read. A declaration of an unknown type is left out.
    function declare(mod, settings) {
        const kept = {};
        for (const [key, declaration] of Object.entries(settings)) {
            if (SETTING_TYPE.TYPES.has(declaration.type)) kept[key] = declaration;
        }
        declared.set(mod.id, { name: mod.name, settings: kept });
    }

    function forget(modId) {
        declared.delete(modId);
    }

    async function set(modId, key, value) {
        const declaration = declared.get(modId)?.settings[key];
        if (!declaration) throw new Error(`${modId} has no setting "${key}"`);
        const next = await coerce(modId, key, declaration, value);
        const values = STORAGE.settings.read(modId);
        if (values[key] === next) return next;
        STORAGE.settings.write(modId, { ...values, [key]: next });
        const webContents = IDENTITY.pageOf(modId);
        if (webContents) PROTOCOL.settingChanged.send(webContents, { key, value: next });
        return next;
    }

    async function coerce(modId, key, declaration, value) {
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
                const options = await optionsOf(modId, key, declaration);
                if (!options.some((option) => option.value === value))
                    throw new Error(`not an option of ${key}: ${value}`);
                return value;
            }
            default:
                throw new Error(`${key} is a button, not a value`);
        }
    }

    // Options worked out as they are read (the fonts on this Mac) are the mod's to answer.
    async function optionsOf(modId, key, declaration) {
        if (!declaration.computed) return declaration.options || [];
        const webContents = IDENTITY.pageOf(modId);
        return webContents ? PROTOCOL.settingOptions.invoke(webContents, { key }, { timeout: OPTIONS_LIMIT_MS }) : [];
    }

    async function runAction(modId, key) {
        const declaration = declared.get(modId)?.settings[key];
        if (declaration?.type !== 'action') throw new Error(`${modId} has no action "${key}"`);
        const webContents = IDENTITY.pageOf(modId);
        if (!webContents) throw new Error(`${modId} is not running`);
        return PROTOCOL.runSetting.invoke(webContents, { key });
    }

    // A saved value no option offers now (one this machine lacks, or one an update took away) is offered
    // marked absent, and left as it is.
    async function list() {
        const out = [];
        for (const { id } of CATALOG.mods().filter(({ id }) => declared.has(id))) {
            const { name, settings } = declared.get(id);
            if (!Object.keys(settings).length) continue;
            const values = valuesOf(id);
            const items = [];
            for (const [key, declaration] of Object.entries(settings)) {
                const value = values[key];
                // A mod that cannot say its options now is listed with none, and the value kept marked absent.
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

    return { start, valuesOf };
}
