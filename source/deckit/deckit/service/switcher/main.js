DeckitModule.define(
    'deckit/service/switcher/main',
    {
        uses: [
            'deckit/service/storage',
            'deckit/service/log/main',
            'deckit/service/deck/identity',
            'deckit/service/deck/catalog',
            'deckit/service/switcher/protocol',
        ],
        provides: ['start'],
    },
    (STORAGE, LOG, IDENTITY, CATALOG, PROTOCOL) => {
        // MARK: - Property
        const USE = 'switcher-use';
        const USE_KEPT = 60;
        // Taken round robin up to this, so a plugin with many rows loses its last ones rather than crowding others out.
        const NOW_MAX = 3;
        // How long the list waits for slow Now rows before it opens; later ones arrive on their own.
        const NOW_WAIT_MS = 150;
        // A plugin that has not answered by then answers nothing, so one stuck page does not hold the list.
        const ANSWER_MS = 2000;
        const sources = new Map(); // plugin id -> { icon, aliases, opens, resolves }
        const entries = new Map(); // entry id -> { plugin, local, kind, group, label }
        let session = 0;
        let hooks = { list: () => null, reveal: () => {} };

        // MARK: - Initializer
        // MARK: - Public
        // `list` is the switcher's webContents; `reveal` puts a plugin on screen.
        function start({ list, reveal }) {
            hooks = { list, reveal };
            PROTOCOL.source.on((source, sender) => {
                const plugin = IDENTITY.pluginFrom(sender);
                sources.set(plugin.id, source);
                IDENTITY.whenPageEnds(sender, () => sources.get(plugin.id) === source && sources.delete(plugin.id));
            });
            PROTOCOL.need.on((_payload, sender) => IDENTITY.isSwitcher(sender) && supply());
            PROTOCOL.query.on(
                ({ raw, page }, sender) => IDENTITY.isSwitcher(sender) && (page ? search(raw, page) : resolve(raw))
            );
            PROTOCOL.pick.on(({ id }, sender) => IDENTITY.isSwitcher(sender) && pick(id));
        }

        // MARK: - Private
        function running() {
            return CATALOG.plugins().filter((plugin) => sources.has(plugin.id) && IDENTITY.pageOf(plugin.id));
        }

        function ownerOf(plugin) {
            const { icon, aliases } = sources.get(plugin.id);
            return { id: plugin.id, name: plugin.name, icon, aliases };
        }

        // An entry crosses to the list as data, under an id this side keeps: picking it comes back by that id.
        function wire(plugin, kind, entry) {
            const id = `${plugin.id}:${entry.id}`;
            entries.set(id, { plugin: plugin.id, local: entry.id, kind, group: entry.group, label: entry.label });
            return { ...entry, id, kind, plugin: ownerOf(plugin) };
        }

        async function supply() {
            const mine = ++session;
            entries.clear();
            const plugins = running();
            const commands = await Promise.all(plugins.map((plugin) => ask(PROTOCOL.collect, plugin, {}, [])));
            const used = STORAGE.state.read(USE, {});
            const items = plugins.flatMap((plugin, index) => {
                const owner = ownerOf(plugin);
                // The plugin's names are aliases here, so a prefix of its name still finds it.
                const open = sources.get(plugin.id).opens
                    ? [
                          {
                              id: 'open',
                              label: 'Open ' + plugin.name,
                              group: '',
                              hint: '',
                              icon: owner.icon,
                              keywords: '',
                              address: '',
                              aliases: [plugin.name, ...owner.aliases],
                              runnable: true,
                          },
                      ]
                    : [];
                return [...open, ...commands[index]].map((entry) => {
                    const wired = wire(plugin, 'command', entry);
                    return { ...wired, used: frecency(used[keyOf(entries.get(wired.id))]) };
                });
            });
            const buckets = plugins.map(() => []);
            let late = false;
            const asked = plugins.map((plugin, index) =>
                ask(PROTOCOL.collectNow, plugin, {}, []).then((rows) => {
                    buckets[index] = rows.map((row) => wire(plugin, 'now', row));
                    if (mine === session && late) PROTOCOL.now.send(hooks.list(), { rows: roundRobin(buckets) });
                })
            );
            await Promise.race([Promise.all(asked), new Promise((done) => setTimeout(done, NOW_WAIT_MS))]);
            late = true;
            if (mine !== session || !hooks.list()) return;
            PROTOCOL.supply.send(hooks.list(), { items, now: roundRobin(buckets) });
        }

        // Each answer is sent as it lands, so a slow resolver holds back nobody. A query no one answers still gets one
        // empty reply: the list shows the last query's entries until it hears otherwise.
        function resolve(raw) {
            const plugins = running().filter((plugin) => sources.get(plugin.id).resolves);
            const gathered = [];
            let left = plugins.length;
            const answer = () => PROTOCOL.resolved.send(hooks.list(), { raw, entries: gathered });
            if (!left) return answer();
            for (const plugin of plugins) {
                ask(PROTOCOL.resolve, plugin, { raw }, []).then((found) => {
                    left--;
                    gathered.push(...found.map((entry) => wire(plugin, 'resolved', entry)));
                    if (found.length || !left) answer();
                });
            }
        }

        // A page of entries an entry opened, answered by its plugin.
        function search(raw, page) {
            const opener = entries.get(page);
            if (!opener) return;
            const plugin = CATALOG.plugins().find(({ id }) => id === opener.plugin);
            ask(PROTOCOL.search, plugin, { raw, page: opener.local }, null).then((found) => {
                if (found)
                    PROTOCOL.resolved.send(hooks.list(), {
                        raw,
                        entries: found.map((entry) => wire(plugin, 'page', entry)),
                        page,
                    });
            });
        }

        function pick(id) {
            const entry = entries.get(id);
            if (!entry) return;
            // Only a command is remembered: a readout or a query's result is not something to run again.
            if (entry.kind === 'command') remember(entry);
            if (entry.local === 'open') return hooks.reveal(entry.plugin);
            const view = IDENTITY.pageOf(entry.plugin);
            if (!view) return;
            IDENTITY.passUserActivation(view);
            PROTOCOL.run
                .invoke(view, { id: entry.local })
                .catch((error) => LOG.warn(`${entry.plugin}: a switcher entry failed`, error));
        }

        // What a plugin's view answers; one that fails or went away answers `fallback`, recorded against it.
        function ask(end, plugin, payload, fallback) {
            const view = IDENTITY.pageOf(plugin.id);
            if (!view) return Promise.resolve(fallback);
            return end.invoke(view, payload, { timeout: ANSWER_MS }).catch((error) => {
                LOG.warn(`${plugin.id}: the switcher's question failed`, error);
                return fallback;
            });
        }

        function roundRobin(buckets) {
            const out = [];
            for (let depth = 0; out.length < NOW_MAX; depth++) {
                const round = buckets.filter((bucket) => bucket.length > depth);
                if (!round.length) break;
                for (const bucket of round) if (out.length < NOW_MAX) out.push(bucket[depth]);
            }
            return out;
        }

        // Keyed by plugin, group and label, not by an entry's id: commands are made fresh on every open.
        function keyOf({ plugin, group, label }) {
            return `${plugin}\u0000${group}\u0000${label}`;
        }

        // Too small to outweigh a use, the time only breaks ties, the later first.
        function frecency(use) {
            if (!use) return 0;
            const hours = (Date.now() - use.at) / 3.6e6;
            const weight = hours < 1 ? 4 : hours < 24 ? 2 : hours < 168 ? 1 : hours < 720 ? 0.5 : 0.2;
            return Math.min(use.count, 30) * weight + use.at / 1e15;
        }

        function remember(entry) {
            const used = STORAGE.state.read(USE, {});
            const key = keyOf(entry);
            used[key] = { count: (used[key]?.count || 0) + 1, at: Date.now() };
            const kept = Object.entries(used)
                .sort((a, b) => frecency(b[1]) - frecency(a[1]))
                .slice(0, USE_KEPT);
            STORAGE.state.write(USE, Object.fromEntries(kept));
        }

        return { start };
    }
);
