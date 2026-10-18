const { styled } = require('../dom.js');
const { renderMarkdown } = require('./markdown.js');

const brainView = ({ deck, bot, reveal }) => {
    const { theme, ui, settings } = deck;
    const store = deck.storage.values;
    const LINK = 'var(--deckit-accent)';
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
    const SEARCH_DELAY_MS = 160;

    ui.addStyle(`
    .bot-pressable { transition: background-color var(--deckit-fast) var(--deckit-easing); }
    .bot-pressable:hover { background: var(--deckit-hover); }
    .bot-pressable[data-active] { background: var(--deckit-selected); }
  `);
    const quiet = (text) =>
        styled('div', { padding: '14px 10px', opacity: '.45', font: '13px var(--deckit-font)' }, text);
    const markdown = renderMarkdown({
        ui,
        onNote: (id) => open(id, true),
        onLink: (url) => deck.open(url),
        wrap: {
            get: () => settings.get('wrapCode') === true,
            set: (on) => settings.set('wrapCode', on),
            on: (listener) =>
                settings.on((key) => {
                    if (key === 'wrapCode') listener();
                }),
        },
        copyText: (text) => deck.clipboard.writeText(text),
    });

    const pad = (number) => String(number).padStart(2, '0');
    const when = (seconds) => {
        if (!seconds) return '';
        const date = new Date(seconds * 1000);
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const ago = (seconds) => {
        if (!seconds) return '';
        const elapsed = Math.max(0, Date.now() / 1000 - seconds);
        if (elapsed < 3600) return `${Math.max(1, Math.floor(elapsed / 60))}m ago`;
        if (elapsed < 86400) return `${Math.floor(elapsed / 3600)}h ago`;
        if (elapsed < 86400 * 60) return `${Math.floor(elapsed / 86400)}d ago`;
        return when(seconds).slice(0, 10);
    };

    let query = store.get('query', '') || '';
    let axis = store.get('axis', null) || null;
    let axes = { total: 0, axes: [] };

    const bar = styled('div', { display: 'none', flex: '1 1 auto', minWidth: '0', alignItems: 'center', gap: '10px' });
    const field = ui.field({ placeholder: 'Search the brain', icon: ui.icon('search', { size: 13 }) });
    field.element.style.maxWidth = '460px';
    const input = field.input;
    const count = styled('span', {
        flex: '0 0 auto',
        opacity: '.5',
        font: '12px var(--deckit-font)',
        whiteSpace: 'nowrap',
    });
    bar.append(field.element, count);

    const side = styled('div', { display: 'flex', flexDirection: 'column', minHeight: '0' });

    const axisHead = ui.section({
        label: 'Axes',
        icon: ui.icon('layers', { size: 16 }),
        collapsed: !!store.get('folds', {}).Axes,
        onToggle: (on) => {
            store.set('folds', { ...store.get('folds', {}), Axes: on });
            axisHead.setCollapsed(on);
        },
    });
    const axisParts = new WeakMap();
    const paintAxis = (rowElement, entry) => {
        const drawn = axisParts.get(rowElement);
        drawn.label.textContent = entry.name || 'All notes';
        drawn.count.textContent = entry.count ? String(entry.count) : '';
        drawn.row.setActive(entry.name === axis);
    };
    const axisList = ui.list({
        key: (entry) => entry.name || '',
        create: (entry) => {
            const row = ui.row();
            const label = styled('span', {
                flex: '1 1 auto',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            });
            const countLabel = styled('span', { flex: '0 0 auto', opacity: '.45', font: '12px var(--deckit-font)' });
            row.element.append(label, countLabel);
            row.element.addEventListener('click', () => chooseAxis(entry.name));
            axisParts.set(row.element, { row, label, count: countLabel });
            paintAxis(row.element, entry);
            return row.element;
        },
        update: paintAxis,
    });
    axisHead.body.append(axisList.element);
    side.append(axisHead.element);

    const renderAxes = () => axisList.set([{ name: null, count: axes.total }, ...axes.axes]);

    const chooseAxis = (name) => {
        axis = name;
        store.set('axis', name);
        renderAxes();
        refresh();
    };

    const LIST_MIN = 200,
        READER_MIN = 320,
        LIST_KEY = 'list-width';
    const pane = styled('div', {
        display: 'none',
        flex: '1 1 auto',
        minHeight: '0',
        borderTop: 'var(--deckit-border)',
    });
    const list = styled('div', {
        flex: '0 0 auto',
        width: Math.max(LIST_MIN, store.get(LIST_KEY, 300)) + 'px',
        minWidth: LIST_MIN + 'px',

        maxWidth: `calc(100% - ${READER_MIN}px)`,
        overflowY: 'auto',
        padding: '8px',
        borderRight: 'var(--deckit-border)',
        boxSizing: 'border-box',
    });
    const reader = styled('div', {
        flex: '1 1 auto',
        minWidth: '0',
        overflowY: 'auto',
        padding: '18px 26px 48px',
        position: 'relative',
    });
    ui.edgeFade(list);
    ui.edgeFade(reader);

    const LINE_IDLE = `color-mix(in srgb, var(--deckit-text) 26%, var(--deckit-background))`;
    const LINE_HOT = `color-mix(in srgb, var(--deckit-text) 62%, var(--deckit-background))`;
    const divider = styled('div', { flex: '0 0 auto', width: '0', position: 'relative', zIndex: '1' });
    const hit = styled('div', {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '-4px',
        width: '8px',
        cursor: 'col-resize',
    });
    const line = styled('div', {
        position: 'absolute',
        top: '0',
        bottom: '0',
        left: '-1px',
        width: '2px',
        background: LINE_IDLE,
        opacity: '0',
        transition:
            'opacity var(--deckit-fast) var(--deckit-easing), background-color var(--deckit-fast) var(--deckit-easing)',
    });
    hit.title = 'Drag to resize';
    divider.append(line, hit);
    let dragging = false;
    const paintLine = (on) => {
        line.style.opacity = on ? '1' : '0';
        line.style.background = dragging ? LINE_HOT : LINE_IDLE;
    };
    hit.addEventListener('mouseenter', () => paintLine(true));
    hit.addEventListener('mouseleave', () => {
        if (!dragging) paintLine(false);
    });
    ui.resizer(hit, {
        axis: 'x',
        size: () => list.getBoundingClientRect().width,
        min: LIST_MIN,
        max: () => Math.max(LIST_MIN, pane.getBoundingClientRect().width - READER_MIN),
        onResize: (pixels) => {
            list.style.width = pixels + 'px';
        },
        onCommit: (pixels) => {
            list.style.width = pixels + 'px';
            store.set(LIST_KEY, Math.round(pixels));
        },
        onDrag: (on) => {
            dragging = on;
            paintLine(on || hit.matches(':hover'));
        },
    });
    pane.append(list, divider, reader);

    let trail = [];
    let current = null;
    let reading = 0;

    const chip = (text, style = {}) =>
        styled(
            'span',
            {
                padding: '1px 8px',
                borderRadius: '999px',
                border: 'var(--deckit-border)',
                font: '11.5px var(--deckit-font)',
                whiteSpace: 'nowrap',
                ...style,
            },
            text
        );
    const hoverWash = (node) => {
        node.classList.add('bot-pressable');
        return node;
    };
    const noteLink = (id) => {
        const anchor = styled('span', { color: LINK, cursor: 'pointer', font: '12px ' + MONO }, id);
        anchor.title = 'Open ' + id;
        anchor.addEventListener('mouseenter', () => {
            anchor.style.textDecoration = 'underline';
        });
        anchor.addEventListener('mouseleave', () => {
            anchor.style.textDecoration = 'none';
        });
        anchor.addEventListener('click', () => open(id, true));
        return anchor;
    };

    const SHOWN_ABOVE = new Set(['id', 'title', 'summary', 'axis', 'tags']);
    const NOTE_REFS = new Set(['template', 'promoted_from', 'promoted_to', 'supersedes', 'superseded_by']);
    const value = (key, given) => {
        const box = styled('div', {
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px 6px',
            minWidth: '0',
            alignItems: 'center',
        });
        if (key === 'source') Object.assign(box.style, { flexDirection: 'column', alignItems: 'flex-start' });
        for (const item of Array.isArray(given) ? given : [given]) {
            if (NOTE_REFS.has(key) && typeof item === 'string') box.append(noteLink(item));
            else if (typeof item === 'string' && /^https?:\/\/\S+$/.test(item))
                box.append(markdown.link(item, item, { font: '12px ' + MONO }));
            else if (key === 'source')
                box.append(
                    styled('span', { font: '12px ' + MONO, opacity: '.8', wordBreak: 'break-all' }, String(item))
                );
            else if (Array.isArray(given)) box.append(chip(String(item)));
            else if (typeof item === 'boolean') box.append(styled('span', {}, item ? 'yes' : 'no'));
            else if (item && typeof item === 'object')
                box.append(styled('span', { font: '12px ' + MONO }, JSON.stringify(item)));
            else box.append(styled('span', {}, String(item)));
        }
        return box;
    };
    const properties = (note) => {
        const frontmatter = note.frontmatter || {};
        const rows = Object.keys(frontmatter)
            .filter((key) => !SHOWN_ABOVE.has(key))
            .map((key) => [key, value(key, frontmatter[key])]);
        const stats = note.stats || {};
        if (stats.edited_at) rows.push(['edited', value('', when(stats.edited_at))]);
        if (stats.created_at) rows.push(['created', value('', when(stats.created_at))]);
        if (stats.hit_count != null)
            rows.push(['recalled', value('', stats.hit_count === 1 ? 'once' : `${stats.hit_count} times`)]);
        if (note.path)
            rows.push([
                'path',
                styled('span', { font: '12px ' + MONO, opacity: '.7', wordBreak: 'break-all' }, note.path),
            ]);
        const grid = styled('div', {
            display: 'grid',
            gridTemplateColumns: '96px minmax(0, 1fr)',
            gap: '5px 12px',
            margin: '10px 0 0',
            font: '12.5px/1.5 var(--deckit-font)',
        });
        for (const [key, shown] of rows) grid.append(styled('span', { opacity: '.45' }, key), shown);
        return grid;
    };

    const glideTo = (heading) => {
        const top = reader.scrollTop + heading.getBoundingClientRect().top - reader.getBoundingClientRect().top - 12;
        const still = !theme.motion.base;
        reader.scrollTo({ top, behavior: still ? 'auto' : 'smooth' });
        if (still) return;

        const mark = () =>
            heading.animate([{ background: 'rgba(128,128,128,.24)' }, { background: 'transparent' }], {
                duration: 1100,
                easing: theme.motion.easing,
            });
        reader.addEventListener('scrollend', mark, { once: true });
    };
    const contents = (body) => {
        const headings = [...body.querySelectorAll('[data-heading]')];
        if (headings.length < 2) return null;
        const box = styled('div', { margin: '14px 0 0', font: '12.5px/1.5 var(--deckit-font)' });
        box.append(styled('div', { opacity: '.45', margin: '0 0 4px' }, 'Contents'));
        const top = Math.min(...headings.map((heading) => Number(heading.dataset.level)));
        for (const heading of headings) {
            const entry = styled(
                'div',
                {
                    padding: '2px 8px',
                    paddingLeft: (Number(heading.dataset.level) - top) * 14 + 8 + 'px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: `color-mix(in srgb, var(--deckit-text) 80%, var(--deckit-background))`,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                },
                heading.dataset.heading
            );
            entry.title = heading.dataset.heading;
            entry.addEventListener('click', () => glideTo(heading));
            box.append(hoverWash(entry));
        }
        return box;
    };

    const related = async (id, mine) => {
        const found = await bot.brain.related(id).catch(() => []);
        if (mine !== reading || !found.length) return;
        const box = styled('div', { margin: '28px 0 0', paddingTop: '14px', borderTop: 'var(--deckit-border)' });
        box.append(styled('div', { font: '700 13px var(--deckit-font)', opacity: '.7', margin: '0 0 8px' }, 'Related'));
        for (const result of found) {
            const item = styled('div', { padding: '6px 8px', borderRadius: '7px', cursor: 'pointer' });
            item.append(
                styled(
                    'div',
                    {
                        font: '600 13px/1.4 var(--deckit-font)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    },
                    result.title || result.id
                ),
                styled(
                    'div',
                    {
                        font: '12px/1.45 var(--deckit-font)',
                        opacity: '.55',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    },
                    `${result.axis} · ${result.summary || ''}`
                )
            );
            item.title = result.id;
            item.addEventListener('click', () => open(result.id, true));
            box.append(hoverWash(item));
        }
        reader.append(box);
    };

    const showNote = (note, mine) => {
        const frontmatter = note.frontmatter || {};
        reader.textContent = '';
        if (trail.length) {
            const previous = trail[trail.length - 1];
            const back = ui.button({
                label: previous,
                title: 'Back to ' + previous,
                size: 'small',
                icon: ui.icon('chevronLeft', { size: 14 }),
                onClick: () => open(trail.pop(), false),
            });
            back.element.style.margin = '0 0 12px';
            back.element.style.maxWidth = '100%';
            reader.append(back.element);
        }
        reader.append(
            styled('div', { font: '700 20px/1.35 var(--deckit-font)', margin: '0 0 4px' }, frontmatter.title || note.id)
        );
        const meta = styled('div', {
            opacity: '.5',
            font: '12px var(--deckit-font)',
            margin: '0 0 8px',
            minWidth: '0',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
        });
        meta.append(`${frontmatter.axis || note.axis || ''} · `, styled('span', { font: '11.5px ' + MONO }, note.id));
        reader.append(meta);
        if (frontmatter.summary)
            reader.append(
                styled(
                    'div',
                    { opacity: '.7', font: '13.5px/1.55 var(--deckit-font)', margin: '0 0 8px' },
                    frontmatter.summary
                )
            );
        const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
        if (tags.length) {
            const row = styled('div', { display: 'flex', flexWrap: 'wrap', gap: '5px', margin: '0 0 4px' });
            for (const tag of tags) row.append(chip('#' + tag, { opacity: '.7' }));
            reader.append(row);
        }
        reader.append(properties(note));
        const body = markdown(note.body);
        ui.selectable(body);
        const map = contents(body);
        if (map) reader.append(map);
        reader.append(styled('div', { borderTop: 'var(--deckit-border)', margin: '14px 0 16px' }), body);
        reader.scrollTop = 0;
        related(note.id, mine);
    };

    const open = async (id, follow) => {
        if (follow && current && current !== id) trail.push(current);
        const mine = ++reading;
        current = id;
        store.set('note', id);
        paintSelection();
        reader.textContent = '';
        reader.append(ui.loading().element);
        try {
            const note = await bot.brain.get(id);
            if (mine !== reading) return;
            if (!note) throw new Error('No note ' + id);
            showNote(note, mine);
        } catch (error) {
            if (mine !== reading) return;
            reader.textContent = '';
            reader.append(quiet(String(error?.message || error)));
        }
    };

    let rows = [];
    let selected = -1;
    let asked = 0;
    const rowElements = [];

    const paintSelection = () => {
        rowElements.forEach((rowElement, index) =>
            rowElement.toggleAttribute('data-active', rows[index]?.id === current)
        );
    };

    const resultRow = (row, index) => {
        const rowElement = styled('div', { padding: '7px 10px', borderRadius: '7px', cursor: 'pointer' });
        rowElement.append(
            styled(
                'div',
                {
                    font: '600 13px/1.4 var(--deckit-font)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                },
                row.title || row.id
            )
        );
        if (row.summary) {
            rowElement.append(
                styled(
                    'div',
                    {
                        font: '12px/1.45 var(--deckit-font)',
                        opacity: '.6',
                        margin: '2px 0 0',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        webkitLineClamp: '2',
                        webkitBoxOrient: 'vertical',
                    },
                    row.summary
                )
            );
        }

        const where = row.section
            ? String(row.section)
                  .split(' > ')
                  .pop()
                  .replace(/^#+\s*/, '')
            : ago(row.edited_at);
        rowElement.append(
            styled(
                'div',
                {
                    font: '11px var(--deckit-font)',
                    opacity: '.42',
                    margin: '3px 0 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                },
                [row.axis, row.priority === 'eager' ? 'eager' : '', where].filter(Boolean).join(' · ')
            )
        );
        rowElement.title = row.id;
        rowElement.addEventListener('click', () => {
            selected = index;
            trail = [];
            open(row.id, false);
        });
        return hoverWash(rowElement);
    };

    const axisTotal = () => (axis ? axes.axes.find((entry) => entry.name === axis)?.count : axes.total) || 0;

    const SEARCH_LIMIT = 30;
    const showResults = () => {
        list.textContent = '';
        rowElements.length = 0;
        const total = axisTotal();
        count.textContent = query
            ? rows.length >= SEARCH_LIMIT
                ? `${rows.length}+ notes`
                : rows.length === 1
                  ? '1 note'
                  : `${rows.length} notes`
            : rows.length
              ? `${rows.length < total ? rows.length + ' of ' + total : rows.length} · recently edited`
              : '';
        if (!rows.length) {
            list.append(quiet(query ? 'No note matches' : 'No notes'));
            return;
        }
        rows.forEach((row, index) => {
            const rowElement = resultRow(row, index);
            rowElements.push(rowElement);
            list.append(rowElement);
        });
        paintSelection();
    };

    const refresh = async () => {
        const mine = ++asked;
        try {
            const found = query ? await bot.brain.search(query, SEARCH_LIMIT, axis) : await bot.brain.list(axis, 200);
            if (mine !== asked) return;
            rows = Array.isArray(found) ? found : [];
            selected = rows.findIndex((row) => row.id === current);
            list.scrollTop = 0;
            showResults();
        } catch (error) {
            if (mine !== asked) return;
            rows = [];
            list.textContent = '';
            count.textContent = '';
            list.append(quiet(String(error?.message || error)));
        }
    };

    let typing = null;
    input.addEventListener('input', () => {
        clearTimeout(typing);
        typing = setTimeout(() => {
            query = input.value.trim();
            store.set('query', query);
            refresh();
        }, SEARCH_DELAY_MS);
    });

    input.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
        if (!rows.length) return;
        event.preventDefault();
        if (event.key === 'Enter' && selected >= 0) return;
        const next = event.key === 'ArrowUp' ? Math.max(0, selected - 1) : Math.min(rows.length - 1, selected + 1);
        if (next === selected) return;
        selected = next;
        trail = [];
        open(rows[next].id, false);
        rowElements[next]?.scrollIntoView({ block: 'nearest' });
    });

    // A brain that does not answer has no axes; the list says why.
    let axesAsked = 0;
    const loadAxes = () => {
        const mine = ++axesAsked;
        return bot.brain.axes().then(
            (answer) => {
                if (mine !== axesAsked) return;
                axes = answer;
                renderAxes();
                if (!query) showResults();
            },
            () => {
                if (mine !== axesAsked) return;
                axes = { total: 0, axes: [] };
                renderAxes();
            }
        );
    };

    let woke = false;
    const wake = () => {
        if (woke) return;
        woke = true;
        input.value = query;
        renderAxes();
        loadAxes();
        refresh();
        const last = store.get('note', null);
        if (last) open(last, false);
        else {
            const empty = ui.emptyState({
                icon: ui.icon('brain', { size: 44 }),
                title: 'Nothing open',
                hint: 'Pick a note on the left to read it here.',
            });
            Object.assign(empty.element.style, { position: 'absolute', inset: '0' });
            reader.append(empty.element);
        }
    };

    const PAGE_MIN = 2,
        PAGE_LIMIT = 8;
    const searchPage = (raw, { signal } = {}) => {
        const text = String(raw || '').trim();
        if (!text) return [];
        const go = (then) => () => {
            reveal();
            then();
        };
        const searchAll = {
            label: `Search the brain for “${text}”`,
            hint: 'Brain',
            icon: ui.icon('search', { size: 16 }),
            run: go(() => find(text)),
        };
        if (text.length < PAGE_MIN) return [searchAll];
        return new Promise((settle, refuse) => {
            const pending = setTimeout(() => {
                bot.brain
                    .search(text, PAGE_LIMIT)
                    .catch(() => [])
                    .then((found) =>
                        settle([
                            ...(found || []).map((result) => ({
                                label: result.title || result.id,
                                hint: result.axis,
                                icon: ui.icon('fileText', { size: 16 }),
                                run: go(() => read(result.id)),
                            })),
                            searchAll,
                        ])
                    );
            }, SEARCH_DELAY_MS);
            signal?.addEventListener(
                'abort',
                () => {
                    clearTimeout(pending);
                    refuse(signal.reason);
                },
                { once: true }
            );
        });
    };

    const find = (text) => {
        wake();
        if (axis !== null) {
            axis = null;
            store.set('axis', null);
            renderAxes();
        }
        query = String(text || '').trim();
        input.value = query;
        store.set('query', query);
        refresh();
    };
    const read = (id) => {
        wake();
        trail = [];
        open(id, false);
    };

    return {
        bar,
        side,
        pane,
        show: () => {
            wake();
            input.focus();
            input.select();
        },
        back: () => {
            if (trail.length) open(trail.pop(), false);
        },
        // Another brain is read: what was listed and the note open are read again from it.
        reload: () => {
            if (!woke) return;
            loadAxes();
            refresh();
            if (current) open(current, false);
        },
        commands: () => [
            {
                label: 'Search the Brain',
                hint: 'What the bot knows',
                icon: ui.icon('search', { size: 16 }),
                group: 'LLMemory',
                keywords: ['brain', 'memory', 'note', 'search', 'llmemory', '브레인', '기억', '지식', '노트', '검색'],
                page: { placeholder: 'Search the brain', search: searchPage },
            },
        ],
    };
};

module.exports = { brainView };
