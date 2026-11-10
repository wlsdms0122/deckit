import * as FILE_URL from '../../../deckit-sdk/deckit/open/model/file-url.js';

// The downloads each mod's web pages started, kept across restarts, newest first, the last LIMIT of each mod's and any
// older one still under way. The mod's page is told of one at each change (PROTOCOL.downloaded) and asks, by the id the
// web engine gives it, for its list and for one to be stopped or forgotten, and, with system.file-handlers as for any
// file, opened in its app. A download stays the mod's it started for, whatever becomes of its page, and is told to the
// mod's run that is running. Before it is saved, the mod's page is asked whether to save it (`saving`). `deckit` is
// what connect answered, and `state` the web engine's own state. `web` is the environment's: what stops a download. A
// download is opened through deckit, as the mod's own openExternal opens a file.
export function createDownload({ deckit, state: STATE, PROTOCOL, web: WEB, pages: PAGES }) {
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
        kept = STATE.read(KEY, {});
        for (const download of Object.values(kept).flat()) {
            if (download.state !== 'downloading') continue;
            download.state = 'failed';
            download.error = QUIT;
        }
        save();
        PROTOCOL.downloads.handle((_payload, sender) => listOf(deckit.mods.modOf(sender)).map(copy));
        PROTOCOL.cancelDownload.handle(({ id }, sender) => {
            const under = underWay(deckit.mods.modOf(sender), id);
            if (under !== null) WEB.cancelDownload(under);
        });
        PROTOCOL.openDownload.handle(async ({ id }, sender) => {
            const mod = deckit.mods.modOf(sender);
            const download = find(mod, id);
            if (download?.state !== 'finished') return false;
            await deckit.mods.openExternal(mod, FILE_URL.fileURL(download.path));
            return true;
        });
        PROTOCOL.removeDownload.handle(({ id }, sender) => remove(deckit.mods.modOf(sender), id));
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
        const modId = known?.mod ?? deckit.mods.modOf(embedder);
        if (!modId) return;
        let entry = known && find(modId, known.id);
        if (!entry) {
            entry = { id: `${Date.now().toString(36)}-${++sequence}`, started: Date.now() };
            // A record past the last LIMIT goes once it ended: the limit is on what is kept, not on what downloads.
            kept[modId] = [entry, ...listOf(modId)].filter(
                (download, index) => index < LIMIT || download.state === 'downloading'
            );
            live.set(download.id, { mod: modId, id: entry.id });
        }
        const changed = entry.state !== download.state;
        const { url, name, path, state, received, expected, error } = download;
        Object.assign(entry, { url, name, path, state, received, expected, error });
        if (changed) save();
        const page = deckit.mods.runs().find(({ run }) => run.mod.id === modId && run.state === 'running')?.page;
        if (page) PROTOCOL.downloaded.send(page, copy(entry));
    }

    // A mod's downloads, gone with it; one under way is stopped. Answers once the state is written.
    function forget(modId) {
        for (const { id } of listOf(modId)) stop(modId, id);
        delete kept[modId];
        return save();
    }

    // Whether the mod keeps a download.
    function holds(modId) {
        return listOf(modId).length > 0;
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

    // Forgotten, and stopped first while it is under way. Answers whether there was one, once the state is written.
    async function remove(modId, id) {
        if (!find(modId, id)) return false;
        stop(modId, id);
        kept[modId] = listOf(modId).filter((download) => download.id !== String(id));
        await save();
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

    // The list written, answering once the state is. A write that fails is logged where it is kept.
    function save() {
        return STATE.write(KEY, kept);
    }

    function copy(download) {
        return { ...download };
    }

    return { start, shouldDownload, downloaded, forget, holds };
}
