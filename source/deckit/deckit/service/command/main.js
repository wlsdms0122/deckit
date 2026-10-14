DeckitModule.define(
    'deckit/service/command/main',
    {
        uses: [
            'deck/service/log/main',
            'deck/service/deck/identity',
            'deck/service/deck/catalog',
            'deck/service/deck/runner',
            'deckit/service/command/protocol',
            'deckit/service/command/model/tone',
        ],
        provides: ['start', 'TONES', 'session'],
    },
    (LOG, IDENTITY, CATALOG, RUNNER, PROTOCOL, TONE) => {
        // MARK: - Property
        // A mod that has not answered by then answers nothing, so one stuck page does not hold the others.
        const ANSWER_MS = 2000;
        const TONES = Object.freeze([...TONE.TONES]);
        const sources = new Map(); // mod id -> { resolves }
        let sessions = 0;

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.source.on((source, sender) => {
                const mod = IDENTITY.modFrom(sender);
                sources.set(mod.id, source);
                IDENTITY.whenPageEnds(sender, () => sources.get(mod.id) === source && sources.delete(mod.id));
            });
            // A run that has ended offers nothing, though its page may stay until the mod launches again.
            RUNNER.observe('didTerminate', ({ mod }) => sources.delete(mod.id));
        }

        // What the running mods offer to be run, asked by one caller: an entry runs by the id its session handed
        // out, until the session ends. Two callers' sessions never touch.
        function session() {
            const number = ++sessions;
            const entries = new Map(); // entry id -> { mod, local }
            let ended = false;

            // An entry crosses as data, under an id this side keeps: running it comes back by that id.
            const wire = (mod, kind, entry) => {
                const id = `${mod.id}:${entry.id}`;
                entries.set(id, { mod: mod.id, local: entry.id });
                return { ...entry, id, kind, mod: { id: mod.id, name: mod.name } };
            };
            const ask = (end, mod, payload, fallback) =>
                ended ? Promise.resolve(fallback) : question(end, mod, { ...payload, session: number }, fallback);

            return Object.freeze({
                // Every running mod's commands, in the mods' order.
                async list() {
                    const mods = running();
                    const answers = await Promise.all(mods.map((mod) => ask(PROTOCOL.collect, mod, {}, [])));
                    return mods.flatMap((mod, index) => answers[index].map((entry) => wire(mod, 'command', entry)));
                },
                // A promise for each running mod's readouts of what is happening now, which land as each mod answers.
                now() {
                    return running().map((mod) =>
                        ask(PROTOCOL.collectNow, mod, {}, []).then((rows) => rows.map((row) => wire(mod, 'now', row)))
                    );
                },
                // A promise for each answer to what the person typed, from each mod that resolves.
                resolve(raw) {
                    return running()
                        .filter((mod) => sources.get(mod.id).resolves)
                        .map((mod) =>
                            ask(PROTOCOL.resolve, mod, { raw }, []).then((found) =>
                                found.map((entry) => wire(mod, 'resolved', entry))
                            )
                        );
                },
                // The entries of the page an entry opens, for what was typed in it; null for an entry with no page,
                // or a search a newer one replaced.
                async search(entryId, raw) {
                    const opener = entries.get(entryId);
                    const mod = opener && CATALOG.mods().find(({ id }) => id === opener.mod);
                    if (!mod) return null;
                    const found = await ask(PROTOCOL.search, mod, { raw, page: opener.local }, null);
                    return found && found.map((entry) => wire(mod, 'page', entry));
                },
                // As if the person pressed in the mod's page: picking the entry was their press.
                async run(entryId) {
                    const entry = entries.get(entryId);
                    const page = !ended && entry && IDENTITY.pageOf(entry.mod);
                    if (!page) return;
                    IDENTITY.passUserActivation(page);
                    await PROTOCOL.run.invoke(page, { session: number, id: entry.local });
                },
                // Its entries go, here and in the mods' pages.
                end() {
                    if (ended) return;
                    ended = true;
                    entries.clear();
                    for (const id of sources.keys()) {
                        const page = IDENTITY.pageOf(id);
                        if (page) PROTOCOL.end.send(page, { session: number });
                    }
                },
            });
        }

        // MARK: - Private
        function running() {
            return CATALOG.mods().filter((mod) => sources.has(mod.id) && IDENTITY.pageOf(mod.id));
        }

        // What a mod's page answers; one that fails or went away answers `fallback`, recorded against it.
        function question(end, mod, payload, fallback) {
            const page = IDENTITY.pageOf(mod.id);
            if (!page) return Promise.resolve(fallback);
            return end.invoke(page, payload, { timeout: ANSWER_MS }).catch((error) => {
                LOG.warn(`${mod.id}: a question about its commands failed`, error);
                return fallback;
            });
        }

        return { start, TONES, session };
    }
);
