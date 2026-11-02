import * as OPEN_PERMISSION from '../open/model/permission.js';

// The downloads each mod's web pages started, kept across restarts, newest first, the last LIMIT of each mod's. The
// mod's page is told of one at each change (PROTOCOL.downloaded) and asks, by the id deck gives it, for its list and
// for one to be stopped or forgotten, and, with system.file-handlers as for any file, shown in Finder or opened in its
// app. A download stays the mod's it started for, whatever becomes of its page. Before it is saved, the mod's page is
// asked whether to save it (`saving`). `web` and `open` are the environment's: what stops a download, and what shows
// and opens a file.
export function createDownload({ IDENTITY, STORAGE, PROTOCOL, web: WEB, pages: PAGES, open: SYSTEM }) {
    // MARK: - Property
    const KEY = 'web-downloads'; // the state's key: mod id -> its downloads, newest first
    const LIMIT = 100;
    const QUIT = 'Deckit quit before it finished.';
    let kept = null; // mod id -> its downloads, as the state keeps them
    // The environment's id of a download under way -> { mod, id, forgotten }, `forgotten` once it is stopped as it is
    // forgotten.
    const live = new Map();
    const questions = new Map(); // ask id -> { embedder, offs, resolve }
    let sequence = 0;
    let asked = 0;

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
            const download = find(IDENTITY.modFrom(sender, OPEN_PERMISSION.FILE_HANDLERS).id, id);
            return !!download && SYSTEM.reveal(download.path);
        });
        PROTOCOL.openDownload.handle(async ({ id }, sender) => {
            const download = find(IDENTITY.modFrom(sender, OPEN_PERMISSION.FILE_HANDLERS).id, id);
            return download?.state === 'finished' && !!(await SYSTEM.file(download.path));
        });
        PROTOCOL.removeDownload.handle(({ id }, sender) => remove(IDENTITY.modFrom(sender).id, id));
        PROTOCOL.save.on(({ ask, save }, sender) => {
            if (questions.get(ask)?.embedder === sender) settle(ask, save);
        });
    }

    // Whether a download a web page in the tab of id `tabId` started is saved, `name` the file's as the site gives it:
    // as the page of `embedder` answers, and not once the tab or that page is gone.
    function shouldDownload(embedder, tabId, { url, name, mimeType, expected }) {
        return new Promise((resolve) => {
            const tab = WEB.pageOf(tabId);
            if (!tab) return resolve(false);
            const id = ++asked;
            const gone = () => settle(id, false);
            const offs = [
                PAGES.watch(tab, { destroyed: gone }),
                PAGES.watch(embedder, { ended: gone, gone, destroyed: gone }),
            ];
            questions.set(id, { embedder, offs, resolve });
            PROTOCOL.saving.send(embedder, { id: tabId, ask: id, url, name, mimeType, expected });
        });
    }

    // A download a web page `embedder` shows started, as the environment tells it (WEB_DECK).
    function downloaded(embedder, download) {
        const known = live.get(download.id);
        if (download.state !== 'downloading') live.delete(download.id);
        if (known?.forgotten) return;
        const modId = known?.mod ?? IDENTITY.modOf(embedder)?.id;
        if (!modId) return;
        let entry = known && find(modId, known.id);
        if (!entry) {
            entry = { id: `${Date.now().toString(36)}-${++sequence}`, started: Date.now() };
            kept[modId] = [entry, ...listOf(modId)];
            for (const dropped of kept[modId].splice(LIMIT)) stop(modId, dropped.id);
            live.set(download.id, { mod: modId, id: entry.id });
        }
        const changed = entry.state !== download.state;
        const { url, name, path, state, received, expected, error } = download;
        Object.assign(entry, { url, name, path, state, received, expected, error });
        if (changed) save();
        const page = IDENTITY.pageOf(modId);
        if (page) PROTOCOL.downloaded.send(page, copy(entry));
    }

    // A mod's downloads, gone with it; one under way is stopped.
    function forget(modId) {
        for (const { id } of listOf(modId)) stop(modId, id);
        delete kept[modId];
        save();
    }

    // MARK: - Private
    function listOf(modId) {
        return kept[modId] ?? [];
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
        if (!find(modId, id)) return false;
        stop(modId, id);
        kept[modId] = listOf(modId).filter((download) => download.id !== String(id));
        save();
        return true;
    }

    // Stopped while it is under way, and what it tells from then on not kept.
    function stop(modId, id) {
        const under = underWay(modId, id);
        if (under === null) return;
        live.set(under, { ...live.get(under), forgotten: true });
        WEB.cancelDownload(under);
    }

    function settle(id, save) {
        const question = questions.get(id);
        if (!question) return;
        questions.delete(id);
        for (const off of question.offs) off?.();
        question.resolve(save === true);
    }

    function save() {
        STORAGE.state.write(KEY, kept);
    }

    function copy(download) {
        return { ...download };
    }

    return { start, shouldDownload, downloaded, forget };
}
