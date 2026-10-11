DeckitModule.define(
    'deckit/module/query/match',
    {
        uses: [],
        provides: ['TIER', 'match', 'matchFields', 'script'],
        runs: 'any',
    },
    () => {
        // Also run from its own source in the ranker's worker (`script`), so it reaches nothing outside.
        function deckitMatch() {
            /* The tier decides before the score, so the order stays predictable. EXACT: the whole text.
       PREFIX: its start. WORD: at a word start, or the words' initials. INSIDE: elsewhere in it.
       SPREAD: its letters in order, apart. */
            const TIER = Object.freeze({ EXACT: 5, PREFIX: 4, WORD: 3, INSIDE: 2, SPREAD: 1 });

            const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅ' + 'ㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
            const isSyllable = (c) => c >= '가' && c <= '힣';
            const isJamo = (c) => c >= 'ㄱ' && c <= 'ㅎ';
            const initialOf = (c) => CHOSEONG[Math.floor((c.charCodeAt(0) - 0xac00) / 588)];
            // `q` is lower case. A bare consonant matches a syllable that starts with it.
            const same = (t, q) => t === q || (isJamo(q) && isSyllable(t) && initialOf(t) === q);

            /* A syllable being typed borrows the next one's first consonant ("브라" passes through "블"), so
       a last final consonant is also tried let go. By the final's index: [the final left on the
       syllable, the consonant starting the next]. A double final splits as the keyboard splits it. */
            const LET_GO = {
                1: [0, 'ㄱ'],
                2: [0, 'ㄲ'],
                3: [1, 'ㅅ'],
                4: [0, 'ㄴ'],
                5: [4, 'ㅈ'],
                6: [4, 'ㅎ'],
                7: [0, 'ㄷ'],
                8: [0, 'ㄹ'],
                9: [8, 'ㄱ'],
                10: [8, 'ㅁ'],
                11: [8, 'ㅂ'],
                12: [8, 'ㅅ'],
                13: [8, 'ㅌ'],
                14: [8, 'ㅍ'],
                15: [8, 'ㅎ'],
                16: [0, 'ㅁ'],
                17: [0, 'ㅂ'],
                18: [17, 'ㅅ'],
                19: [0, 'ㅅ'],
                20: [0, 'ㅆ'],
                21: [0, 'ㅇ'],
                22: [0, 'ㅈ'],
                23: [0, 'ㅊ'],
                24: [0, 'ㅋ'],
                25: [0, 'ㅌ'],
                26: [0, 'ㅍ'],
                27: [0, 'ㅎ'],
            };
            const typing = (word) => {
                const last = word[word.length - 1];
                if (!last || !isSyllable(last)) return null;
                const code = last.charCodeAt(0) - 0xac00,
                    final = code % 28;
                if (!final) return null;
                const [keep, next] = LET_GO[final];
                return word.slice(0, -1) + String.fromCharCode(0xac00 + code - final + keep) + next;
            };

            const kindOf = (c) =>
                isSyllable(c) || isJamo(c)
                    ? 'han'
                    : /[a-z]/.test(c)
                      ? 'lower'
                      : /[A-Z]/.test(c)
                        ? 'upper'
                        : /[0-9]/.test(c)
                          ? 'digit'
                          : 'other';
            // Where a word starts: the text's start, after a separator, a lower-to-upper step, Hangul meeting Latin.
            const starts = (text) => {
                const at = new Array(text.length).fill(false);
                for (let i = 0; i < text.length; i++) {
                    if (i === 0) {
                        at[i] = kindOf(text[0]) !== 'other';
                        continue;
                    }
                    const a = kindOf(text[i - 1]),
                        b = kindOf(text[i]);
                    if (b === 'other') continue;
                    at[i] =
                        a === 'other' ||
                        (a === 'lower' && b === 'upper') ||
                        ((a === 'han') !== (b === 'han') && a !== 'digit' && b !== 'digit');
                }
                return at;
            };
            // Word starts are worked out lazily: most texts fail inOrder first.
            const prepare = (text) => {
                const t = typeof text === 'string' ? text : '';
                let bounds = null;
                return {
                    lower: t.toLowerCase(),
                    get bounds() {
                        return bounds || (bounds = starts(t));
                    },
                };
            };

            // A cheap filter before the table: most texts fail it.
            const inOrder = (lower, word) => {
                let j = 0,
                    q = word[0];
                for (let i = 0; i < lower.length; i++) {
                    const t = lower[i];
                    if (t === q || (isJamo(q) && isSyllable(t) && initialOf(t) === q)) {
                        if (++j === word.length) return true;
                        q = word[j];
                    }
                }
                return false;
            };

            const MATCH = 16,
                BOUNDARY = 10,
                FIRST = 4,
                RUN = 6,
                GAP_OPEN = 3,
                GAP_EACH = 1;

            /* A gap costs GAP_OPEN plus GAP_EACH per letter after the first. The best
       place to jump from is kept as its score plus its place times GAP_EACH, so one comparison finds
       it and the table stays word length by text length. */
            const place = (p, word) => {
                const { lower } = p,
                    bounds = p.bounds;
                const n = lower.length,
                    m = word.length;
                let prev = new Array(n).fill(-Infinity);
                const from = [];
                for (let i = 0; i < m; i++) {
                    const cur = new Array(n).fill(-Infinity),
                        back = new Array(n).fill(-1);
                    let reach = -Infinity,
                        reachAt = -1;
                    for (let j = 0; j < n; j++) {
                        const k = j - 2; // the latest place a jump to j can start from: one letter skipped
                        if (i > 0 && k >= 0 && prev[k] > -Infinity && prev[k] + k * GAP_EACH > reach) {
                            reach = prev[k] + k * GAP_EACH;
                            reachAt = k;
                        }
                        if (!same(lower[j], word[i])) continue;
                        const gain = MATCH + (bounds[j] ? BOUNDARY : 0) + (i === 0 && j === 0 ? FIRST : 0);
                        if (i === 0) {
                            cur[j] = gain - Math.min(j, 8) * 0.5;
                            continue;
                        }
                        const run = j >= 1 && prev[j - 1] > -Infinity ? prev[j - 1] + gain + RUN : -Infinity;
                        // From reachAt, skipping j - reachAt - 1 letters: GAP_OPEN + (j - reachAt - 2) · GAP_EACH.
                        const jump = reachAt >= 0 ? reach - (j - 2) * GAP_EACH - GAP_OPEN + gain : -Infinity;
                        if (run >= jump && run > -Infinity) {
                            cur[j] = run;
                            back[j] = j - 1;
                        } else if (jump > -Infinity) {
                            cur[j] = jump;
                            back[j] = reachAt;
                        }
                    }
                    from.push(back);
                    prev = cur;
                }
                let end = -1,
                    score = -Infinity;
                for (let j = 0; j < n; j++)
                    if (prev[j] > score) {
                        score = prev[j];
                        end = j;
                    }
                if (end < 0) return null;
                const at = new Array(m);
                for (let i = m - 1, j = end; i >= 0; i--) {
                    at[i] = j;
                    j = from[i][j];
                }
                return { score, at };
            };

            const together = (at) => at.every((j, k) => k === 0 || j === at[k - 1] + 1);
            const tierOf = (at, p) => {
                const { lower } = p,
                    bounds = p.bounds;
                if (together(at)) {
                    if (at[0] === 0) return at.length === lower.length ? TIER.EXACT : TIER.PREFIX;
                    return bounds[at[0]] ? TIER.WORD : TIER.INSIDE;
                }
                // Every letter at the start of a word, the first at the first word: the word's initials.
                return at.every((j) => bounds[j]) && at[0] === bounds.indexOf(true) ? TIER.WORD : TIER.SPREAD;
            };

            const plainly = (p, word) => {
                const { lower } = p,
                    bounds = p.bounds;
                let first = -1;
                for (let k = lower.indexOf(word); k >= 0; k = lower.indexOf(word, k + 1)) {
                    if (first < 0) first = k;
                    if (bounds[k]) {
                        first = k;
                        break;
                    }
                }
                return first < 0 ? null : Array.from({ length: word.length }, (_, k) => first + k);
            };

            /* Both the plain occurrence and the table's best placing are tried, the better tier winning: the
       table may take an earlier "a" than the one meant, and "rt" is the initials of "Report Tool"
       though it also stands inside "Report". Letters together score by how early and how short. */
            const matchWord = (p, word) => {
                if (!p.lower || !word || !inOrder(p.lower, word)) return null;
                const placings = [];
                const plain = plainly(p, word);
                if (plain) placings.push(plain);
                const best = place(p, word);
                if (best) placings.push(best.at);
                let out = null;
                for (const at of placings) {
                    const tier = tierOf(at, p);
                    const score = together(at) ? 1000 - at[0] - p.lower.length * 0.1 : best.score;
                    if (!out || tier > out.tier || (tier === out.tier && score > out.score)) out = { tier, score, at };
                }
                return out;
            };
            const matchTyped = (p, word) => {
                const m = matchWord(p, word);
                const alt = typing(word);
                const n = alt ? matchWord(p, alt) : null;
                if (!n) return m;
                return !m || n.tier > m.tier || (n.tier === m.tier && n.score > m.score) ? n : m;
            };

            /* `fields[0]` is the entry's name: `at` is always its letters, whichever field ranked a word.
       `cap` is the best tier a word found in that field may count as, and a `name` field also tries
       the whole query as one phrase. `raw` is the tier without caps. */
            const matchFields = (fields, query) => {
                const ws = String(query || '')
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(Boolean);
                if (!ws.length || !fields.length) return null;
                const prepared = fields.map((f) => prepare(f.text));
                let tier = TIER.EXACT,
                    raw = TIER.EXACT,
                    score = 0;
                const at = new Set();
                for (const w of ws) {
                    let best = null,
                        bestField = -1;
                    fields.forEach((f, i) => {
                        const m = matchTyped(prepared[i], w);
                        if (!m) return;
                        const capped = {
                            tier: Math.min(m.tier, f.cap ?? TIER.EXACT),
                            raw: m.tier,
                            score: m.score * (f.weight ?? 1),
                            at: m.at,
                        };
                        if (
                            !best ||
                            capped.tier > best.tier ||
                            (capped.tier === best.tier && capped.score > best.score)
                        ) {
                            best = capped;
                            bestField = i;
                        }
                    });
                    if (!best) return null;
                    tier = Math.min(tier, best.tier);
                    raw = Math.min(raw, best.raw);
                    score += best.score;
                    const inName = bestField === 0 ? best : matchTyped(prepared[0], w);
                    if (inName) for (const j of inName.at) at.add(j);
                }
                // The words together, in a name: the name typed out in full beats its words one by one.
                if (ws.length > 1) {
                    const phrase = ws.join(' ');
                    fields.forEach((f, i) => {
                        if (!f.name) return;
                        const m = matchTyped(prepared[i], phrase);
                        if (!m || m.tier <= tier) return;
                        tier = raw = m.tier;
                        score = m.score * (f.weight ?? 1) * ws.length;
                        if (i === 0) {
                            at.clear();
                            for (const j of m.at) at.add(j);
                        }
                    });
                }
                return { tier, raw, score, at: [...at].sort((a, b) => a - b) };
            };

            const match = (text, query) => matchFields([{ text, name: true }], query);

            return Object.freeze({ TIER, match, matchFields });
        }
        return Object.freeze({ ...deckitMatch(), script: `const MATCH = (${deckitMatch})();` });
    }
);
