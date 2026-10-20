import * as CHANNEL from '../../../deckit-shell/deck/channel/index.js';
import * as IPC from '../../../deckit-shell/deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as MOD_PERMISSION from '../mod/permission.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

// The mods' settings, as the core judges and keeps them: what only a mod's page knows, the options it works out and
// its actions, is asked of the page here and handed to the core.
export function createSetting({ CORE, LOG, IDENTITY, RUNNER }) {
    // MARK: - Property
    // How long a mod has to work out a setting's options: a mod still starting answers once it has.
    const OPTIONS_LIMIT_MS = 5000;

    // MARK: - Initializer
    // MARK: - Public
    // A run's declarations the core cannot read are shown on its row.
    function start() {
        PROTOCOL.declare.on(({ run: number, settings }, sender) => {
            const { id } = IDENTITY.modFrom(sender);
            CORE.request('setting/declare', { mod: id, run: number, settings }).catch((error) => {
                LOG.warn(`${id}: its settings were not declared`, error);
                const run = RUNNER.currentRun(sender, number);
                if (run) RUNNER.reportProblem(run, `its settings were not declared: ${error.message}`);
            });
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

    // MARK: - Private
    // The mod's page is told of a value that changed.
    async function set(modId, key, value) {
        const choices = await CORE.request('setting/computed-choices', { mod: modId });
        const options = choices.some((choice) => choice.key === key) ? await optionsOf(modId, key) : undefined;
        const { value: next, changed } = await CORE.request('setting/set', { mod: modId, key, value, options });
        const webContents = IDENTITY.pageOf(modId);
        if (changed && webContents) PROTOCOL.settingChanged.send(webContents, { key, value: next });
        return next;
    }

    // A mod that cannot say its options now is listed with none.
    async function list() {
        const keys = await CORE.request('setting/computed-choices', {});
        const choices = await Promise.all(
            keys.map(async ({ mod, key }) => ({ mod, key, options: await optionsOf(mod, key).catch(() => []) }))
        );
        return CORE.request('setting/list', { choices });
    }

    // Options worked out as they are read (the fonts on this Mac) are the mod's to answer: none while its page is not
    // there.
    async function optionsOf(modId, key) {
        const webContents = IDENTITY.pageOf(modId);
        return webContents ? PROTOCOL.settingOptions.invoke(webContents, { key }, { timeout: OPTIONS_LIMIT_MS }) : [];
    }

    async function runAction(modId, key) {
        await CORE.request('setting/action', { mod: modId, key });
        const webContents = IDENTITY.pageOf(modId);
        if (!webContents) throw new Error(`${modId} is not running`);
        return PROTOCOL.runSetting.invoke(webContents, { key });
    }

    return { start };
}
