import * as MOD from './model/mod.js';

// The mods as the core read them, kept here as it last gave them, so what asks at once is answered at once. `files`
// reads a mod's files where the environment keeps them.
export function createCatalog({ CORE, LOG, files }) {
    // MARK: - Property
    let all = []; // every mod the core read, in the load order
    let loading = [];
    // Every interface a mod implements or depends on, each `{ interface, name, undecided, implementations, pick }`, its
    // implementations `[{ id, name, version, on }]` in their order and `pick` the id of the one the core picked, absent
    // when none is, as the core read them with the mods.
    let lists = [];
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

    // Every mod read, in the load order, each with whether it loads and why not, and the folders of the same id it
    // hides.
    function found() {
        return all;
    }

    // The mods that load, in their load order.
    function mods() {
        return loading;
    }

    // Each interface's list of implementations, as the mods were last read.
    function interfaces() {
        return lists;
    }

    // Interface -> the id of the mod the core picked for it, for each interface one is.
    function picks() {
        const picked = new Map();
        for (const list of lists) if (list.pick) picked.set(list.interface, list.pick);
        return picked;
    }

    // The ids named take the places they held among themselves in the load order, in the order given; the rest stay
    // put. Refused for an order that puts a mod that loads before one it requires. Settled once the mods are read
    // again.
    async function arrange(ids) {
        await CORE.request('catalog/arrange', { ids });
        await refresh();
    }

    // As the person's: the implementations in `order` take the places they held among themselves in the interface's
    // list, in the order given, and those in `off` are switched off. Refused for an order whose pick would make a cycle
    // among mods that load now. Settled once the mods are read again.
    async function order(named, { order: ids = [], off = [] } = {}) {
        await CORE.request('catalog/order', { interface: named, order: ids, off });
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

    // The installed copies of the mod taken away. Answers whether deck keeps anything under its id, which one that
    // names no mod id does not. What is read here changes at the next refresh.
    function remove(id) {
        return CORE.request('catalog/remove', { id });
    }

    // The mods read again, with each interface's list as they come to, and whoever listens told.
    async function refresh() {
        const read = (await CORE.request('catalog/read')).map(MOD.read);
        lists = await CORE.request('catalog/interfaces');
        all = read;
        loading = all.filter((mod) => !mod.problem);
        for (const listener of listeners) listener();
    }

    // Told when the mods change. Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // The text of the entry of a mod that loads, the one file deck runs in its sandbox.
    function sourceOf(mod) {
        return files.readText(mod.entry);
    }

    // MARK: - Private

    return {
        load,
        found,
        mods,
        interfaces,
        picks,
        arrange,
        order,
        planInstall,
        install,
        remove,
        refresh,
        onChange,
        sourceOf,
    };
}
