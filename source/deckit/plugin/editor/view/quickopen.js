const quickOpen = ({ theme, ui, ranker, list: listOf, root, onOpen }) => {
    /* Ranked in a worker: forty thousand paths take a few hundred milliseconds. Two rankers, so a
     search in the box and one for the switcher's page do not cancel each other. */
    const SHOWN = 50;
    const boxRanker = ranker({ paths: true });
    const pageRanker = ranker({ paths: true });

    const box = el('div', {
        display: 'flex',
        flexDirection: 'column',
        minHeight: '0',
        maxHeight: '60vh',
        font: '13px ' + theme.font,
    });
    // Not shrinkable: a long list must not squeeze the field.
    const input = el('input', {
        flex: '0 0 42px',
        height: '42px',
        padding: '0 14px',
        border: '0',
        borderBottom: theme.border,
        outline: 'none',
        background: 'transparent',
        color: 'inherit',
        font: '15px ' + theme.font,
    });
    input.placeholder = 'Open Quickly';
    input.spellcheck = false;
    const list = el('div', { flex: '1 1 auto', minHeight: '0', overflowY: 'auto', padding: '4px' });
    // Rows redraw under a resting mouse as the name is typed, so hover selects only once it moves.
    ui.hoverIntent(list, (e) => {
        const i = [...list.children].findIndex((r) => r.contains(e.target));
        if (i >= 0 && i !== at && shown.files[i] !== undefined) {
            at = i;
            paintAt();
        }
    });
    const note = el('div', {
        display: 'none',
        padding: '6px 14px',
        borderTop: theme.border,
        opacity: '.5',
        font: '11.5px ' + theme.font,
    });
    box.append(input, list, note);

    /* The folder is kept with the rows, and a row opens in it, not in whichever is in front by then:
     two checkouts of one repository list the same relative paths. */
    let shown = { root: null, query: '', files: [] };
    let failed = '';
    let at = 0;
    // Restyled, not redrawn: a row replaced under the pointer between press and release loses the click.
    const paintAt = () => {
        [...list.children].forEach((r, i) => {
            r.style.background = i === at ? theme.color.selected : 'transparent';
        });
        list.children[at]?.scrollIntoView({ block: 'nearest' });
    };
    const render = () => {
        list.textContent = '';
        if (!shown.files.length) {
            list.appendChild(
                el(
                    'div',
                    { padding: '12px 12px', opacity: '.45' },
                    !root()
                        ? 'Open a folder first'
                        : listing
                          ? 'Listing the files…'
                          : failed
                            ? 'Could not list the files: ' + failed
                            : input.value
                              ? 'No matching files'
                              : 'Type part of a file name'
                )
            );
            return;
        }
        shown.files.forEach((rel, i) => {
            const r = el('div', {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minHeight: '30px',
                padding: '0 10px',
                borderRadius: '7px',
                cursor: 'pointer',
                background: i === at ? theme.color.selected : 'transparent',
            });
            const glyph = el('span', { display: 'flex' });
            glyph.innerHTML = fileIcons.file(rel, 15);
            const name = el('span', { flex: '0 0 auto', fontWeight: '600' }, rel.split('/').pop());
            const dir = el(
                'span',
                {
                    flex: '1 1 auto',
                    minWidth: '0',
                    opacity: '.45',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    font: '12px ' + theme.font,
                },
                rel.split('/').slice(0, -1).join('/')
            );
            r.append(glyph, name, dir);
            // On mousedown: the field losing focus must not come first.
            r.addEventListener('mousedown', (e) => {
                e.preventDefault();
                choose(i);
            });
            list.appendChild(r);
        });
        list.children[at]?.scrollIntoView({ block: 'nearest' });
    };
    let asked = 0;
    let listing = false;
    /* An Enter pressed before the field's text was ranked. State rather than a chained promise, so
     closing the box or typing more cancels it. */
    let pick = false;
    const filter = async () => {
        const mine = ++asked;
        const base = root();
        const query = input.value;
        if (!base) {
            listing = false;
            shown = { root: null, query, files: [] };
            at = 0;
            render();
            return;
        }
        listing = true;
        let got,
            why = '';
        try {
            got = (await listOf()) || { files: [], truncated: false };
        } catch (e) {
            got = { files: [], truncated: false };
            why = failureOf(e).message;
        }
        if (mine !== asked) return;
        if (root() !== base) return filter();
        const ranked = await boxRanker.rank(got.files || [], query, { limit: SHOWN });
        if (!ranked || mine !== asked) return;
        if (root() !== base) return filter();
        listing = false;
        failed = why;
        shown = { root: base, query, files: ranked };
        at = 0;
        render();
        note.textContent = got.truncated
            ? `This folder has more files than can be listed; ${got.files.length} of them are searched.`
            : '';
        note.style.display = got.truncated ? 'block' : 'none';
        if (pick && open && query === input.value) {
            pick = false;
            choose(at);
        }
    };

    let open = false,
        sheet = null;
    const show = () => {
        if (open) {
            input.select();
            return;
        }
        open = true;
        shown = { root: null, query: '', files: [] };
        listing = true;
        render();
        sheet = ui.modal({
            chrome: false,
            align: 'top',
            width: 'min(560px, calc(100vw - 40px))',
            fill: (card) => {
                Object.assign(card.style, {
                    padding: '0',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                });
                card.appendChild(box);
                return input;
            },
            onClose: () => {
                open = false;
                pick = false;
                sheet = null;
            },
        });
        filter();
    };
    const hide = () => {
        pick = false;
        sheet?.close();
    };
    const choose = (i) => {
        const rel = shown.files[i];
        hide();
        if (rel && shown.root) onOpen(shown.root + '/' + rel);
    };

    let typing = null;
    input.addEventListener('input', () => {
        pick = false; // an Enter meant the words before these
        clearTimeout(typing);
        typing = setTimeout(() => {
            typing = null;
            filter();
        }, 60);
    });
    input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            at = Math.min(at + 1, shown.files.length - 1);
            paintAt();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            at = Math.max(at - 1, 0);
            paintAt();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (typing || listing || shown.query !== input.value || shown.root !== root()) {
                clearTimeout(typing);
                typing = null;
                pick = true;
                filter();
            } else choose(at);
        }
    });

    // Empty when a newer query cancelled this one.
    const rank = async (files, query) => (await pageRanker.rank(files, query, { limit: SHOWN })) || [];
    return { show, rank };
};
