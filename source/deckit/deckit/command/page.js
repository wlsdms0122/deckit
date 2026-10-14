DeckitModule.define(
    'deckit/command/page',
    {
        uses: ['deckit/command/model/tone', 'deckit/command/protocol'],
        provides: ['source'],
    },
    (TONE, PROTOCOL) => {
        // MARK: - Property
        // The functions behind the entries each session was handed, which holds only their ids, until it ends.
        const sessions = new Map(); // session -> Map of id -> { run, page }
        const ended = new Set(); // sessions whose late answers keep nothing
        const searching = new Map(); // page id -> the AbortController of its query in flight
        let sequence = 0;

        // MARK: - Initializer
        // MARK: - Public
        // A mod as a source of commands. What it returns is checked here, and an entry with no label is left out and
        // told to `invalid` rather than taking every other mod's search down.
        // `icon` is the mod's, which an entry with none of its own is drawn with.
        function source({ icon, commands, now, resolve, invalid }) {
            const strings = (list) =>
                Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
            PROTOCOL.source.send({ resolves: typeof resolve === 'function' });

            const entryOf = (session, command, kind) => {
                if (typeof command?.label !== 'string' || !command.label) {
                    invalid(`a command needs a label (${kind})`);
                    return null;
                }
                const id = 'entry-' + ++sequence;
                const page = isPage(command.page) ? command.page : null;
                localOf(session).set(id, { run: typeof command.run === 'function' ? command.run : null, page });
                return {
                    id,
                    group: typeof command.group === 'string' ? command.group : '',
                    label: command.label,
                    hint: typeof command.hint === 'string' ? command.hint : '',
                    icon: command.icon || icon || '',
                    keywords: strings(command.keywords).join(' '),
                    address: typeof command.address === 'string' ? command.address : '',
                    runnable: typeof command.run === 'function' || !!page,
                    page: page
                        ? {
                              placeholder: String(page.placeholder || ''),
                              icon: icon || '',
                              ranked: typeof page.entries === 'function',
                          }
                        : null,
                };
            };

            PROTOCOL.collect.handle(({ session }) => {
                const offered = commands?.();
                return (Array.isArray(offered) ? offered : [])
                    .filter((command) => command && (typeof command.run === 'function' || isPage(command.page)))
                    .map((command) => entryOf(session, command, 'command'))
                    .filter(Boolean);
            });
            PROTOCOL.collectNow.handle(async ({ session }) => {
                const rows = await now?.();
                return (Array.isArray(rows) ? rows : [])
                    .map((row) => {
                        const entry = entryOf(session, row, 'now');
                        // An intent, not a style: the list decides how it is drawn, and that it stops.
                        return (
                            entry && {
                                ...entry,
                                tone: TONE.TONES.includes(row.tone) ? row.tone : 'info',
                                attention: !!row.attention,
                            }
                        );
                    })
                    .filter(Boolean);
            });
            PROTOCOL.resolve.handle(async ({ session, raw }) => {
                const found = await resolve(raw);
                return (Array.isArray(found) ? found : [])
                    .map((command) => {
                        const entry = entryOf(session, command, 'resolved');
                        return entry && { ...entry, fallback: !!command.fallback };
                    })
                    .filter(Boolean);
            });
            // A search a newer one replaced is aborted and answers null, so its answer never stands for a query.
            PROTOCOL.search.handle(async ({ session, raw, page: id }) => {
                const page = sessions.get(session)?.get(id)?.page;
                if (!page) return null;
                searching.get(id)?.abort();
                const asked = new AbortController();
                searching.set(id, asked);
                const found =
                    typeof page.search === 'function'
                        ? await page.search(raw, { signal: asked.signal })
                        : await page.entries();
                if (asked.signal.aborted) return null;
                searching.delete(id);
                return (Array.isArray(found) ? found : [])
                    .map((command) => entryOf(session, command, 'page'))
                    .filter(Boolean);
            });
            // What a command's run returns stays in the page: only that it ran crosses back.
            PROTOCOL.run.handle(async ({ session, id }) => {
                await sessions.get(session)?.get(id)?.run?.();
            });
            PROTOCOL.end.on(({ session }) => {
                sessions.delete(session);
                ended.add(session);
            });
        }

        // MARK: - Private
        // A session that ended keeps nothing an answer still on its way hands out.
        function localOf(session) {
            if (ended.has(session)) return new Map();
            if (!sessions.has(session)) sessions.set(session, new Map());
            return sessions.get(session);
        }

        function isPage(page) {
            return !!page && (typeof page.search === 'function' || typeof page.entries === 'function');
        }

        return { source };
    }
);
