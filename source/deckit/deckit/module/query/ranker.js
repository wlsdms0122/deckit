DeckitModule.define(
    'deckit/module/query/ranker',
    {
        uses: ['deckit/module/query/match'],
        provides: ['ranker'],
        runs: 'page',
    },
    (MATCH) => {
        /* score, best, unranked and worker also run from their source in the worker, so they reach
     nothing but their arguments and MATCH. */
        const score = (names, from, to, query, match, paths, into) => {
            for (let i = from; i < to; i++) {
                const text = names[i];
                if (!paths) {
                    const m = match(text, query);
                    if (m) into.push({ text, inName: true, tier: m.tier, score: m.score });
                    continue;
                }
                const named = match(text.slice(text.lastIndexOf('/') + 1), query);
                const m = named || match(text, query);
                if (m) into.push({ text, inName: !!named, tier: m.tier, score: m.score });
            }
        };
        const best = (scored, limit) =>
            scored
                .sort(
                    (a, b) =>
                        b.inName - a.inName || b.tier - a.tier || b.score - a.score || a.text.length - b.text.length
                )
                .slice(0, limit)
                .map((x) => x.text);
        const unranked = (names, query, limit) => (String(query || '').trim() ? null : names.slice(0, limit));

        /* Between slices the worker hears newer asks, and an older ask of the same list is answered null.
     Every ask is answered, a failure included: a throw in this async handler would be a rejection
     the page never hears of, and the ask would wait forever. */
        const worker = () => {
            const { match } = MATCH;
            const SLICE = 3000;
            const lists = new Map();
            const newest = new Map(); // list -> its newest ask
            const between = () => new Promise((resolve) => setTimeout(resolve, 0));
            self.onmessage = async ({ data }) => {
                if (data.kind === 'list') {
                    lists.set(data.list, data.names);
                    return;
                }
                if (data.kind === 'drop') {
                    lists.delete(data.list);
                    newest.delete(data.list);
                    return;
                }
                const { ask, list, query, limit, paths } = data;
                newest.set(list, ask);
                try {
                    const names = lists.get(list) || [];
                    const plain = unranked(names, query, limit);
                    if (plain) {
                        self.postMessage({ ask, names: plain });
                        return;
                    }
                    const scored = [];
                    for (let from = 0; from < names.length; from += SLICE) {
                        score(names, from, Math.min(names.length, from + SLICE), query, match, paths, scored);
                        await between();
                        if (newest.get(list) !== ask) {
                            self.postMessage({ ask, names: null });
                            return;
                        }
                    }
                    self.postMessage({ ask, names: best(scored, limit) });
                } catch (e) {
                    self.postMessage({ ask, failed: String(e?.stack || e) });
                }
            };
        };

        let thread = null,
            broken = false;
        const waiting = new Map(); // ask -> resolve, for the answers still to come
        let asks = 0,
            lists = 0;
        const start = () => {
            if (thread || broken) return thread;
            try {
                const text =
                    MATCH.script +
                    `const score = ${score};\nconst best = ${best};\nconst unranked = ${unranked};\n(${worker})();`;
                thread = new Worker(URL.createObjectURL(new Blob([text], { type: 'text/javascript' })));
                // A failure in the worker is ranked again on the page, so it throws to the caller there.
                thread.onmessage = ({ data }) => {
                    const resolve = waiting.get(data.ask);
                    waiting.delete(data.ask);
                    if (data.failed)
                        console.warn('[deckit] ranking failed in the worker; ranking on the page', data.failed);
                    resolve?.(data.failed ? undefined : data.names);
                };
                // A worker that cannot run is not asked again; what is waiting is ranked on the page.
                thread.onerror = (e) => {
                    console.warn("[deckit] the ranker's worker failed; ranking on the page", e.message || e);
                    broken = true;
                    thread = null;
                    for (const resolve of waiting.values()) resolve(undefined);
                    waiting.clear();
                };
            } catch (e) {
                console.warn('[deckit] no worker for the ranker; ranking on the page', e);
                broken = true;
                thread = null;
            }
            return thread;
        };

        const ranker = ({ paths = false } = {}) => {
            const list = ++lists;
            let sent = null; // the array the worker holds for this ranker
            let latest = 0; // this ranker's newest ask
            const here = (names, query, limit) => {
                const plain = unranked(names, query, limit);
                if (plain) return plain;
                const scored = [];
                score(names, 0, names.length, query, MATCH.match, paths, scored);
                return best(scored, limit);
            };
            return Object.freeze({
                async rank(names, query, { limit = 50 } = {}) {
                    const ask = ++asks;
                    latest = ask;
                    const w = start();
                    let answer;
                    if (w) {
                        if (sent !== names) {
                            w.postMessage({ kind: 'list', list, names });
                            sent = names;
                        }
                        answer = await new Promise((resolve) => {
                            waiting.set(ask, resolve);
                            w.postMessage({ kind: 'rank', ask, list, query: String(query || ''), limit, paths });
                        });
                    }
                    if (latest !== ask) return null;
                    // No worker, or it failed while this was asked: ranked here.
                    return answer === undefined ? here(names, query, limit) : answer;
                },
                close() {
                    if (thread && sent) thread.postMessage({ kind: 'drop', list });
                    sent = null;
                },
            });
        };

        return Object.freeze({ ranker });
    }
);
