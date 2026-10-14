DeckitModule.define(
    'deckit-ui/feature/switcher/main',
    {
        uses: ['deckit-ui/feature/panel/main', 'deckit-ui/feature/switcher/protocol'],
        provides: ['start', 'reload', 'control'],
    },
    (PANEL, PROTOCOL) => {
        // MARK: - Property
        const PAGE = 'switcher';
        const USE = 'switcher-use';
        const USE_KEPT = 60;
        // Taken round robin up to this, so a mod with many rows loses its last ones rather than crowding others out.
        const NOW_MAX = 3;
        // How long the list waits for slow Now rows before it opens; later ones arrive on their own.
        const NOW_WAIT_MS = 150;
        // An entry that opens a mod is the switcher's own, under an id no mod's entry has.
        const OPEN = '@open:';
        const state = { view: null, on: false, ready: false, closed: null }; // `closed` resolves the open in progress
        const listed = new Map(); // entry id -> { mod, kind, group, label }, of what the list was last given
        let deckit = null;
        let bindingId = null; // the switcher's key in the keymap
        let session = 0;

        // MARK: - Initializer
        // MARK: - Public
        function start({ deckit: given, shell }) {
            deckit = given;
            bindingId = deckit.keymap.register({
                action: 'switcher',
                key: 'mod+shift+g',
                label: 'Quick switcher',
                global: true,
                run: (webContents) => shell.summonSwitcher(deckit.web.pageFor(webContents) || webContents),
            });
            PROTOCOL.ready.on((_payload, sender) => {
                if (sender !== state.view?.webContents) return;
                state.ready = true;
                // A chord that came while the page was loading is answered now instead of lost.
                if (state.on) PROTOCOL.open.send(sender, {});
            });
            PROTOCOL.close.on((_payload, sender) => sender === state.view?.webContents && close());
            PROTOCOL.need.on((_payload, sender) => sender === state.view?.webContents && supply());
            PROTOCOL.query.on(({ raw, page }, sender) => {
                if (sender !== state.view?.webContents) return;
                if (page) search(raw, page);
                else resolve(raw);
            });
            PROTOCOL.pick.on(({ id }, sender) => sender === state.view?.webContents && pick(id));
        }

        // A page made before a new theme is made again in it.
        function reload() {
            state.view?.webContents.reload();
        }

        // Resolves true when put away (the keyboard is the shell's to give back), false when it never opened or was
        // opened again during its exit.
        function open() {
            return new Promise((resolve) => {
                const view = build();
                state.closed?.(false);
                state.closed = resolve;
                state.on = true;
                view.setVisible(true);
                view.webContents.focus();
                if (state.ready) PROTOCOL.open.send(view.webContents, {});
            });
        }

        // Hidden only after the page has played its exit. Opened again during it, it stays up.
        function close() {
            if (!state.on) return;
            state.on = false;
            const closed = state.closed;
            state.closed = null;
            const contents = state.view.webContents;
            const token = PANEL.awaitReply(contents, PROTOCOL.hidden, () => {
                if (state.on) return closed?.(false);
                state.view?.setVisible(false);
                closed?.(true);
            });
            PROTOCOL.dismiss.send(contents, { token });
        }

        // MARK: - Private
        // Made the first time it is asked for. A page that reloads (a theme change reloads it) cannot hold an open list.
        function build() {
            if (state.view) return state.view;
            const view = deckit.pages.make(PAGE);
            const contents = view.webContents;
            deckit.keymap.listen(contents, {
                keys: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((number) => ({
                    key: 'mod+' + number,
                    run: () => PROTOCOL.number.send(contents, { number }),
                })),
            });
            deckit.log.guard(
                contents,
                'console-message',
                ({ level, message }) => level === 'error' && deckit.log.error(`switcher: ${message}`)
            );
            deckit.log.guard(contents, 'did-start-loading', () => {
                const was = state.ready;
                state.ready = false;
                // Only a page that was up: the first load starts after the first open, which must stay open.
                if (was) drop();
            });
            deckit.log.guard(
                contents,
                'destroyed',
                () => {
                    drop();
                    state.view = null;
                    state.ready = false;
                },
                { once: true }
            );
            view.setVisible(false);
            state.view = view;
            return view;
        }

        // For a page that is going: there is no exit to wait for.
        function drop() {
            if (!state.on) return;
            state.on = false;
            state.view?.setVisible(false);
            const closed = state.closed;
            state.closed = null;
            closed?.(true);
        }

        function list() {
            return state.view?.webContents || null;
        }

        // Every running mod's commands, each mod with a view opened by its name too, and what is happening now.
        async function supply() {
            const mine = ++session;
            listed.clear();
            const commands = await deckit.commands.list();
            if (mine !== session) return;
            const used = deckit.state.read(USE, {});
            // Each mod's own entry that opens it ahead of its commands.
            const opening = new Map(opens().map((entry) => [entry.mod.id, entry]));
            const items = deckit.mods
                .list()
                .flatMap(({ id }) => [
                    opening.get(id),
                    ...commands.filter((entry) => entry.mod.id === id).map(remembered),
                ])
                .filter(Boolean)
                .map((entry) => ({ ...entry, used: frecency(used[keyOf(listed.get(entry.id))]) }));
            const nows = deckit.commands.now();
            const buckets = nows.map(() => []);
            let late = false;
            const landed = nows.map((rows, index) =>
                rows.then((entries) => {
                    buckets[index] = entries.map(remembered);
                    if (mine === session && late && list()) PROTOCOL.now.send(list(), { rows: roundRobin(buckets) });
                })
            );
            await Promise.race([Promise.all(landed), new Promise((done) => setTimeout(done, NOW_WAIT_MS))]);
            late = true;
            if (mine !== session || !list()) return;
            PROTOCOL.supply.send(list(), { items, now: roundRobin(buckets) });
        }

        // The mod's names are aliases here, so a prefix of its name still finds it.
        function opens() {
            return deckit.mods
                .list()
                .filter(({ id }) => deckit.mods.runOf(id)?.state === 'running' && deckit.mods.runOf(id).summary.view)
                .map((mod) => ({ mod, source: deckit.commands.sourceOf(mod.id) }))
                .filter(({ source }) => source)
                .map(({ mod, source }) =>
                    remembered({
                        id: OPEN + mod.id,
                        kind: 'command',
                        label: 'Open ' + mod.name,
                        group: '',
                        hint: '',
                        icon: source.icon,
                        keywords: '',
                        address: '',
                        aliases: [mod.name, ...source.aliases],
                        runnable: true,
                        page: null,
                        mod: { id: mod.id, name: mod.name, ...source },
                    })
                );
        }

        // Each answer is sent as it lands, so a slow resolver holds back nobody. A query no one answers still gets one
        // empty reply: the list shows the last query's entries until it hears otherwise.
        function resolve(raw) {
            const answers = deckit.commands.resolve(raw);
            const gathered = [];
            let left = answers.length;
            const answer = () => list() && PROTOCOL.resolved.send(list(), { raw, entries: gathered });
            if (!left) return answer();
            for (const answering of answers) {
                answering.then((found) => {
                    left--;
                    gathered.push(...found.map(remembered));
                    if (found.length || !left) answer();
                });
            }
        }

        // A page of entries an entry opened, answered by its mod.
        async function search(raw, page) {
            const found = await deckit.commands.search(page, raw);
            if (found && list()) PROTOCOL.resolved.send(list(), { raw, entries: found.map(remembered), page });
        }

        // Only a command is remembered: a readout or a query's result is not something to run again.
        function pick(id) {
            const entry = listed.get(id);
            if (!entry) return;
            if (entry.kind === 'command') remember(entry);
            if (id.startsWith(OPEN)) return PANEL.reveal(entry.mod);
            deckit.commands.run(id).catch((error) => deckit.log.warn(`${entry.mod}: a switcher entry failed`, error));
        }

        // What the list is handed, kept to remember it by when it is picked.
        function remembered(entry) {
            listed.set(entry.id, { mod: entry.mod.id, kind: entry.kind, group: entry.group, label: entry.label });
            return entry;
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

        // Keyed by mod, group and label, not by an entry's id: commands are made fresh on every open.
        function keyOf({ mod, group, label }) {
            return `${mod}\u0000${group}\u0000${label}`;
        }

        // Too small to outweigh a use, the time only breaks ties, the later first.
        function frecency(use) {
            if (!use) return 0;
            const hours = (Date.now() - use.at) / 3.6e6;
            const weight = hours < 1 ? 4 : hours < 24 ? 2 : hours < 168 ? 1 : hours < 720 ? 0.5 : 0.2;
            return Math.min(use.count, 30) * weight + use.at / 1e15;
        }

        function remember(entry) {
            const used = deckit.state.read(USE, {});
            const key = keyOf(entry);
            used[key] = { count: (used[key]?.count || 0) + 1, at: Date.now() };
            const kept = Object.entries(used)
                .sort((a, b) => frecency(b[1]) - frecency(a[1]))
                .slice(0, USE_KEPT);
            deckit.state.write(USE, Object.fromEntries(kept));
        }

        return {
            start,
            reload,
            // What the shell drives of it.
            control: {
                view: build,
                open,
                close,
                shown: () => state.on,
                // The chord that summons it now, as a person reads it, or '' when it has none.
                chord: () => deckit.keymap.chordOf(bindingId),
            },
        };
    }
);
