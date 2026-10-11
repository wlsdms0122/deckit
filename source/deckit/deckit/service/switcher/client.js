DeckitModule.define(
    'deckit/service/switcher/client',
    {
        uses: ['deckit/service/home/model/config', 'deckit/service/switcher/model/protocol'],
        provides: ['register', 'arrange', 'listen', 'entries', 'TONES'],
    },
    (CONFIG, PROTOCOL) => {
        // Named rather than coloured by the plugin, so the strip has one scale (feature/switcher/view.js, NOW_TONE).
        const TONES = Object.freeze(['info', 'ok', 'warn', 'alert']);

        const sources = []; // in the order they registered
        const register = (source = {}) => {
            if (!source.id || sources.some((s) => s.id === source.id))
                return console.warn('[deckit] a switcher source needs an id of its own', source.id);
            const invalid =
                typeof source.invalid === 'function'
                    ? source.invalid
                    : (why) => console.warn(`[deckit] ${source.id}: ${why}`);
            sources.push({ ...source, invalid });
        };
        const arrange = (ids) => {
            const at = new Map([...ids].map((id, i) => [id, i]));
            const rank = (x) => (at.has(x.id) ? at.get(x.id) : Infinity);
            sources.sort((a, b) => rank(a) - rank(b));
        };

        const rawLoad = (key, fallback) => {
            try {
                const v = localStorage.getItem(key);
                return v === null ? fallback : JSON.parse(v);
            } catch {
                return fallback;
            }
        };
        const rawSave = (key, value) => {
            try {
                localStorage.setItem(key, JSON.stringify(value));
            } catch {}
        };

        // Keyed by id: the name may change and need not be unique.
        const owners = new WeakMap(); // source -> its owner
        const ownerOf = (source) => {
            if (!owners.has(source)) {
                owners.set(
                    source,
                    Object.freeze({
                        id: source.id,
                        name: source.name,
                        icon: source.icon,
                        aliases: (source.aliases || []).filter((w) => typeof w === 'string' && w),
                    })
                );
            }
            return owners.get(source);
        };
        const sourceOf = (owner) => sources.find((s) => s.id === owner.id);
        const strings = (list) => (Array.isArray(list) ? list : []).filter((w) => typeof w === 'string' && w);

        /* `plugin` is the owner handed in, never what the plugin says, and a group equal to the plugin's own
     name is dropped. An entry with no label is left out and reported to its source, rather than taking
     every other plugin's search down when the list reads it. */
        const entryFrom = (owner, cmd, kind, icon = owner.icon) => {
            if (!cmd || typeof cmd.label !== 'string' || !cmd.label) {
                sourceOf(owner)?.invalid(`a switcher entry needs a label (${kind})`);
                return null;
            }
            return {
                kind,
                plugin: owner,
                group: typeof cmd.group === 'string' && cmd.group !== owner.name ? cmd.group : '',
                label: cmd.label,
                hint: typeof cmd.hint === 'string' ? cmd.hint : '',
                icon: cmd.icon || icon,
                keywords: strings(cmd.keywords).join(' '),
                address: typeof cmd.address === 'string' ? cmd.address : '',
                run: typeof cmd.run === 'function' ? () => cmd.run() : undefined,
            };
        };

        // Keyed by plugin id, group and label, not object identity: commands() builds fresh objects on every open.
        const USE_KEY = CONFIG.id + ':switcher-use';
        const USE_KEPT = 60;
        const cmdKey = (c) => c.plugin.id + '\u0000' + c.group + '\u0000' + c.label;
        const uses = () => {
            const v = rawLoad(USE_KEY, {});
            return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
        };
        const frecency = (u) => {
            if (!u) return 0;
            const hours = (Date.now() - u.at) / 3.6e6;
            const weight = hours < 1 ? 4 : hours < 24 ? 2 : hours < 168 ? 1 : hours < 720 ? 0.5 : 0.2;
            // Too small to outweigh a use: it only breaks ties, the later first.
            return Math.min(u.n, 30) * weight + u.at / 1e15;
        };
        const remember = (c) => {
            const all = uses(),
                key = cmdKey(c);
            all[key] = { n: (all[key]?.n || 0) + 1, at: Date.now() };
            const kept = Object.entries(all)
                .sort((a, b) => frecency(b[1]) - frecency(a[1]))
                .slice(0, USE_KEPT);
            rawSave(USE_KEY, Object.fromEntries(kept));
        };

        const isPage = (page) => !!page && (typeof page.search === 'function' || typeof page.entries === 'function');

        const collectCommands = () => {
            const out = [];
            for (const source of sources) {
                const owner = ownerOf(source);
                // The source's names are aliases here, so a prefix of its name still finds it.
                if (typeof source.open === 'function') {
                    out.push({
                        ...entryFrom(owner, { label: 'Open ' + source.name }, 'command'),
                        aliases: [source.name, ...owner.aliases],
                        run: () => source.open(),
                    });
                }
                // Guarded by the registrant, so a throw costs this source's rows only.
                const offered = source.commands?.();
                for (const cmd of Array.isArray(offered) ? offered : []) {
                    if (!cmd || (typeof cmd.run !== 'function' && !isPage(cmd.page))) continue;
                    // Not revealing the plugin first: a command that wants to be seen calls host.show() itself.
                    const entry = entryFrom(owner, cmd, 'command');
                    if (entry) out.push({ ...entry, page: isPage(cmd.page) ? cmd.page : undefined });
                }
            }

            const all = uses();
            for (const c of out) c.used = frecency(all[cmdKey(c)]);
            return out;
        };

        // Taken round robin up to this cap, so a plugin with many rows loses its last ones rather than crowding others out.
        const NOW_MAX = 3;

        const nowRows = (source, rows) =>
            (rows || [])
                .map((cmd) => {
                    const entry = entryFrom(ownerOf(source), cmd, 'now');
                    return (
                        entry && {
                            ...entry,
                            tone: TONES.includes(cmd.tone) ? cmd.tone : 'info',
                            // An intent, not a style: the host decides how it is drawn, and that it stops.
                            attention: !!cmd.attention,
                        }
                    );
                })
                .filter(Boolean);

        const roundRobin = (buckets) => {
            const out = [];
            for (let depth = 0; out.length < NOW_MAX; depth++) {
                const round = buckets.filter((b) => b.length > depth);
                if (!round.length) break;
                for (const b of round) {
                    if (out.length >= NOW_MAX) break;
                    out.push(b[depth]);
                }
            }
            return out;
        };

        // `settled` is null when no now() returned a promise.
        const collectNow = () => {
            const buckets = [],
                pending = [];
            for (const source of sources) {
                const bucket = [];
                buckets.push(bucket);
                const answer = source.now?.();
                if (answer && typeof answer.then === 'function') {
                    pending.push(
                        answer.then(
                            (rows) => {
                                bucket.push(...nowRows(source, rows));
                            },
                            (e) => {
                                console.warn("[deckit] a switcher source's now() rejected", source.id, e);
                            }
                        )
                    );
                } else {
                    bucket.push(...nowRows(source, answer));
                }
            }
            return {
                rows: roundRobin(buckets),
                settled: pending.length ? Promise.all(pending).then(() => roundRobin(buckets)) : null,
            };
        };

        const answers = (owner, list) =>
            (list || [])
                .map((cmd) => {
                    const entry = entryFrom(owner, cmd, 'resolved');
                    return entry && { ...entry, fallback: !!cmd.fallback };
                })
                .filter(Boolean);
        const collectResolvers = () =>
            sources.flatMap((source) => {
                if (typeof source.resolve !== 'function') return [];
                const owner = ownerOf(source);
                const failed = (e) => {
                    source.invalid(`resolve() threw: ${(e && e.message) || e}`);
                    return [];
                };
                return [
                    (query) => {
                        let answer;
                        try {
                            answer = source.resolve(query);
                        } catch (e) {
                            return Promise.resolve(failed(e));
                        }
                        return Promise.resolve(answer).then((list) => answers(owner, list), failed);
                    },
                ];
            });

        /* The switcher's page has no plugins, so entries cross to it as data with an id, and running one
     comes back here by that id. */
        const switcherEntries = new Map(); // id -> the entry as it was built here
        let switcherSeq = 0,
            switcherSession = 0;

        const wireEntry = (item) => {
            const id = 'e' + ++switcherSeq;
            switcherEntries.set(id, item);
            return {
                id,
                runnable: typeof item.run === 'function' || !!item.page,
                // A page of entries() is ranked by the switcher; one with search() answers its own queries here.
                page: item.page
                    ? {
                          placeholder: String(item.page.placeholder || ''),
                          icon: item.plugin.icon || item.icon || '',
                          ranked: typeof item.page.entries === 'function',
                      }
                    : null,
                plugin: {
                    id: item.plugin.id,
                    name: item.plugin.name,
                    icon: item.plugin.icon,
                    aliases: item.plugin.aliases,
                },
                group: item.group,
                label: item.label,
                hint: item.hint,
                icon: item.icon,
                aliases: item.aliases || [],
                keywords: item.keywords || '',
                address: item.address || '',
                used: item.used || 0,
                tone: item.tone,
                attention: item.attention,
                fallback: item.fallback,
            };
        };

        const supplySwitcher = () => {
            const session = ++switcherSession;
            switcherEntries.clear(); // a new switcher, and the old ids name nothing
            const now = collectNow();
            PROTOCOL.offer.send({
                items: collectCommands().map(wireEntry),
                now: now.rows.map(wireEntry),
            });
            // Only to the switcher that asked: a slow answer after the next one opened is stale.
            now.settled?.then((rows) => {
                if (session !== switcherSession) return;
                PROTOCOL.offerNow.send({ rows: rows.map(wireEntry) });
            });
        };

        /* A superseded search is aborted and its answer never sent: the switcher keeps every answer by
     query, so a stale one would later stand as that query's answer. */
        const searching = new Map(); // page id -> the AbortController of its query in flight
        const searchPage = (raw, pageId) => {
            const opener = switcherEntries.get(pageId);
            const page = opener?.page;
            if (!page) return;
            searching.get(pageId)?.abort();
            const asked = new AbortController();
            searching.set(pageId, asked);
            const { signal } = asked;
            Promise.resolve()
                .then(() => (typeof page.search === 'function' ? page.search(raw, { signal }) : page.entries()))
                .catch((e) => {
                    if (signal.aborted) return null;
                    sourceOf(opener.plugin)?.invalid(
                        `the switcher page "${opener.label}" threw: ${(e && e.message) || e}`
                    );
                    return [];
                })
                .then((list) => {
                    if (signal.aborted) return;
                    if (searching.get(pageId) === asked) searching.delete(pageId);
                    const entries = (Array.isArray(list) ? list : [])
                        .map((cmd) => entryFrom(opener.plugin, cmd, 'page', opener.icon))
                        .filter(Boolean)
                        .map(wireEntry);
                    PROTOCOL.found.send({ raw, entries, page: pageId });
                });
        };

        const resolveSwitcher = (raw, pageId = null) => {
            if (pageId) return searchPage(raw, pageId);
            const asked = collectResolvers().map((resolve) => resolve(raw));
            /* Sent as each answer lands, so a slow resolver holds back nobody. A query with no answers still
       gets one empty reply: the switcher shows the previous query's entries until it hears otherwise. */
            const gathered = [];
            let left = asked.length;
            const answer = () => PROTOCOL.found.send({ raw, entries: gathered.map(wireEntry) });
            if (!left) return answer();
            for (const p of asked) {
                p.then((list) => {
                    left--;
                    gathered.push(...(list || []));
                    if ((list || []).length || !left) answer();
                });
            }
        };

        const runSwitcherEntry = (id) => {
            const item = switcherEntries.get(id);
            if (!item) return;
            // Only a command: a readout or a query's result is not something to run again.
            if (item.kind === 'command') remember(item);
            try {
                item.run?.();
            } catch (e) {
                console.warn('[deckit] switcher entry threw', item.label, e);
            }
        };

        // Heard only in the panel's page, where the sources are.
        const listen = () => {
            PROTOCOL.collect.hear(() => supplySwitcher());
            PROTOCOL.search.hear(({ raw, page }) => resolveSwitcher(raw, page || null));
            PROTOCOL.run.hear(({ id }) => runSwitcherEntry(id));
            // Called after every source is registered (feature/app/view.js), so main may now ask.
            PROTOCOL.listening.send();
        };

        // For the switcher's page.
        const entries = ({ supply, now, resolved }) => {
            PROTOCOL.supply.hear(supply);
            PROTOCOL.now.hear(({ rows }) => now(rows));
            PROTOCOL.resolved.hear(({ raw, entries: found, page }) => resolved(raw, found, page || null));
            return Object.freeze({
                need: () => PROTOCOL.need.send(),
                query: (raw, page) => PROTOCOL.query.send({ raw, page: page || null }),
                pick: (id) => PROTOCOL.pick.send({ id }),
            });
        };

        return { register, arrange, listen, entries, TONES };
    }
);
