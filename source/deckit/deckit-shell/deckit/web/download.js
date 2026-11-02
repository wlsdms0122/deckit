// The downloads each mod's web pages started, kept across restarts, newest first, the last LIMIT of each mod's. The
// mod's page is told of one at each change (PROTOCOL.downloaded) and asks, by the id deck gives it, for its list and
// for one to be stopped, shown in Finder, opened in its app or forgotten. `web` and `open` are the environment's:
// what stops a download, and what shows and opens a file.
export function createDownload({ IDENTITY, STORAGE, PROTOCOL, web: WEB, open: SYSTEM }) {
    // MARK: - Property
    const KEY = 'web-downloads'; // the state's key: mod id -> its downloads, newest first
    const LIMIT = 100;
    const QUIT = 'Deckit quit before it finished.';
    let kept = null; // mod id -> its downloads, as the state keeps them
    const live = new Map(); // the environment's id of a download under way -> { mod, id }
    let sequence = 0;

    // MARK: - Initializer
    // MARK: - Public
    function start() {
        kept = STORAGE.state.read(KEY, {});
        for (const download of Object.values(kept).flat()) {
            if (download.state !== 'downloading') continue;
            download.state = 'failed';
            download.error = QUIT;
        }
        save();
        PROTOCOL.downloads.handle((_payload, sender) => listOf(IDENTITY.modFrom(sender).id).map(copy));
        PROTOCOL.cancelDownload.on(({ id }, sender) => {
            const under = underWay(IDENTITY.modFrom(sender).id, id);
            if (under !== null) WEB.cancelDownload(under);
        });
        PROTOCOL.revealDownload.handle(({ id }, sender) => {
            const download = find(IDENTITY.modFrom(sender).id, id);
            return !!download && SYSTEM.reveal(download.path);
        });
        // A file opens in its app only as a person asks, the way a page opens a window only then.
        PROTOCOL.openDownload.handle(async ({ id }, sender) => {
            const download = find(IDENTITY.modFrom(sender).id, id);
            if (download?.state !== 'finished' || !IDENTITY.consumeUserActivation(sender)) return false;
            return !!(await SYSTEM.file(download.path));
        });
        PROTOCOL.removeDownload.handle(({ id }, sender) => remove(IDENTITY.modFrom(sender).id, id));
    }

    // A download a web page `embedder` shows started, as the environment tells it (WEB_DECK).
    function downloaded(embedder, download) {
        const mod = IDENTITY.modOf(embedder);
        if (!mod) return;
        const known = live.get(download.id);
        if (download.state !== 'downloading') live.delete(download.id);
        const list = listOf(mod.id);
        let entry = known && list.find(({ id }) => id === known.id);
        // One forgotten while it was under way is not kept again.
        if (known && !entry) return;
        if (!entry) {
            entry = { id: `${Date.now().toString(36)}-${++sequence}`, started: Date.now() };
            list.unshift(entry);
            list.splice(LIMIT);
            live.set(download.id, { mod: mod.id, id: entry.id });
        }
        const changed = entry.state !== download.state;
        const { url, name, path, state, received, expected, error } = download;
        Object.assign(entry, { url, name, path, state, received, expected, error });
        if (changed) save();
        const page = IDENTITY.pageOf(mod.id);
        if (page) PROTOCOL.downloaded.send(page, copy(entry));
    }

    // A mod's downloads, gone with it; one under way is stopped.
    function forget(modId) {
        for (const [under, { mod }] of live) if (mod === modId) WEB.cancelDownload(under);
        delete kept[modId];
        save();
    }

    // MARK: - Private
    function listOf(modId) {
        kept[modId] ??= [];
        return kept[modId];
    }

    function find(modId, id) {
        return listOf(modId).find((download) => download.id === String(id)) || null;
    }

    // The environment's id of the mod's download `id`, while it is under way, or null.
    function underWay(modId, id) {
        for (const [under, known] of live) if (known.mod === modId && known.id === String(id)) return under;
        return null;
    }

    // Forgotten, and stopped first while it is under way. Answers whether there was one.
    function remove(modId, id) {
        const list = listOf(modId);
        const index = list.findIndex((download) => download.id === String(id));
        if (index < 0) return false;
        const under = underWay(modId, id);
        if (under !== null) WEB.cancelDownload(under);
        list.splice(index, 1);
        save();
        return true;
    }

    function save() {
        STORAGE.state.write(KEY, kept);
    }

    function copy(download) {
        return { ...download };
    }

    return { start, downloaded, forget };
}
