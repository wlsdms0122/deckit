import * as MOD from './model/mod.js';

// The mods as the core read them, kept here as it last gave them, so what asks at once is answered at once. `files`
// reads a mod's files where the environment keeps them.
export function createCatalog({ CORE, LOG, files }) {
    // MARK: - Property
    let all = []; // every mod the core read, in the mods' order
    let loading = [];
    // Every interface a mod provides or uses, each `{ interface, name, owner, pinned, providers }`, its providers
    // `[{ id, name, majors }]` in the order they began to provide it and `owner` the id of the one that owns it, absent
    // while none provides it, as the core read them with the mods.
    let queues = [];
    const listeners = new Set();

    // MARK: - Initializer
    // MARK: - Public
    // Once the core has started, before anything reads the mods: what the app ships is installed, then the mods are
    // read. Mods the core could not read are none, and the log says why.
    async function load() {
        try {
            for (const { id, outcome, problem } of await CORE.request('catalog/install-shipped'))
                if (problem) LOG.warn(`${outcome} ${id}: ${problem}`);
                else LOG.info(`${outcome} ${id}`);
            await refresh();
        } catch (error) {
            LOG.error('the mods were not read', error);
        }
        for (const mod of all) if (mod.problem) LOG.warn(`mod ${mod.id} not loaded: ${mod.problem}`);
    }

    // Every mod read, in the mods' order, each with whether it loads and why not, and the folders of the same id it
    // hides.
    function found() {
        return all;
    }

    // The mods that load, in their order.
    function mods() {
        return loading;
    }

    // Each interface's queue of providers, as the mods were last read.
    function interfaces() {
        return queues;
    }

    // The provider `id` owns the interface from now on, until its pin is cleared, for null, or it stops providing it.
    // Refused for a mod that does not provide the interface. Settled once the mods are read again.
    async function pin(named, id) {
        await CORE.request('catalog/pin', { interface: named, mod: id ?? null });
        await refresh();
    }

    // What a folder would install, `{ manifest, replaces }`: whether it takes the place of an installed copy. Refused
    // with why for a folder install refuses.
    function planInstall(from) {
        return CORE.request('catalog/plan-install', { from });
    }

    // Answers the manifest of what it installed. What is read here changes at the next refresh.
    function install(from) {
        return CORE.request('catalog/install', { from });
    }

    // The installed copies of the mod taken away. Answers whether the core keeps anything under its id, which one that
    // names no mod id does not. What is read here changes at the next refresh.
    function remove(id) {
        return CORE.request('catalog/remove', { id });
    }

    // The mods read again, with each interface's queue as they come to, and whoever listens told.
    async function refresh() {
        const read = (await CORE.request('catalog/read')).map(MOD.read);
        queues = await CORE.request('catalog/interfaces');
        all = read;
        loading = all.filter((mod) => !mod.problem);
        for (const listener of listeners) listener();
    }

    // Told when the mods change. Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // The text of the entry of a mod that loads, the one file deckit runs in its sandbox.
    function sourceOf(mod) {
        return files.readText(mod.entry);
    }

    // The text of the file `path` names inside the folder of the mod `id` that loads, `/` separated as a manifest
    // writes a path, or null when that is no file inside the folder, by a link too, as the core resolves it.
    function readFile(id, path) {
        return CORE.request('catalog/read-file', { mod: id, path });
    }

    // MARK: - Private

    return {
        load,
        found,
        mods,
        interfaces,
        pin,
        planInstall,
        install,
        remove,
        refresh,
        onChange,
        sourceOf,
        readFile,
    };
}
