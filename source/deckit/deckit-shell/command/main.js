import * as CHANNEL from '../deck/channel/index.js';
import * as IPC from '../deck/ipc/main.js';
import * as DECLARED from './protocol.js';
import * as TONE from './model/tone.js';

const PROTOCOL = CHANNEL.bindAll(IPC.ownChannels, DECLARED);

export function createCommand({ LOG, IDENTITY, CORE }) {
    // MARK: - Property
    // A mod that has not answered by then answers nothing, so one stuck page does not hold the others.
    const ANSWER_MS = 2000;
    const TONES = Object.freeze([...TONE.TONES]);
    let sessions = 0;
    let handed = 0; // entries handed out, by every session: an id one session handed out is never another's

    // MARK: - Initializer
    // MARK: - Public
    // What the mods offer to be run, asked by one caller of those that offered it as the session began: an entry runs
    // by the id its session handed out, until the session ends. Two callers' sessions never touch.
    async function session() {
        const sources = await CORE.request('command/sources');
        const number = ++sessions;
        const entries = new Map(); // entry id -> { mod, local }
        let ended = false;

        // An entry crosses as data, under an id handed out here: running it comes back by that id.
        const wire = (source, kind, entry) => {
            const id = String(++handed);
            const mod = { id: source.id, name: source.name };
            entries.set(id, { mod, local: entry.id });
            return { ...entry, id, kind, mod };
        };
        const ask = (end, mod, payload, fallback) =>
            ended ? Promise.resolve(fallback) : question(end, mod, { ...payload, session: number }, fallback);
        const offering = (what) => sources.filter((source) => source[what]);

        return Object.freeze({
            // Every offering mod's commands, in the load order.
            async list() {
                const asked = offering('commands');
                const answers = await Promise.all(asked.map((source) => ask(PROTOCOL.collect, source, {}, [])));
                return asked.flatMap((source, index) => answers[index].map((entry) => wire(source, 'command', entry)));
            },
            // A promise for each offering mod's readouts of what is happening now, which land as each mod answers.
            now() {
                return offering('now').map((source) =>
                    ask(PROTOCOL.collectNow, source, {}, []).then((rows) => rows.map((row) => wire(source, 'now', row)))
                );
            },
            // A promise for each answer to what the person typed, from each mod that resolves.
            resolve(raw) {
                return offering('resolve').map((source) =>
                    ask(PROTOCOL.resolve, source, { raw }, []).then((found) =>
                        found.map((entry) => wire(source, 'resolved', entry))
                    )
                );
            },
            // The entries of the submenu an entry opens, for what was typed in it; null for an entry with no submenu,
            // or a search a newer one replaced.
            async search(entryId, raw) {
                const opener = entries.get(entryId);
                if (!opener) return null;
                const found = await ask(PROTOCOL.search, opener.mod, { raw, submenu: opener.local }, null);
                return found && found.map((entry) => wire(opener.mod, 'submenu', entry));
            },
            // As if the person pressed in the mod's page: picking the entry was their press.
            async run(entryId) {
                const entry = entries.get(entryId);
                const page = !ended && entry && IDENTITY.pageOf(entry.mod.id);
                if (!page) return;
                IDENTITY.passUserActivation(page);
                await PROTOCOL.run.invoke(page, { session: number, id: entry.local });
            },
            // Its entries go, here and in the mods' pages.
            end() {
                if (ended) return;
                ended = true;
                entries.clear();
                for (const { id } of sources) {
                    const page = IDENTITY.pageOf(id);
                    if (page) PROTOCOL.end.send(page, { session: number });
                }
            },
        });
    }

    // MARK: - Private
    // What a mod's page answers; one that fails or went away answers `fallback`, recorded against it.
    function question(end, mod, payload, fallback) {
        const page = IDENTITY.pageOf(mod.id);
        if (!page) return Promise.resolve(fallback);
        return end.invoke(page, payload, { timeout: ANSWER_MS }).catch((error) => {
            LOG.warn(`${mod.id}: a question about its commands failed`, error);
            return fallback;
        });
    }

    return { TONES, session };
}
