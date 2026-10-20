// The mods as the core read them, kept here as it last gave them, so what asks at once is answered at once. Each is
// what its manifest says, with `manifest` itself, and where it is, whether it loads and what it depends on.
export function createCatalog({ CORE, LOG }) {
    // MARK: - Property
    const fs = require('fs');
    let all = []; // every mod the core read, those that load first, in the person's order
    let loading = [];
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

    // Every mod read, those that load first, each with whether it loads and why not, and the folders of the same id
    // it hides.
    function found() {
        return all;
    }

    // The mods that load, in the person's order.
    function mods() {
        return loading;
    }

    // The ids named take the places they held among themselves, in the order given; the rest stay put.
    async function arrange(ids) {
        try {
            await CORE.request('catalog/arrange', { ids });
            await refresh();
        } catch (error) {
            LOG.error('the order of the mods was not kept', error);
        }
    }

    // What a folder would install: its manifest. Refused with why for a folder install refuses.
    function wouldInstall(from) {
        return CORE.request('catalog/would-install', { from });
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

    // The mods read again, and whoever listens told.
    async function refresh() {
        all = (await CORE.request('catalog/read')).map((mod) => ({ ...mod.manifest, ...mod }));
        loading = all.filter((mod) => !mod.problem);
        for (const listener of listeners) listener();
    }

    // Told when the mods or their order change.
    // Answers its off.
    function onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
    }

    // The text of the entry of a mod that loads, the one file deck runs in its sandbox.
    function sourceOf(mod) {
        return fs.readFileSync(mod.entry, 'utf8');
    }

    // MARK: - Private

    return {
        load,
        found,
        mods,
        arrange,
        wouldInstall,
        install,
        remove,
        refresh,
        onChange,
        sourceOf,
    };
}
