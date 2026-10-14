DeckitModule.define(
    'deckit/service/command/main',
    {
        uses: [
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/deck/catalog',
            'deckit/service/command/protocol',
        ],
        provides: ['start', 'sourceOf', 'list', 'now', 'resolve', 'search', 'run'],
    },
    (LOG, IDENTITY, CATALOG, PROTOCOL) => {
        // MARK: - Property
        // A mod that has not answered by then answers nothing, so one stuck page does not hold the others.
        const ANSWER_MS = 2000;
        const sources = new Map(); // mod id -> { icon, aliases, resolves }
        const entries = new Map(); // entry id -> { mod, local }

        // MARK: - Initializer
        // MARK: - Public
        function start() {
            PROTOCOL.source.on((source, sender) => {
                const mod = IDENTITY.modFrom(sender);
                sources.set(mod.id, source);
                IDENTITY.whenPageEnds(sender, () => sources.get(mod.id) === source && sources.delete(mod.id));
            });
        }

        // What a running mod says of itself as a source of commands: { icon, aliases }, or null.
        function sourceOf(modId) {
            const source = sources.get(modId);
            return source && IDENTITY.pageOf(modId) ? { icon: source.icon, aliases: source.aliases } : null;
        }

        // Every running mod's commands, in the mods' order. Each list starts over: an entry handed out before it is
        // not run.
        async function list() {
            entries.clear();
            const mods = running();
            const answers = await Promise.all(mods.map((mod) => ask(PROTOCOL.collect, mod, {}, [])));
            return mods.flatMap((mod, index) => answers[index].map((entry) => wire(mod, 'command', entry)));
        }

        // A promise for each running mod's readouts of what is happening now, which land as each mod answers.
        function now() {
            return running().map((mod) =>
                ask(PROTOCOL.collectNow, mod, {}, []).then((rows) => rows.map((row) => wire(mod, 'now', row)))
            );
        }

        // A promise for each answer to what the person typed, from each mod that resolves.
        function resolve(raw) {
            return running()
                .filter((mod) => sources.get(mod.id).resolves)
                .map((mod) =>
                    ask(PROTOCOL.resolve, mod, { raw }, []).then((found) =>
                        found.map((entry) => wire(mod, 'resolved', entry))
                    )
                );
        }

        // The entries of the page an entry opens, for what was typed in it; null for an entry with no page, or a
        // search a newer one replaced.
        async function search(entryId, raw) {
            const opener = entries.get(entryId);
            const mod = opener && CATALOG.mods().find(({ id }) => id === opener.mod);
            if (!mod) return null;
            const found = await ask(PROTOCOL.search, mod, { raw, page: opener.local }, null);
            return found && found.map((entry) => wire(mod, 'page', entry));
        }

        // As if the person pressed in the mod's page: picking the entry was their press.
        async function run(entryId) {
            const entry = entries.get(entryId);
            const page = entry && IDENTITY.pageOf(entry.mod);
            if (!page) return;
            IDENTITY.passUserActivation(page);
            await PROTOCOL.run.invoke(page, { id: entry.local });
        }

        // MARK: - Private
        function running() {
            return CATALOG.mods().filter((mod) => sources.has(mod.id) && IDENTITY.pageOf(mod.id));
        }

        // An entry crosses as data, under an id this side keeps: running it comes back by that id.
        function wire(mod, kind, entry) {
            const id = `${mod.id}:${entry.id}`;
            const { icon, aliases } = sources.get(mod.id);
            entries.set(id, { mod: mod.id, local: entry.id });
            return { ...entry, id, kind, mod: { id: mod.id, name: mod.name, icon, aliases } };
        }

        // What a mod's page answers; one that fails or went away answers `fallback`, recorded against it.
        function ask(end, mod, payload, fallback) {
            const page = IDENTITY.pageOf(mod.id);
            if (!page) return Promise.resolve(fallback);
            return end.invoke(page, payload, { timeout: ANSWER_MS }).catch((error) => {
                LOG.warn(`${mod.id}: a question about its commands failed`, error);
                return fallback;
            });
        }

        return { start, sourceOf, list, now, resolve, search, run };
    }
);
