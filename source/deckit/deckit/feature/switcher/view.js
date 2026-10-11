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
        // MARK: - Property
        const { MOTION, WASH, aimOnMove, isDark } = TOKEN;
        const { TIER, matchFields } = MATCH;
        // Only `alert` tints the card and `info` has no colour, so a colour still means something.
        const LOOK = {
            info: {
                mark: 'rgba(128,128,128,.45)',
                glyph: '',
                wash: '',
                attentionMark: 'rgba(128,128,128,.9)',
                attentionPeak: 'rgba(128,128,128,.26)',
            },
            ok: {
                mark: '#2eb67d',
                glyph: '#2eb67d',
                wash: '',
                attentionMark: '#2eb67d',
                attentionPeak: 'rgba(46,182,125,.20)',
            },
            warn: {
                mark: '#ecb22e',
                glyph: '#ecb22e',
                wash: '',
                attentionMark: '#ecb22e',
                attentionPeak: 'rgba(236,178,46,.20)',
            },
            alert: {
                mark: '#e01e5a',
                glyph: '#e01e5a',
                wash: 'rgba(224,30,90,.10)',
                attentionMark: '#e01e5a',
                attentionPeak: 'rgba(224,30,90,.24)',
            },
        };
        const NOW_TONE = Object.fromEntries(
            TONE.TONES.map((tone) => {
                if (!LOOK[tone]) throw new Error(`[deckit] the switcher has no look for the tone ${tone}`);
                return [tone, LOOK[tone]];
            })
        );
        const SEARCH_LIMIT = 60;
        const RECENT_SHOWN = 8;
        const LEAD_BACKGROUND = 'rgba(128,128,128,.10)';
        // If no entries come (the panel's page never came up), the switcher puts itself away so it does not hold
        // the keyboard empty.
        const GIVE_UP_MILLISECONDS = 4000;

        // MARK: - Initializer
        // MARK: - Public
        function open(theme, { placeholder = 'Jump to…', items = [], now = [], onQuery, onPick, onClose }) {
            let shown = [];
            let headings = new Map();
            let cursor = 0;
            let lit = new Map();
            let nowItems = now.map((item) => ({ ...item, lead: true }));
            // Once the person has typed or moved, a late Now answer no longer redraws the list.
            let touched = false;
            let asked = '';
            // The cursor was put on a row since the query changed.
            let aimed = false;
            // Keyed by page and query, through answerKey, so a page's answers never mix with the list's.
            const answers = new Map();
            // A page is an entry opened to search inside it, like an editor's files:
            // { id, label, placeholder, ranked } while one is open.
            let inside = null;
            // While a searching page has not answered what is typed, its last answer stays up and the list is
            // provisional: a row aimed at is only remembered (`aimedId`) and found again in the answer, and Enter or
            // a ⌘ number waits for it (`held`).
            let lastAnswer = [];
            let aimedId = null;
            let held = null;
            // The rows ⌘1..⌘9 take: the first nine actionable ones, in list order.
            let numbers = [];
            const onCloses = [];
            let applyNow = () => {};
            let takeNumber = () => {};
            let applyResolved = () => {};

            browse();
            cursor = firstActionable();

            // fill() runs before the sheet is returned, but nothing in it fires until the person acts, so `modal` is
            // set by then.
            const modal = openModal(theme)({
                chrome: false,
                align: 'top',
                width: 'min(520px, calc(100vw - 48px))',
                onClose: () => {
                    for (const off of onCloses) off();
                    onClose?.();
                },
                fill,
            });
            modal.setNow = (rows) => applyNow(rows || []);
            modal.takeNumber = (number) => takeNumber(number);
            modal.setResolved = (raw, entries, pageId) =>
                applyResolved(String(raw || ''), entries || [], pageId || null);
            return modal;

            function fill(card) {
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

                const listbox = document.createElement('div');
                Object.assign(listbox.style, { maxHeight: '44vh', overflowY: 'auto' });

                // Rows are rebuilt only when the result set changes; moving the highlight repaints them. A redraw on
                // hover would replace the row under the pointer, fire mouseenter again, and tear down the row a click
                // lands on.
                let rows = [];
                let numbersShown = false;

                aimOnMove(listbox, (event) => {
                    const index = rows.indexOf(event.target.closest?.('[data-deckit-row]'));
                    if (index < 0 || index === cursor || !isActionable(shown[index])) return;
                    cursor = index;
                    touched = true;
                    aim();
                    paintCursor();
                });

                field.addEventListener('input', () => {
                    touched = true;
                    aimed = false; // a new query is a new list; the old aim meant that one
                    asked = field.value.trim();
                    held = null;
                    aimedId = null;
                    // A ranked page already gave its whole list; only a search is asked again.
                    if (!inside?.ranked) onQuery?.(asked, inside?.id || null);
                    apply(asked);
                });

                // Drawn only for the query it answers and only while nothing is aimed: answers can go on top, and
                // folding them in would move the choice out from under Enter.
                applyResolved = (raw, entries, pageId) => {
                    answers.set(answerKey(pageId, raw), entries);
                    if (aimed || (pageId || null) !== (inside?.id || null)) return;
                    // A ranked page's answer is for the empty query, ranked for whatever is typed now.
                    if (inside?.ranked ? raw !== '' : raw !== asked) return;
                    apply(asked);
                    // The row aimed at while the list was provisional, if the answer has it: still the choice.
                    if (aimedId != null) {
                        const index = shown.findIndex((item) => item.id === aimedId && isActionable(item));
                        if (index >= 0) {
                            cursor = index;
                            aimed = true;
                            paintCursor();
                        }
                        // What Enter was held for is not in the answer: nothing to run. ⌘N picks by place, so it
                        // still runs.
                        else if (held?.number == null) held = null;
                        aimedId = null;
                    }
                    if (held && held.raw === raw) {
                        const { number } = held;
                        held = null;
                        chooseOrHold(number);
                    }
                };

                // Escape and Backspace leave a page before they close anything. On the window and in the capture
                // phase, because the modal shell answers Escape on the document.
                window.addEventListener('keydown', backOut, true);
                onCloses.push(() => window.removeEventListener('keydown', backOut, true));

                field.addEventListener('keydown', (event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        touched = true;
                        // Steps over inert rows. Aimed only once a row was, so an answer arriving after an arrow on
                        // an empty list still lands.
                        const step = event.key === 'ArrowDown' ? 1 : shown.length - 1;
                        for (let offset = 0; offset < shown.length; offset++) {
                            const index = (cursor + step * (offset + 1)) % shown.length;
                            if (isActionable(shown[index])) {
                                cursor = index;
                                aim();
                                break;
                            }
                        }
                        paintCursor();
                        rows[cursor]?.scrollIntoView({ block: 'nearest' });
                    } else if (event.key === 'Enter') {
                        event.preventDefault();
                        chooseOrHold(null);
                    } else if (event.key === 'Meta') {
                        showNumbers(true);
                    }
                });
                field.addEventListener('keyup', (event) => {
                    if (event.key === 'Meta') showNumbers(false);
                });
                field.addEventListener('blur', () => showNumbers(false));
                // ⌘N is caught in main and arrives here as the number.
                takeNumber = (number) => chooseOrHold(number);

                applyNow = (rows) => {
                    if (touched) return;
                    nowItems = rows.map((item) => ({ ...item, lead: true }));
                    browse();
                    cursor = firstActionable();
                    draw();
                };

                card.append(bar, rule, listbox);
                draw();
                return field;

                function draw() {
                    listbox.textContent = '';
                    rows = [];
                    if (!shown.length) {
                        const empty = document.createElement('div');
                        empty.textContent = 'No match';
                        Object.assign(empty.style, { padding: '10px 12px', opacity: '.45' });
                        listbox.appendChild(empty);
                        return;
                    }
                    shown.forEach((item, index) => {
                        for (const heading of headings.get(index) || [])
                            listbox.appendChild(makeHeading(heading, listbox.childElementCount === 0));
                        const row = makeRow(item, index);
                        listbox.appendChild(row);
                        rows.push(row);
                    });
                    paintCursor();
                }

                function makeRow(item, index) {
                    const actionable = isActionable(item);
                    const tone = NOW_TONE[item.tone] || NOW_TONE.info;
                    const row = document.createElement('div');
                    Object.assign(row.style, {
                        display: 'flex',
                        alignItems: 'center',
                        minWidth: '0',
                        borderRadius: item.lead ? '10px' : '8px',
                        gap: item.lead ? '11px' : '9px',
                        padding: item.lead ? '9px 11px' : '7px 10px',
                        margin: item.lead ? '0 0 4px' : '0',
                        cursor: actionable ? 'pointer' : 'default',
                        background: item.lead ? tone.wash || LEAD_BACKGROUND : 'transparent',
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
                    hint.textContent = item.hint || (headings.size || item.lead ? '' : ownerOf(item));

                    if (item.lead) {
                        const mark = document.createElement('span');
                        Object.assign(mark.style, {
                            flex: '0 0 auto',
                            alignSelf: 'stretch',
                            width: '3px',
                            borderRadius: '2px',
                            background: tone.mark,
                        });
                        if (item.attention) {
                            mark.style.background = tone.attentionMark;
                            if (MOTION.fast !== '0ms') breathe(row, tone);
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
                        row.append(mark, glyph, stack);
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
                        row.append(glyph, label, hint);
                    }

                    row.dataset.deckitRow = '';
                    if (actionable)
                        row.addEventListener('mousedown', (event) => {
                            event.preventDefault();
                            choose(index);
                        });
                    const place = numbers.indexOf(index) + 1;
                    if (place) {
                        const badge = document.createElement('span');
                        badge.textContent = '⌘' + place;
                        badge.dataset.deckitNumber = '';
                        Object.assign(badge.style, {
                            display: numbersShown ? 'inline' : 'none',
                            flex: '0 0 auto',
                            marginLeft: '10px',
                            font: '12px ' + theme.font,
                            opacity: '.55',
                            fontVariantNumeric: 'tabular-nums',
                        });
                        row.appendChild(badge);
                    }
                    return row;
                }

                // The breath is its own layer: paintCursor sets the card's background, and an animation of that
                // property snaps when it lets go.
                function breathe(row, tone) {
                    row.style.position = 'relative';
                    row.style.overflow = 'hidden';
                    const glow = document.createElement('span');
                    Object.assign(glow.style, {
                        position: 'absolute',
                        inset: '0',
                        borderRadius: 'inherit',
                        background: tone.attentionPeak,
                        opacity: '0',
                        pointerEvents: 'none',
                        // Above the card's background, behind its text.
                        zIndex: '-1',
                    });
                    row.appendChild(glow);
                    glow.animate(
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

                function makeHeading(heading, isFirst) {
                    const element = document.createElement('div');
                    if (heading.kind === 'section') {
                        Object.assign(element.style, {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: isFirst ? '4px 12px 4px' : '10px 12px 4px',
                            margin: isFirst ? '0' : '6px 0 0',
                            borderTop: isFirst ? '0' : theme.border,
                            font: '600 12px ' + theme.font,
                            opacity: '.55',
                        });
                        const glyph = document.createElement('span');
                        glyph.innerHTML = heading.icon || '';
                        Object.assign(glyph.style, {
                            display: 'flex',
                            flex: '0 0 auto',
                            width: '13px',
                            height: '13px',
                            alignItems: 'center',
                            justifyContent: 'center',
                        });
                        const svg = glyph.querySelector('svg');
                        if (svg) {
                            svg.setAttribute('width', '13');
                            svg.setAttribute('height', '13');
                        }
                        const title = document.createElement('span');
                        title.textContent = heading.label;
                        element.append(glyph, title);
                    } else {
                        element.textContent = heading.label;
                        Object.assign(element.style, {
                            font: '700 11px ' + theme.font,
                            letterSpacing: '.06em',
                            textTransform: 'uppercase',
                            opacity: '.45',
                            padding:
                                heading.kind === 'group' ? '8px 12px 3px' : isFirst ? '4px 12px 4px' : '12px 12px 4px',
                        });
                    }
                    return element;
                }

                function paintCursor() {
                    rows.forEach((row, index) => {
                        const item = shown[index];
                        const rest = item?.lead ? NOW_TONE[item.tone]?.wash || LEAD_BACKGROUND : 'transparent';
                        row.style.background = index === cursor ? WASH.cursor : rest;
                    });
                }

                function showNumbers(on) {
                    if (on === numbersShown) return;
                    numbersShown = on;
                    listbox.querySelectorAll('[data-deckit-number]').forEach((badge) => {
                        badge.style.display = on ? 'inline' : 'none';
                    });
                }

                function choose(index) {
                    const item = shown[index];
                    if (!isActionable(item)) return;
                    // Through onPick too, so opening a page counts as a use.
                    if (item.page) {
                        onPick?.(item);
                        return enter(item);
                    }
                    modal.close();
                    onPick?.(item);
                }

                function enter(item) {
                    inside = {
                        id: item.id,
                        label: item.label,
                        placeholder: item.page.placeholder || 'Search…',
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
                    aimedId = null;
                    field.placeholder = inside.placeholder;
                    field.value = '';
                    asked = '';
                    touched = true;
                    aimed = false;
                    onQuery?.('', inside.id); // what the page shows before anything is typed
                    apply('');
                    field.focus();
                }

                function leave() {
                    inside = null;
                    lastAnswer = [];
                    held = null;
                    aimedId = null;
                    chip.style.display = 'none';
                    field.placeholder = placeholder;
                    field.value = '';
                    asked = '';
                    aimed = false;
                    apply('');
                }

                function apply(raw) {
                    // Resolvers get the query as typed: lowercasing is for ranking and would break an id in a URL.
                    const query = raw.toLowerCase();
                    if (inside) {
                        // A searching page's list is its answer to the raw text; a ranked page gave one list as it
                        // opened, ranked here.
                        const key = answerKey(inside.id, inside.ranked ? '' : raw);
                        if (answers.has(key)) lastAnswer = answers.get(key);
                        lit = new Map();
                        show(inside.ranked && query ? rank(lastAnswer, query) : lastAnswer);
                    } else if (!query) {
                        browse();
                    } else {
                        // Answers for this query go on top unranked (a pasted URL is in no list to rank), and
                        // `fallback` ones (somewhere else to look) go last so they never stand over every command.
                        // The Now block is left out under a query.
                        const offered = answersFor(null, raw);
                        show(
                            offered
                                .filter((item) => !item.fallback)
                                .concat(
                                    rank(items, query),
                                    offered.filter((item) => item.fallback)
                                )
                        );
                    }
                    cursor = firstActionable();
                    draw();
                }

                // On a provisional list the aimed row is only remembered; otherwise a later answer does not move it.
                function aim() {
                    if (isProvisional()) aimedId = shown[cursor]?.id ?? null;
                    else aimed = true;
                }

                function chooseOrHold(number) {
                    if (isProvisional()) {
                        held = { raw: asked, number };
                        return;
                    }
                    if (number == null) choose(cursor);
                    else if (numbers[number - 1] != null) choose(numbers[number - 1]);
                }

                function backOut(event) {
                    if (!inside) return;
                    if (event.key === 'Escape' || (event.key === 'Backspace' && !field.value)) {
                        event.preventDefault();
                        event.stopImmediatePropagation();
                        leave();
                    }
                }
            }

            function answerKey(pageId, raw) {
                return (pageId || '') + '\0' + raw;
            }

            function answersFor(pageId, raw) {
                return answers.get(answerKey(pageId, raw)) || [];
            }

            function isProvisional() {
                return !!inside && !inside.ranked && !answers.has(answerKey(inside.id, asked));
            }

            function firstActionable() {
                return shown.findIndex(isActionable);
            }

            // index -> the headings that stand over that row, outermost first.
            function layout() {
                const list = [];
                const at = new Map();
                const addHeading = (heading) => {
                    if (!at.has(list.length)) at.set(list.length, []);
                    at.get(list.length).push(heading);
                };
                if (nowItems.length) {
                    addHeading({ kind: 'block', label: 'Now' });
                    list.push(...nowItems);
                }
                const recent = items
                    .filter((item) => item.used > 0)
                    .sort((left, right) => right.used - left.used)
                    .slice(0, RECENT_SHOWN);
                if (recent.length) {
                    addHeading({ kind: 'block', label: 'Recent' });
                    list.push(...recent);
                }
                const sections = new Map();
                for (const item of items) {
                    const key = item.plugin?.id || '';
                    if (!sections.has(key)) sections.set(key, { plugin: item.plugin, groups: new Map([['', []]]) });
                    const groups = sections.get(key).groups;
                    if (!groups.has(item.group || '')) groups.set(item.group || '', []);
                    groups.get(item.group || '').push(item);
                }
                for (const { plugin, groups } of sections.values()) {
                    addHeading({ kind: 'section', label: plugin?.name || '', icon: plugin?.icon || '' });
                    for (const [group, members] of groups) {
                        if (!members.length) continue;
                        if (group) addHeading({ kind: 'group', label: group });
                        list.push(...members);
                    }
                }
                return { list, at };
            }

            function show(list, laidOut = null) {
                shown = laidOut ? laidOut.list : list.slice(0, SEARCH_LIMIT);
                headings = laidOut ? laidOut.at : new Map();
                numbers = shown
                    .map((item, index) => (isActionable(item) ? index : -1))
                    .filter((index) => index >= 0)
                    .slice(0, 9);
            }

            function browse() {
                lit = new Map();
                show(null, layout());
            }

            // Also sets `lit`, the letters each row draws heavier.
            function rank(list, query) {
                const ranked = list
                    .map((item) => ({ item, found: matchFields(fieldsOf(item), query) }))
                    .filter((candidate) => candidate.found)
                    .sort(byRelevance);
                lit = new Map(ranked.map((candidate) => [candidate.item, candidate.found.at]));
                return ranked.map((candidate) => candidate.item);
            }
        }

        function boot(theme) {
            let switcher = null;
            // Reported from the close itself: Escape and a click away close here first and main hears afterwards.
            // It carries the token of the hide main waits on, and an exit overtaken by a reopen never reports, or it
            // would answer the next hide mid-fade.
            let closing = false;
            let exitTimer = null;
            let hideToken = null;
            let giveUpTimer = null;

            // Scrollbars and other native drawing follow the theme.
            document.documentElement.style.colorScheme = isDark(theme.contentBg) ? 'dark' : 'light';
            Object.assign(document.body.style, { margin: '0', background: 'transparent' });

            const entries = ENTRIES.list({
                supply: ({ items, now }) => {
                    clearTimeout(giveUpTimer);
                    if (switcher) return;
                    clearTimeout(exitTimer);
                    closing = false;
                    switcher = open(theme, {
                        placeholder: 'Jump to a plugin, bookmark or view…',
                        items: hydrate(items),
                        now: hydrate(now),
                        // Resolvers and page searches live with the plugins, in the panel's page.
                        onQuery: (raw, pageId) => entries.query(raw, pageId),
                        onPick: (item) => item.run(),
                        onClose: () => {
                            switcher = null;
                            PROTOCOL.close.send();
                            reportAfterExit();
                        },
                    });
                },
                now: (rows) => switcher?.setNow(hydrate(rows)),
                resolved: (raw, found, page) => switcher?.setResolved(raw, hydrate(found), page),
            });
            PROTOCOL.open.on(() => {
                if (switcher) return;
                entries.need();
                clearTimeout(giveUpTimer);
                giveUpTimer = setTimeout(() => {
                    if (!switcher) PROTOCOL.close.send();
                }, GIVE_UP_MILLISECONDS);
            });
            // ⌘1 to ⌘9 are caught in main, where only a chord taken first wins over the app's menu.
            PROTOCOL.number.on(({ number }) => switcher?.takeNumber(number));
            // The list goes with the view, so a reopen never shows stale entries.
            PROTOCOL.dismiss.on(({ token }) => {
                hideToken = token ?? null;
                const closed = switcher;
                switcher = null;
                // Closing reports through onClose. With nothing open or closing, report now so main does not wait
                // out its guard timer.
                if (closed) closed.close();
                else if (!closing) reportHidden();
            });
            PROTOCOL.ready.send();
            console.log('[deckit] switcher up');

            function reportHidden() {
                closing = false;
                exitTimer = null;
                PROTOCOL.hidden.send({ token: hideToken });
            }

            function reportAfterExit() {
                clearTimeout(exitTimer);
                const duration = parseFloat(MOTION.base) || 0;
                if (!duration) return reportHidden();
                closing = true;
                exitTimer = setTimeout(reportHidden, duration);
            }

            // A function does not cross processes: `runnable` says an entry had run(), which becomes a pick sent
            // back.
            function hydrate(list) {
                return (list || []).map((entry) => ({
                    ...entry,
                    run: entry.runnable ? () => entries.pick(entry.id) : undefined,
                }));
            }
        }

        // MARK: - Private
        function openModal(theme) {
            return UI.make(theme).sheet;
        }

        // Each alias is its own field, so a short name scores as a whole name and not as the start of a longer
        // label. Whose it is and its group may fill a word but never beat a match found in a name.
        function fieldsOf(item) {
            return [
                { text: item.label, name: true },
                ...(item.aliases || []).map((text) => ({ text, name: true })),
                {
                    text: [item.plugin?.name, ...(item.plugin?.aliases || []), item.group].filter(Boolean).join(' '),
                    weight: 0.9,
                    cap: TIER.WORD,
                },
                { text: item.keywords || '', weight: 0.8, cap: TIER.INSIDE },
                { text: item.address || '', weight: 0.5, cap: TIER.SPREAD },
            ];
        }

        // Tier first, so the order is predictable. Use counts only when the query is at least a word of the name
        // (its tier before any cap), so a used entry whose letters are merely scattered does not jump ahead. Then the
        // score, then the shorter label.
        function byRelevance(left, right) {
            return (
                right.found.tier - left.found.tier ||
                (Math.min(left.found.raw, right.found.raw) >= TIER.WORD
                    ? (right.item.used || 0) - (left.item.used || 0)
                    : 0) ||
                right.found.score - left.found.score ||
                left.item.label.length - right.item.label.length
            );
        }

        function isActionable(item) {
            return typeof item?.run === 'function';
        }

        function ownerOf(item) {
            return [item.plugin?.name, item.group].filter(Boolean).join(' › ');
        }

        function paintLabel(element, text, positions) {
            if (!positions?.length) {
                element.textContent = text;
                return;
            }
            const marked = new Set(positions);
            let segment = '';
            let heavy = false;
            const flush = () => {
                if (!segment) return;
                if (heavy) {
                    const bold = document.createElement('b');
                    bold.textContent = segment;
                    bold.style.fontWeight = '800';
                    element.appendChild(bold);
                } else element.appendChild(document.createTextNode(segment));
                segment = '';
            };
            for (let index = 0; index < text.length; index++) {
                if (marked.has(index) !== heavy) {
                    flush();
                    heavy = marked.has(index);
                }
                segment += text[index];
            }
            flush();
        }

        return { open, boot };
    }
);
