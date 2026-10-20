import * as CHANNEL from '../../../deckit-driver/channel/index.js';
import * as IPC from '../ipc/index.js';
import * as DECLARED from './protocol.js';
import * as SETTING_TYPE from './model/type.js';

// MARK: - Property
const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);
// MARK: - Initializer
// MARK: - Public
// A mod's settings as it reads them: what was saved, over what it declared by default. Changed by main,
// which checks and keeps them, and tells this sandbox, so a change another mod made arrives here as on().
// `deck` is a promise of the mod's deck, rejected when it does not start.
function of({ declared, saved, deck, deliver, fail }) {
    const values = { ...saved };
    const listeners = new Set();
    PROTOCOL.settingChanged.on(({ key, value }) => {
        values[key] = value;
        for (const listener of listeners) deliver('settings.on', listener, key, value);
    });
    // Options worked out as they are read, and actions run from another mod, are asked of this page.
    // Worked-out options and actions are the mod's to answer once it has its deck.
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

// What main is told of the declarations: their data, without functions, in the order declared. A type deck does not
// know is left out and told to `invalid`.
function declarationsOf(declared, invalid) {
    const out = [];
    for (const [key, declaration] of Object.entries(declared || {})) {
        if (!SETTING_TYPE.TYPES.has(declaration?.type)) {
            invalid(`setting "${key}" has no type deck knows: ${declaration?.type}`);
            continue;
        }
        const { run, options, ...data } = declaration;
        out.push({
            ...data,
            key,
            options: Array.isArray(options) ? options : [],
            computed: typeof options === 'function',
        });
    }
    return out;
}

// MARK: - Private

// `deck.modSettings` for a mod with deckit.mod-settings: every mod's settings.
function modSettingsTool() {
    return Object.freeze({
        list: () => PROTOCOL.modSettings.invoke(),
        set: (id, key, value) => PROTOCOL.setModSetting.invoke({ mod: id, key, value }),
        run: (id, key) => PROTOCOL.runModSetting.invoke({ mod: id, key }),
    });
}

// Main is told what a run declares as soon as its entry is read: the declarations, without functions.
function declare(run, declared, invalid) {
    PROTOCOL.declare.send({ run, settings: declarationsOf(declared, invalid) });
}

export { of, declare, modSettingsTool };
