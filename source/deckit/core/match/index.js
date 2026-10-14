DeckitModule.define(
    'core/match',
    {
        uses: [],
        provides: ['TIER', 'match', 'matchFields', 'script'],
        runs: 'any',
    },
    () => {
        // MARK: - Property
        const ENGINE = makeEngine();
        const TIER = ENGINE.TIER;
        // The ranker's worker runs the engine from this source, so the engine reaches nothing outside itself.
        const script = `const MATCH = (${makeEngine})();`;

        // MARK: - Initializer
        // MARK: - Public
        function match(text, query) {
            return ENGINE.match(text, query);
        }

        function matchFields(fields, query) {
            return ENGINE.matchFields(fields, query);
        }

        // MARK: - Private
        function makeEngine() {
            // The tier decides before the score, so the order stays predictable. EXACT: the whole text. PREFIX: its
            // start. WORD: at a word start, or the words' initials. INSIDE: elsewhere in it. SPREAD: its letters in
            // order, apart.
            const TIER = Object.freeze({ EXACT: 5, PREFIX: 4, WORD: 3, INSIDE: 2, SPREAD: 1 });

            const CHOSEONG = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅ' + 'ㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
            const SYLLABLE_START = 0xac00;
            const SYLLABLES_PER_INITIAL = 588;
            const FINAL_COUNT = 28;
            // A syllable being typed borrows the next one's first consonant ("브라" passes through "블"), so a last
            // final consonant is also tried let go. By the final's index: [the final left on the syllable, the
            // consonant starting the next]. A double final splits as the keyboard splits it.
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
            const MATCH_SCORE = 16;
            const WORD_START_BONUS = 10;
            const FIRST_LETTER_BONUS = 4;
            const RUN_BONUS = 6;
            const GAP_OPEN = 3;
            const GAP_EXTEND = 1;

            // `fields[0]` is the entry's name: `at` is always its letters, whichever field ranked a word. `cap` is
            // the best tier a word found in that field may count as, and a `name` field also tries the whole query
            // as one phrase. `raw` is the tier without caps.
            function matchFields(fields, query) {
                const words = String(query || '')
                    .toLowerCase()
                    .split(/\s+/)
                    .filter(Boolean);
                if (!words.length || !fields.length) return null;
                const prepared = fields.map((field) => prepare(field.text));
                let tier = TIER.EXACT;
                let raw = TIER.EXACT;
                let score = 0;
                const positions = new Set();
                for (const word of words) {
                    let best = null;
                    let bestIndex = -1;
                    fields.forEach((field, index) => {
                        const found = matchTyped(prepared[index], word);
                        if (!found) return;
                        const capped = {
                            tier: Math.min(found.tier, field.cap ?? TIER.EXACT),
                            raw: found.tier,
                            score: found.score * (field.weight ?? 1),
                            positions: found.positions,
                        };
                        if (beats(capped, best)) {
                            best = capped;
                            bestIndex = index;
                        }
                    });
                    if (!best) return null;
                    tier = Math.min(tier, best.tier);
                    raw = Math.min(raw, best.raw);
                    score += best.score;
                    const inName = bestIndex === 0 ? best : matchTyped(prepared[0], word);
                    if (inName) for (const position of inName.positions) positions.add(position);
                }
                // The words together, in a name: the name typed out in full beats its words one by one.
                if (words.length > 1) {
                    const phrase = words.join(' ');
                    fields.forEach((field, index) => {
                        if (!field.name) return;
                        const found = matchTyped(prepared[index], phrase);
                        if (!found || found.tier <= tier) return;
                        tier = raw = found.tier;
                        score = found.score * (field.weight ?? 1) * words.length;
                        if (index === 0) {
                            positions.clear();
                            for (const position of found.positions) positions.add(position);
                        }
                    });
                }
                return { tier, raw, score, at: [...positions].sort((left, right) => left - right) };
            }

            function match(text, query) {
                return matchFields([{ text, name: true }], query);
            }

            function matchTyped(prepared, word) {
                const asTyped = matchWord(prepared, word);
                const letGo = letGoFinal(word);
                const asLetGo = letGo ? matchWord(prepared, letGo) : null;
                if (!asLetGo) return asTyped;
                return beats(asLetGo, asTyped) ? asLetGo : asTyped;
            }

            // Both the plain occurrence and the table's best alignment are tried, the better tier winning: the table
            // may take an earlier "a" than the one meant, and "rt" is the initials of "Report Tool" though it also
            // stands inside "Report". Letters together score by how early and how short.
            function matchWord(prepared, word) {
                if (!prepared.lower || !word || !isInOrder(prepared.lower, word)) return null;
                const placings = [];
                const plain = placePlainly(prepared, word);
                if (plain) placings.push(plain);
                const aligned = align(prepared, word);
                if (aligned) placings.push(aligned.positions);
                let best = null;
                for (const positions of placings) {
                    const tier = tierOf(positions, prepared);
                    const score = isTogether(positions)
                        ? 1000 - positions[0] - prepared.lower.length * 0.1
                        : aligned.score;
                    const candidate = { tier, score, positions };
                    if (beats(candidate, best)) best = candidate;
                }
                return best;
            }

            function beats(candidate, current) {
                return (
                    !current ||
                    candidate.tier > current.tier ||
                    (candidate.tier === current.tier && candidate.score > current.score)
                );
            }

            // Word starts are worked out lazily: most texts fail isInOrder first.
            function prepare(text) {
                const source = typeof text === 'string' ? text : '';
                let starts = null;
                return {
                    lower: source.toLowerCase(),
                    get starts() {
                        return starts || (starts = findWordStarts(source));
                    },
                };
            }

            // Where a word starts: the text's start, after a separator, a lower-to-upper step, Hangul meeting Latin.
            function findWordStarts(text) {
                const starts = new Array(text.length).fill(false);
                for (let index = 0; index < text.length; index++) {
                    if (index === 0) {
                        starts[index] = kindOf(text[0]) !== 'other';
                        continue;
                    }
                    const before = kindOf(text[index - 1]);
                    const kind = kindOf(text[index]);
                    if (kind === 'other') continue;
                    starts[index] =
                        before === 'other' ||
                        (before === 'lower' && kind === 'upper') ||
                        ((before === 'han') !== (kind === 'han') && before !== 'digit' && kind !== 'digit');
                }
                return starts;
            }

            function kindOf(letter) {
                if (isSyllable(letter) || isJamo(letter)) return 'han';
                if (/[a-z]/.test(letter)) return 'lower';
                if (/[A-Z]/.test(letter)) return 'upper';
                if (/[0-9]/.test(letter)) return 'digit';
                return 'other';
            }

            // A cheap filter before the table: most texts fail it.
            function isInOrder(lower, word) {
                let found = 0;
                let wanted = word[0];
                for (let index = 0; index < lower.length; index++) {
                    if (isSame(lower[index], wanted)) {
                        if (++found === word.length) return true;
                        wanted = word[found];
                    }
                }
                return false;
            }

            function placePlainly(prepared, word) {
                const { lower, starts } = prepared;
                let first = -1;
                for (let index = lower.indexOf(word); index >= 0; index = lower.indexOf(word, index + 1)) {
                    if (first < 0) first = index;
                    if (starts[index]) {
                        first = index;
                        break;
                    }
                }
                return first < 0 ? null : Array.from({ length: word.length }, (unused, offset) => first + offset);
            }

            // A gap costs GAP_OPEN plus GAP_EXTEND per letter after the first. The best column to jump from is kept
            // as its score plus its column times GAP_EXTEND, so one comparison finds it and the table stays word
            // length by text length.
            function align(prepared, word) {
                const { lower, starts } = prepared;
                const textLength = lower.length;
                const wordLength = word.length;
                let previous = new Array(textLength).fill(-Infinity);
                const trace = [];
                for (let row = 0; row < wordLength; row++) {
                    const current = new Array(textLength).fill(-Infinity);
                    const cameFrom = new Array(textLength).fill(-1);
                    let reach = -Infinity;
                    let reachFrom = -1;
                    for (let column = 0; column < textLength; column++) {
                        // The latest column a jump to this one can start from: one letter skipped.
                        const jumpFrom = column - 2;
                        if (
                            row > 0 &&
                            jumpFrom >= 0 &&
                            previous[jumpFrom] > -Infinity &&
                            previous[jumpFrom] + jumpFrom * GAP_EXTEND > reach
                        ) {
                            reach = previous[jumpFrom] + jumpFrom * GAP_EXTEND;
                            reachFrom = jumpFrom;
                        }
                        if (!isSame(lower[column], word[row])) continue;
                        const gain =
                            MATCH_SCORE +
                            (starts[column] ? WORD_START_BONUS : 0) +
                            (row === 0 && column === 0 ? FIRST_LETTER_BONUS : 0);
                        if (row === 0) {
                            current[column] = gain - Math.min(column, 8) * 0.5;
                            continue;
                        }
                        const run =
                            column >= 1 && previous[column - 1] > -Infinity
                                ? previous[column - 1] + gain + RUN_BONUS
                                : -Infinity;
                        // From reachFrom, skipping column - reachFrom - 1 letters:
                        // GAP_OPEN + (column - reachFrom - 2) · GAP_EXTEND.
                        const jump = reachFrom >= 0 ? reach - (column - 2) * GAP_EXTEND - GAP_OPEN + gain : -Infinity;
                        if (run >= jump && run > -Infinity) {
                            current[column] = run;
                            cameFrom[column] = column - 1;
                        } else if (jump > -Infinity) {
                            current[column] = jump;
                            cameFrom[column] = reachFrom;
                        }
                    }
                    trace.push(cameFrom);
                    previous = current;
                }
                let end = -1;
                let score = -Infinity;
                for (let column = 0; column < textLength; column++) {
                    if (previous[column] > score) {
                        score = previous[column];
                        end = column;
                    }
                }
                if (end < 0) return null;
                const positions = new Array(wordLength);
                for (let row = wordLength - 1, column = end; row >= 0; row--) {
                    positions[row] = column;
                    column = trace[row][column];
                }
                return { score, positions };
            }

            function tierOf(positions, prepared) {
                const { lower, starts } = prepared;
                if (isTogether(positions)) {
                    if (positions[0] === 0) return positions.length === lower.length ? TIER.EXACT : TIER.PREFIX;
                    return starts[positions[0]] ? TIER.WORD : TIER.INSIDE;
                }
                // Every letter at the start of a word, the first at the first word: the word's initials.
                return positions.every((position) => starts[position]) && positions[0] === starts.indexOf(true)
                    ? TIER.WORD
                    : TIER.SPREAD;
            }

            function isTogether(positions) {
                return positions.every((position, index) => index === 0 || position === positions[index - 1] + 1);
            }

            // `typed` is lower case. A bare consonant matches a syllable that starts with it.
            function isSame(letter, typed) {
                return letter === typed || (isJamo(typed) && isSyllable(letter) && initialOf(letter) === typed);
            }

            function letGoFinal(word) {
                const last = word[word.length - 1];
                if (!last || !isSyllable(last)) return null;
                const offset = last.charCodeAt(0) - SYLLABLE_START;
                const final = offset % FINAL_COUNT;
                if (!final) return null;
                const [kept, next] = LET_GO[final];
                return word.slice(0, -1) + String.fromCharCode(SYLLABLE_START + offset - final + kept) + next;
            }

            function isSyllable(letter) {
                return letter >= '가' && letter <= '힣';
            }

            function isJamo(letter) {
                return letter >= 'ㄱ' && letter <= 'ㅎ';
            }

            function initialOf(syllable) {
                return CHOSEONG[Math.floor((syllable.charCodeAt(0) - SYLLABLE_START) / SYLLABLES_PER_INITIAL)];
            }

            return { TIER, match, matchFields };
        }

        return { TIER, match, matchFields, script };
    }
);
