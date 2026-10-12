DeckitModule.define(
    'deckit/service/switcher/page',
    {
        uses: ['deckit/service/switcher/model/tone', 'deckit/service/switcher/protocol'],
        provides: ['source', 'list'],
    },
    (TONE, PROTOCOL) => {
        // MARK: - Property
        // The functions behind the entries handed out since the last collect: the list holds only their ids.
        const local = new Map(); // id -> { run, page }
        const searching = new Map(); // page id -> the AbortController of its query in flight
        let sequence = 0;

        // MARK: - Initializer
        // MARK: - Public
        // A plugin as a source of the switcher's entries. What it returns is checked here, and an entry with no label
        // is left out and told to `invalid` rather than taking every other plugin's search down. `open` is whether
        // the plugin has a screen to open.
        function source({ icon, aliases, open, commands, now, resolve, invalid }) {
            const strings = (list) =>
                Array.isArray(list) ? list.filter((word) => typeof word === 'string' && word) : [];
            PROTOCOL.source.send({
                icon: String(icon || ''),
                aliases: strings(aliases),
                opens: !!open,
                resolves: typeof resolve === 'function',
            });

            const entryOf = (command, kind) => {
                if (typeof command?.label !== 'string' || !command.label) {
                    invalid(`a switcher entry needs a label (${kind})`);
                    return null;
                }
                const id = 'entry-' + ++sequence;
                const page = isPage(command.page) ? command.page : null;
                local.set(id, { run: typeof command.run === 'function' ? command.run : null, page });
                return {
                    id,
                    group: typeof command.group === 'string' ? command.group : '',
                    label: command.label,
                    hint: typeof command.hint === 'string' ? command.hint : '',
                    icon: command.icon || icon || '',
                    keywords: strings(command.keywords).join(' '),
                    address: typeof command.address === 'string' ? command.address : '',
                    aliases: [],
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

            PROTOCOL.collect.handle(() => {
                local.clear();
                const offered = commands?.();
                return (Array.isArray(offered) ? offered : [])
                    .filter((command) => command && (typeof command.run === 'function' || isPage(command.page)))
                    .map((command) => entryOf(command, 'command'))
                    .filter(Boolean);
            });
            PROTOCOL.collectNow.handle(async () => {
                const rows = await now?.();
                return (Array.isArray(rows) ? rows : [])
                    .map((row) => {
                        const entry = entryOf(row, 'now');
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
            PROTOCOL.resolve.handle(async ({ raw }) => {
                const found = await resolve(raw);
                return (Array.isArray(found) ? found : [])
                    .map((command) => {
                        const entry = entryOf(command, 'resolved');
                        return entry && { ...entry, fallback: !!command.fallback };
                    })
                    .filter(Boolean);
            });
            // A search a newer one replaced is aborted and answers null, so its answer never stands for a query.
            PROTOCOL.search.handle(async ({ raw, page: id }) => {
                const page = local.get(id)?.page;
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
                return (Array.isArray(found) ? found : []).map((command) => entryOf(command, 'page')).filter(Boolean);
            });
            // What a command's run returns stays in the page: only that it ran crosses back.
            PROTOCOL.run.handle(async ({ id }) => {
                await local.get(id)?.run?.();
            });
        }

        // The switcher's list: what main supplies, and what the person types and picks.
        function list({ supply, now, resolved }) {
            PROTOCOL.supply.on(supply);
            PROTOCOL.now.on(({ rows }) => now(rows));
            PROTOCOL.resolved.on(({ raw, entries, page }) => resolved(raw, entries, page || null));
            return {
                need: () => PROTOCOL.need.send(),
                query: (raw, page) => PROTOCOL.query.send({ raw, page: page || null }),
                pick: (id) => PROTOCOL.pick.send({ id }),
            };
        }

        // MARK: - Private
        function isPage(page) {
            return !!page && (typeof page.search === 'function' || typeof page.entries === 'function');
        }

        return { source, list };
    }
);
