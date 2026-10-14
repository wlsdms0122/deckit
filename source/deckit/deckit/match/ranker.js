import * as MATCH from './match.js';

// MARK: - Property
const waiting = new Map(); // ask -> resolve, for the answers still to come
let worker = null;
let failure = null; // what the worker failed with; a failed worker is not made again
let lastAsk = 0;
let lastList = 0;

// MARK: - Initializer
// MARK: - Public
// A newer ask of the same ranker answers the older ones with null.
function ranker({ paths = false } = {}) {
    const list = ++lastList;
    let sent = null; // the array the worker holds for this ranker
    let latest = 0; // this ranker's newest ask

    async function rank(names, query, { limit = 50 } = {}) {
        const ask = ++lastAsk;
        latest = ask;
        const running = start();
        if (sent !== names) {
            running.postMessage({ kind: 'list', list, names });
            sent = names;
        }
        const answer = await new Promise((resolve) => {
            waiting.set(ask, resolve);
            running.postMessage({ kind: 'rank', ask, list, query: String(query || ''), limit, paths });
        });
        if (latest !== ask) return null;
        if (answer.error) throw answer.error;
        return answer.names;
    }

    function close() {
        if (worker && sent) worker.postMessage({ kind: 'drop', list });
        sent = null;
    }

    return Object.freeze({ rank, close });
}

// MARK: - Private
function start() {
    if (failure) throw failure;
    if (worker) return worker;
    const source = `${MATCH.script}\n${score}\n${best}\n${listUnranked}\n(${serve})();`;
    worker = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    worker.onmessage = ({ data }) => {
        const resolve = waiting.get(data.ask);
        waiting.delete(data.ask);
        // A worker that failed is let go with its asks answered, though it may still post.
        resolve?.(
            data.failed
                ? { error: new Error(`[deckit] ranking failed in the worker: ${data.failed}`) }
                : { names: data.names }
        );
    };
    worker.onerror = (event) => {
        failure = new Error(`[deckit] the ranker's worker failed: ${event.message || 'it did not load'}`);
        worker = null;
        for (const resolve of waiting.values()) resolve({ error: failure });
        waiting.clear();
    };
    return worker;
}

// score, best, listUnranked and serve run from their source in the worker, so they reach nothing but their
// arguments and MATCH.
function score(names, from, to, query, match, paths, into) {
    for (let index = from; index < to; index++) {
        const text = names[index];
        if (!paths) {
            const found = match(text, query);
            if (found) into.push({ text, inName: true, tier: found.tier, score: found.score });
            continue;
        }
        const named = match(text.slice(text.lastIndexOf('/') + 1), query);
        const found = named || match(text, query);
        if (found) into.push({ text, inName: !!named, tier: found.tier, score: found.score });
    }
}

function best(scored, limit) {
    return scored
        .sort(
            (left, right) =>
                right.inName - left.inName ||
                right.tier - left.tier ||
                right.score - left.score ||
                left.text.length - right.text.length
        )
        .slice(0, limit)
        .map((entry) => entry.text);
}

function listUnranked(names, query, limit) {
    return String(query || '').trim() ? null : names.slice(0, limit);
}

// Between slices the worker hears newer asks, and an older ask of the same list is answered null. Every ask
// is answered, a failure included: a throw in this async handler would be a rejection the page never hears
// of, and the ask would wait forever.
function serve() {
    const { match } = MATCH;
    const SLICE = 3000;
    const lists = new Map();
    const newest = new Map(); // list -> its newest ask
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
            const plain = listUnranked(names, query, limit);
            if (plain) {
                self.postMessage({ ask, names: plain });
                return;
            }
            const scored = [];
            for (let from = 0; from < names.length; from += SLICE) {
                score(names, from, Math.min(names.length, from + SLICE), query, match, paths, scored);
                await pause();
                if (newest.get(list) !== ask) {
                    self.postMessage({ ask, names: null });
                    return;
                }
            }
            self.postMessage({ ask, names: best(scored, limit) });
        } catch (error) {
            self.postMessage({ ask, failed: String(error?.stack || error) });
        }
    };

    function pause() {
        return new Promise((resolve) => setTimeout(resolve, 0));
    }
}

export { ranker };
