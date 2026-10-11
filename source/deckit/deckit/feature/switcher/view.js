DeckitModule.define(
    'deckit/feature/switcher/view',
    {
        uses: [
            'deckit/ui/token',
            'deckit/ui/kit',
            'deckit/module/match',
            'deckit/service/switcher/view',
            'deckit/service/switcher/model/tone',
            'deckit/feature/switcher/model/protocol',
        ],
        provides: ['open', 'boot'],
    },
    (TOKEN, UI, MATCH, ENTRIES, TONE, PROTOCOL) => {
        const { MOTION, WASH, icon, aimOnMove, isDark } = TOKEN;
        const { make: makeUI } = UI;
        const { TIER, matchFields } = MATCH;

        // `info` is colourless on purpose and only `alert` tints the card, so colour still means something.
        const LOOK = {
            //       resting mark            glyph     card wash             attention: mark / card peak
            info: {
                mark: 'rgba(128,128,128,.45)',
                glyph: '',
                wash: '',
                loud: 'rgba(128,128,128,.9)',
                peak: 'rgba(128,128,128,.26)',
            },
            ok: { mark: '#2eb67d', glyph: '#2eb67d', wash: '', loud: '#2eb67d', peak: 'rgba(46,182,125,.20)' },
            warn: { mark: '#ecb22e', glyph: '#ecb22e', wash: '', loud: '#ecb22e', peak: 'rgba(236,178,46,.20)' },
            alert: {
                mark: '#e01e5a',
                glyph: '#e01e5a',
                wash: 'rgba(224,30,90,.10)',
                loud: '#e01e5a',
                peak: 'rgba(224,30,90,.24)',
            },
        };
        const NOW_TONE = Object.fromEntries(
            TONE.TONES.map((tone) => {
                if (!LOOK[tone]) throw new Error(`[deckit] the switcher has no look for the tone ${tone}`);
                return [tone, LOOK[tone]];
            })
        );

        const openModal = (theme) => makeUI(theme).sheet;

        const open = (theme, { placeholder = 'Jump to\u2026', items = [], now = [], onQuery, onPick, onClose }) => {
            const SEARCH_LIMIT = 60,
                RECENT_SHOWN = 8;
            let shown = [],
                heads = new Map(),
                cursor = 0,
                lit = new Map();

            let LEAD = now.map((it) => ({ ...it, lead: true }));

            // Once the person has typed or moved, a late Now answer no longer redraws the list.
            let touched = false;
            // `aimed`: the cursor was put on a row since the query changed.
            let asked = '',
                aimed = false;
            // Keyed by page and query so a page's answers never mix with the list's. Spell the key only through answerKey.
            const answers = new Map();
            const answerKey = (pageId, raw) => (pageId || '') + '\0' + raw;
            const answersFor = (pageId, raw) => answers.get(answerKey(pageId, raw)) || [];
            // A page: an entry chosen to search inside it (an editor's files) rather than run.
            let inside = null; // { id, label, placeholder, ranked } while a page is open
            /* While a searching page has not answered what is typed, its last answer stays up and the list
         is provisional: a row aimed at is only remembered (`aimAt`) and found again in the answer,
         and Enter or a ⌘ number waits for it (`held`). Provisional is derived, never stored, so it
         cannot outlive the page it was true of. */
            let lastAnswer = [],
                aimAt = null,
                held = null;
            const provisional = () => !!inside && !inside.ranked && !answers.has(answerKey(inside.id, asked));
            const closeExtras = [];
            let applyNow = () => {};
            let takeNumber = () => {};
            let applyResolved = () => {};
            const actionable = (it) => typeof it?.run === 'function';
            const firstActionable = () => shown.findIndex(actionable);

            // index -> the headings that stand over that row, outermost first.
            const layout = () => {
                const out = [],
                    at = new Map();
                const head = (h) => {
                    if (!at.has(out.length)) at.set(out.length, []);
                    at.get(out.length).push(h);
                };
                if (LEAD.length) {
                    head({ kind: 'block', label: 'Now' });
                    out.push(...LEAD);
                }
                const recent = items
                    .filter((it) => it.used > 0)
                    .sort((a, b) => b.used - a.used)
                    .slice(0, RECENT_SHOWN);
                if (recent.length) {
                    head({ kind: 'block', label: 'Recent' });
                    out.push(...recent);
                }
                const sections = new Map();
                for (const it of items) {
                    const key = it.plugin?.id || '';
                    if (!sections.has(key)) sections.set(key, { plugin: it.plugin, groups: new Map([['', []]]) });
                    const groups = sections.get(key).groups;
                    if (!groups.has(it.group || '')) groups.set(it.group || '', []);
                    groups.get(it.group || '').push(it);
                }
                for (const { plugin, groups } of sections.values()) {
                    head({ kind: 'section', label: plugin?.name || '', icon: plugin?.icon || '' });
                    for (const [g, list] of groups) {
                        if (!list.length) continue;
                        if (g) head({ kind: 'group', label: g });
                        out.push(...list);
                    }
                }
                return { list: out, at };
            };
            // The rows ⌘1..⌘9 take: the first nine actionable ones, in list order.
            let numbers = [];
            const setItems = (list, laidOut = null) => {
                shown = laidOut ? laidOut.list : list.slice(0, SEARCH_LIMIT);
                heads = laidOut ? laidOut.at : new Map();
                numbers = shown
                    .map((it, i) => (actionable(it) ? i : -1))
                    .filter((i) => i >= 0)
                    .slice(0, 9);
            };
            const browse = () => {
                lit = new Map();
                setItems(null, layout());
            };

            browse();
            cursor = firstActionable();

            /* Each alias is matched on its own: joined, a short name would score as the start of a long
         string and lose to any longer label beginning the same way. Whose it is and its group may
         fill a word but never beat a match found in a name. */
            const fieldsOf = (it) => [
                { text: it.label, name: true },
                ...(it.aliases || []).map((text) => ({ text, name: true })),
                {
                    text: [it.plugin?.name, ...(it.plugin?.aliases || []), it.group].filter(Boolean).join(' '),
                    weight: 0.9,
                    cap: TIER.WORD,
                },
                { text: it.keywords || '', weight: 0.8, cap: TIER.INSIDE },
                { text: it.address || '', weight: 0.5, cap: TIER.SPREAD },
            ];
            // Also sets `lit`, the letters each row draws heavier.
            const rankFor = (list, query) => {
                const ranked = list
                    .map((it) => ({ it, m: matchFields(fieldsOf(it), query) }))
                    .filter((x) => x.m)
                    .sort(byRelevance);
                lit = new Map(ranked.map((x) => [x.it, x.m.at]));
                return ranked.map((x) => x.it);
            };

            /* Tier first, so the order is predictable. Use counts only when the query is at least a word
         of the name (its tier before any cap), so a used entry whose letters are merely scattered
         does not jump ahead. Then the score, then the shorter label. */
            const byRelevance = (a, b) =>
                b.m.tier - a.m.tier ||
                (Math.min(a.m.raw, b.m.raw) >= TIER.WORD ? (b.it.used || 0) - (a.it.used || 0) : 0) ||
                b.m.score - a.m.score ||
                a.it.label.length - b.it.label.length;

            // fill() runs before openModal returns, but nothing in it fires until the person acts, so `modal` is set by then.
            let modal = null;
            const handle = (modal = openModal(theme)({
                chrome: false,
                align: 'top',
                width: 'min(520px, calc(100vw - 48px))',
                onClose: () => {
                    for (const off of closeExtras) off();
                    onClose?.();
                },
                fill(card) {
                    const field = document.createElement('input');
                    field.spellcheck = false;
                    field.placeholder = placeholder;
                    Object.assign(field.style, {
                        flex: '1 1 auto',
                        minWidth: '0',
                        width: '100%',
                        boxSizing: 'border-box',
                        height: '40px',
                        padding: '0 12px',
                        border: '0',
                        borderRadius: '8px',
                        background: 'transparent',
                        color: 'inherit',
                        font: '16px ' + theme.font,
                        outline: 'none',
                    });

                    const chip = document.createElement('span');
                    Object.assign(chip.style, {
                        display: 'none',
                        alignItems: 'center',
                        gap: '6px',
                        flex: '0 0 auto',
                        marginLeft: '8px',
                        height: '28px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        background: 'rgba(128,128,128,.18)',
                        font: '600 13.5px ' + theme.font,
                        whiteSpace: 'nowrap',
                    });
                    const bar = document.createElement('div');
                    Object.assign(bar.style, { display: 'flex', alignItems: 'center' });
                    bar.append(chip, field);

                    const rule = document.createElement('div');
                    Object.assign(rule.style, { borderTop: theme.border, margin: '2px 0 4px' });

                    const list = document.createElement('div');
                    Object.assign(list.style, { maxHeight: '44vh', overflowY: 'auto' });

                    /* Rows are rebuilt only when the result set changes; moving the highlight repaints them.
             A redraw on hover would replace the row under the pointer, fire mouseenter again, and
             tear down the row a click lands on. */
                    let rows = [];

                    aimOnMove(list, (e) => {
                        const i = rows.indexOf(e.target.closest?.('[data-deckit-row]'));
                        if (i < 0 || i === cursor || !actionable(shown[i])) return;
                        cursor = i;
                        touched = true;
                        aim();
                        paintCursor();
                    });

                    const LEAD_BG = 'rgba(128,128,128,.10)';
                    const paintCursor = () => {
                        rows.forEach((r, i) => {
                            const it = shown[i];
                            const rest = it?.lead ? NOW_TONE[it.tone]?.wash || LEAD_BG : 'transparent';
                            r.style.background = i === cursor ? WASH.cursor : rest;
                        });
                    };

                    const heading = (head, first) => {
                        const h = document.createElement('div');
                        if (head.kind === 'section') {
                            Object.assign(h.style, {
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: first ? '4px 12px 4px' : '10px 12px 4px',
                                margin: first ? '0' : '6px 0 0',
                                borderTop: first ? '0' : theme.border,
                                font: '600 12px ' + theme.font,
                                opacity: '.55',
                            });
                            const g = document.createElement('span');
                            g.innerHTML = head.icon || '';
                            Object.assign(g.style, {
                                display: 'flex',
                                flex: '0 0 auto',
                                width: '13px',
                                height: '13px',
                                alignItems: 'center',
                                justifyContent: 'center',
                            });
                            const svg = g.querySelector('svg');
                            if (svg) {
                                svg.setAttribute('width', '13');
                                svg.setAttribute('height', '13');
                            }
                            const t = document.createElement('span');
                            t.textContent = head.label;
                            h.append(g, t);
                        } else {
                            h.textContent = head.label;
                            Object.assign(h.style, {
                                font: '700 11px ' + theme.font,
                                letterSpacing: '.06em',
                                textTransform: 'uppercase',
                                opacity: '.45',
                                padding:
                                    head.kind === 'group' ? '8px 12px 3px' : first ? '4px 12px 4px' : '12px 12px 4px',
                            });
                        }
                        return h;
                    };
                    const whose = (it) => [it.plugin?.name, it.group].filter(Boolean).join(' \u203a ');
                    const paintLabel = (el, text, at) => {
                        if (!at?.length) {
                            el.textContent = text;
                            return;
                        }
                        const marked = new Set(at);
                        let run = '',
                            heavy = false;
                        const flush = () => {
                            if (!run) return;
                            if (heavy) {
                                const b = document.createElement('b');
                                b.textContent = run;
                                b.style.fontWeight = '800';
                                el.appendChild(b);
                            } else el.appendChild(document.createTextNode(run));
                            run = '';
                        };
                        for (let k = 0; k < text.length; k++) {
                            if (marked.has(k) !== heavy) {
                                flush();
                                heavy = marked.has(k);
                            }
                            run += text[k];
                        }
                        flush();
                    };

                    const draw = () => {
                        list.textContent = '';
                        rows = [];
                        if (!shown.length) {
                            const none = document.createElement('div');
                            none.textContent = 'No match';
                            Object.assign(none.style, { padding: '10px 12px', opacity: '.45' });
                            list.appendChild(none);
                            return;
                        }
                        shown.forEach((item, i) => {
                            for (const head of heads.get(i) || [])
                                list.appendChild(heading(head, list.childElementCount === 0));

                            const live = actionable(item);
                            const tone = NOW_TONE[item.tone] || NOW_TONE.info;
                            const r = document.createElement('div');
                            Object.assign(r.style, {
                                display: 'flex',
                                alignItems: 'center',
                                minWidth: '0',
                                borderRadius: item.lead ? '10px' : '8px',
                                gap: item.lead ? '11px' : '9px',
                                padding: item.lead ? '9px 11px' : '7px 10px',
                                margin: item.lead ? '0 0 4px' : '0',
                                cursor: live ? 'pointer' : 'default',
                                background: item.lead ? tone.wash || LEAD_BG : 'transparent',
                                transition: `background-color ${MOTION.fast} ${MOTION.ease}`,
                            });

                            // Only the left mark and the glyph carry the tone: coloured small text is harder to read.
                            const glyph = document.createElement('span');
                            glyph.innerHTML = item.icon || '';
                            Object.assign(
                                glyph.style,
                                item.lead
                                    ? {
                                          display: 'flex',
                                          flex: '0 0 auto',
                                          width: '22px',
                                          justifyContent: 'center',
                                          color: tone.glyph || 'inherit',
                                          opacity: tone.glyph ? '1' : '.75',
                                      }
                                    : {
                                          display: 'flex',
                                          flex: '0 0 auto',
                                          width: '18px',
                                          justifyContent: 'center',
                                          opacity: '.8',
                                      }
                            );

                            const label = document.createElement('span');
                            paintLabel(label, item.label, lit.get(item));
                            const hint = document.createElement('span');
                            // Laid out, the heading says whose a row is; ranked, the row says it itself.
                            hint.textContent = item.hint || (heads.size || item.lead ? '' : whose(item));

                            if (item.lead) {
                                const mark = document.createElement('span');
                                Object.assign(mark.style, {
                                    flex: '0 0 auto',
                                    alignSelf: 'stretch',
                                    width: '3px',
                                    borderRadius: '2px',
                                    background: tone.mark,
                                });
                                // Attention turns the mark to full strength and breathes the whole card three fading times, then stops.
                                if (item.attention) {
                                    mark.style.background = tone.loud;
                                    if (MOTION.fast !== '0ms') {
                                        /* The breath is its own layer: animating the card's background fought paintCursor
                       for the property and snapped when the animation let go. */
                                        r.style.position = 'relative';
                                        r.style.overflow = 'hidden';
                                        const glow = document.createElement('span');
                                        Object.assign(glow.style, {
                                            position: 'absolute',
                                            inset: '0',
                                            borderRadius: 'inherit',
                                            background: tone.peak,
                                            opacity: '0',
                                            pointerEvents: 'none',
                                            // Above the card's background, behind its text.
                                            zIndex: '-1',
                                        });
                                        r.appendChild(glow);
                                        glow.animate?.(
                                            [
                                                { opacity: 0, offset: 0 },
                                                { opacity: 1, offset: 0.17 },
                                                { opacity: 0, offset: 0.34 },
                                                { opacity: 0.65, offset: 0.5 },
                                                { opacity: 0, offset: 0.67 },
                                                { opacity: 0.35, offset: 0.83 },
                                                { opacity: 0, offset: 1 },
                                            ],
                                            { duration: 2700, easing: 'ease-in-out' }
                                        );
                                    }
                                }
                                const stack = document.createElement('div');
                                Object.assign(stack.style, {
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '1px',
                                    flex: '1 1 auto',
                                    minWidth: '0',
                                });
                                Object.assign(label.style, {
                                    font: '600 15px ' + theme.font,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                });
                                Object.assign(hint.style, {
                                    font: '12.5px ' + theme.font,
                                    opacity: '.6',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                });
                                stack.append(label, hint);
                                r.append(mark, glyph, stack);
                            } else {
                                Object.assign(label.style, {
                                    flex: '1 1 auto',
                                    minWidth: '0',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                });
                                Object.assign(hint.style, {
                                    flex: '0 0 auto',
                                    opacity: '.45',
                                    font: '12.5px ' + theme.font,
                                    maxWidth: '45%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                });
                                r.append(glyph, label, hint);
                            }

                            r.dataset.deckitRow = '';
                            if (live)
                                r.addEventListener('mousedown', (e) => {
                                    e.preventDefault();
                                    choose(i);
                                });
                            const nth = numbers.indexOf(i) + 1;
                            if (nth) {
                                const badge = document.createElement('span');
                                badge.textContent = '\u2318' + nth;
                                badge.dataset.deckitNumber = '';
                                Object.assign(badge.style, {
                                    display: numbered ? 'inline' : 'none',
                                    flex: '0 0 auto',
                                    marginLeft: '10px',
                                    font: '12px ' + theme.font,
                                    opacity: '.55',
                                    fontVariantNumeric: 'tabular-nums',
                                });
                                r.appendChild(badge);
                            }
                            list.appendChild(r);
                            rows.push(r);
                        });
                        paintCursor();
                    };
                    // ⌘ is held: rows show their numbers.
                    let numbered = false;
                    const number = (on) => {
                        if (on === numbered) return;
                        numbered = on;
                        list.querySelectorAll('[data-deckit-number]').forEach((b) => {
                            b.style.display = on ? 'inline' : 'none';
                        });
                    };

                    const choose = (i) => {
                        const item = shown[i];
                        if (!actionable(item)) return;
                        // Through onPick too, so opening a page counts as a use.
                        if (item.page) {
                            onPick?.(item);
                            return enter(item);
                        }
                        modal?.close();
                        onPick?.(item);
                    };

                    const enter = (item) => {
                        inside = {
                            id: item.id,
                            label: item.label,
                            placeholder: item.page.placeholder || 'Search\u2026',
                            ranked: !!item.page.ranked,
                        };
                        chip.textContent = '';
                        if (item.page.icon) {
                            const glyph = document.createElement('span');
                            glyph.innerHTML = item.page.icon;
                            Object.assign(glyph.style, {
                                display: 'flex',
                                flex: '0 0 auto',
                                width: '16px',
                                height: '16px',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: '.85',
                            });
                            const svg = glyph.querySelector('svg');
                            if (svg) {
                                svg.setAttribute('width', '15');
                                svg.setAttribute('height', '15');
                            }
                            chip.appendChild(glyph);
                        }
                        chip.appendChild(document.createTextNode(item.label));
                        chip.style.display = 'flex';
                        lastAnswer = [];
                        held = null;
                        aimAt = null;
                        field.placeholder = inside.placeholder;
                        field.value = '';
                        asked = '';
                        touched = true;
                        aimed = false;
                        onQuery?.('', inside.id); // what the page shows before anything is typed
                        apply('');
                        field.focus();
                    };
                    const leave = () => {
                        inside = null;
                        lastAnswer = [];
                        held = null;
                        aimAt = null;
                        chip.style.display = 'none';
                        field.placeholder = placeholder;
                        field.value = '';
                        asked = '';
                        aimed = false;
                        apply('');
                    };

                    const apply = (raw) => {
                        // Resolvers get the query as typed: lowercasing is for ranking and would break an id in a URL.
                        const query = raw.toLowerCase();
                        if (inside) {
                            /* A searching page's list is its answer to the raw text; a ranked page gave one list as
                 it opened, ranked here. */
                            const key = answerKey(inside.id, inside.ranked ? '' : raw);
                            if (answers.has(key)) lastAnswer = answers.get(key);
                            lit = new Map();
                            setItems(inside.ranked && query ? rankFor(lastAnswer, query) : lastAnswer);
                        } else if (!query) {
                            browse();
                        } else {
                            /* Answers for this query go on top unranked (a pasted URL is in no list to rank), and
                 `fallback` ones (somewhere else to look) go last so they never stand over every command.
                 The Now block is left out under a query. */
                            const offered = answersFor(null, raw);
                            setItems(
                                offered
                                    .filter((it) => !it.fallback)
                                    .concat(
                                        rankFor(items, query),
                                        offered.filter((it) => it.fallback)
                                    )
                            );
                        }
                        cursor = firstActionable();
                        draw();
                    };
                    // On a provisional list the aimed row is only remembered; otherwise a later answer does not move it.
                    const aim = () => {
                        if (provisional()) aimAt = shown[cursor]?.id ?? null;
                        else aimed = true;
                    };
                    const chooseOrHold = (n) => {
                        if (provisional()) {
                            held = { raw: asked, n };
                            return;
                        }
                        if (n == null) choose(cursor);
                        else if (numbers[n - 1] != null) choose(numbers[n - 1]);
                    };

                    field.addEventListener('input', () => {
                        touched = true;
                        aimed = false; // a new query is a new list; the old aim meant that one
                        asked = field.value.trim();
                        held = null;
                        aimAt = null;
                        // A ranked page already gave its whole list; only a search is asked again.
                        if (!inside?.ranked) onQuery?.(asked, inside?.id || null);
                        apply(asked);
                    });

                    /* Drawn only for the query it answers and only while nothing is aimed: answers can go on top,
             and folding them in would move the choice out from under Enter. */
                    applyResolved = (raw, entries, pageId) => {
                        answers.set(answerKey(pageId, raw), entries);
                        if (aimed || (pageId || null) !== (inside?.id || null)) return;
                        // A ranked page's answer is for the empty query, ranked for whatever is typed now.
                        if (inside?.ranked ? raw !== '' : raw !== asked) return;
                        apply(asked);
                        // The row aimed at while the list was provisional, if the answer has it: still the choice.
                        if (aimAt != null) {
                            const at = shown.findIndex((it) => it.id === aimAt && actionable(it));
                            if (at >= 0) {
                                cursor = at;
                                aimed = true;
                                paintCursor();
                            }
                            // What Enter was held for is not in the answer: nothing to run. ⌘N picks by place, so it still runs.
                            else if (held?.n == null) held = null;
                            aimAt = null;
                        }
                        if (held && held.raw === raw) {
                            const { n } = held;
                            held = null;
                            chooseOrHold(n);
                        }
                    };

                    /* Escape and Backspace leave a page before they close anything. On the window and in
             the capture phase, because the modal shell answers Escape on the document. */
                    const backOut = (e) => {
                        if (!inside) return;
                        if (e.key === 'Escape' || (e.key === 'Backspace' && !field.value)) {
                            e.preventDefault();
                            e.stopImmediatePropagation();
                            leave();
                        }
                    };
                    window.addEventListener('keydown', backOut, true);
                    closeExtras.push(() => window.removeEventListener('keydown', backOut, true));

                    field.addEventListener('keydown', (e) => {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                            e.preventDefault();
                            touched = true;
                            // Steps over inert rows. Aimed only once a row was, so an answer arriving after an arrow
                            // on an empty list still lands.
                            const dir = e.key === 'ArrowDown' ? 1 : shown.length - 1;
                            for (let n = 0; n < shown.length; n++) {
                                const at = (cursor + dir * (n + 1)) % shown.length;
                                if (actionable(shown[at])) {
                                    cursor = at;
                                    aim();
                                    break;
                                }
                            }
                            paintCursor();
                            rows[cursor]?.scrollIntoView({ block: 'nearest' });
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            chooseOrHold(null);
                        } else if (e.key === 'Meta') {
                            number(true);
                        }
                    });
                    field.addEventListener('keyup', (e) => {
                        if (e.key === 'Meta') number(false);
                    });
                    field.addEventListener('blur', () => number(false));
                    // ⌘N is caught in main (see the keymap in boot) and arrives here as the number.
                    takeNumber = (n) => chooseOrHold(n);

                    applyNow = (rows) => {
                        if (touched) return;
                        LEAD = rows.map((it) => ({ ...it, lead: true }));
                        browse();
                        cursor = firstActionable();
                        draw();
                    };

                    card.append(bar, rule, list);
                    draw();
                    return field;
                },
            }));
            handle.setNow = (rows) => applyNow(rows || []);
            handle.takeNumber = (n) => takeNumber(n);
            handle.setResolved = (raw, entries, pageId) =>
                applyResolved(String(raw || ''), entries || [], pageId || null);
            return handle;
        };

        const boot = (theme) => {
            // Scrollbars and other native drawing follow the theme.
            document.documentElement.style.colorScheme = isDark(theme.contentBg) ? 'dark' : 'light';
            Object.assign(document.body.style, { margin: '0', background: 'transparent' });

            let live = null;

            /* Reported from the close itself, not on main's dismiss: Escape and a click away close here
       first and main hears afterwards. It carries the token of the hide main waits on, and an exit
       overtaken by a reopen never reports, or it would answer the next hide mid-fade. */
            let closing = false,
                exitTimer = null,
                hideToken = null;
            const reportHidden = () => {
                closing = false;
                exitTimer = null;
                PROTOCOL.hidden.send({ token: hideToken });
            };
            const playedOut = () => {
                clearTimeout(exitTimer);
                const ms = parseFloat(MOTION.base) || 0;
                if (!ms) return reportHidden();
                closing = true;
                exitTimer = setTimeout(reportHidden, ms);
            };

            // A function does not cross processes: `runnable` says an entry had run(), which becomes a pick sent back.
            const hydrate = (list) =>
                (list || []).map((it) => ({
                    ...it,
                    run: it.runnable ? () => entries.pick(it.id) : undefined,
                }));

            const entries = ENTRIES.list({
                supply: ({ items, now }) => {
                    clearTimeout(unanswered);
                    if (live) return;
                    clearTimeout(exitTimer);
                    closing = false;
                    live = open(theme, {
                        placeholder: 'Jump to a plugin, bookmark or view\u2026',
                        items: hydrate(items),
                        now: hydrate(now),
                        // Resolvers and page searches live with the plugins, in the panel's page.
                        onQuery: (raw, pageId) => entries.query(raw, pageId),
                        onPick: (item) => item.run?.(),
                        onClose: () => {
                            live = null;
                            PROTOCOL.close.send();
                            playedOut();
                        },
                    });
                },
                now: (rows) => live?.setNow(hydrate(rows)),
                resolved: (raw, found, page) => live?.setResolved(raw, hydrate(found), page),
            });
            // If no entries come (the panel's page never came up), put itself away rather than hold the keyboard empty.
            const GIVE_UP_MS = 4000;
            let unanswered = null;
            PROTOCOL.open.on(() => {
                if (live) return;
                entries.need();
                clearTimeout(unanswered);
                unanswered = setTimeout(() => {
                    if (!live) PROTOCOL.close.send();
                }, GIVE_UP_MS);
            });
            // ⌘1 to ⌘9 are caught in main, where only a chord taken first wins over the app's menu.
            PROTOCOL.number.on(({ number }) => live?.takeNumber(number));
            // The list goes with the view, so a reopen never shows stale entries.
            PROTOCOL.dismiss.on(({ token }) => {
                hideToken = token ?? null;
                const open = live;
                live = null;
                // Closing reports through onClose. With nothing open or closing, report now so main does not wait out its guard timer.
                if (open) open.close();
                else if (!closing) reportHidden();
            });
            PROTOCOL.ready.send();
            console.log('[deckit] switcher up');
        };
        return { open, boot };
    }
);
