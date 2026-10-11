DeckitModule.define('deckit/ui/component/field', { uses: ['deckit/ui/token'], provides: ['make'] }, (T) => {
    const { MOTION, icon, pressable } = T;

    return {
        make: (theme, ui, inner) => {
            const { QUIET } = inner;
            return {
                field({
                    placeholder = '',
                    value = '',
                    icon: glyph = '',
                    inline = [],
                    trailing = [],
                    size = 'md',
                    clearable = false,
                    onInput,
                    onEnter,
                    onEscape,
                } = {}) {
                    const box = document.createElement('label');
                    const h = size === 'sm' ? 26 : 28;
                    Object.assign(box.style, {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flex: '1 1 auto',
                        minWidth: '0',
                        boxSizing: 'border-box',
                        height: h + 'px',
                        padding: glyph ? '0 4px 0 9px' : '0 4px 0 11px',
                        borderRadius: '999px',
                        background: T.WASH.hover,
                        boxShadow: 'inset 0 0 0 1px transparent',
                        cursor: 'text',
                        transition: `box-shadow ${MOTION.fast} ${MOTION.ease}`,
                    });
                    if (glyph) {
                        const g = document.createElement('span');
                        g.innerHTML = glyph;
                        Object.assign(g.style, { display: 'flex', flex: '0 0 auto', opacity: '.5' });
                        box.appendChild(g);
                    }
                    const input = document.createElement('input');
                    input.spellcheck = false;
                    input.placeholder = placeholder;
                    input.value = value;
                    Object.assign(input.style, {
                        flex: '1 1 auto',
                        minWidth: '0',
                        height: '100%',
                        padding: '0',
                        border: '0',
                        outline: 'none',
                        background: 'transparent',
                        color: theme.contentColor,
                        font: (size === 'sm' ? '12.5px ' : '13px ') + theme.font,
                    });
                    input.addEventListener('focus', () => {
                        box.style.boxShadow = `inset 0 0 0 1px ${T.FOCUS_RING}`;
                    });
                    input.addEventListener('blur', () => {
                        box.style.boxShadow = 'inset 0 0 0 1px transparent';
                    });
                    if (onInput) input.addEventListener('input', () => onInput(input.value));
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && onEnter) {
                            e.preventDefault();
                            onEnter(input.value, e.shiftKey);
                        } else if (e.key === 'Escape' && onEscape) {
                            e.preventDefault();
                            e.stopPropagation();
                            onEscape();
                        }
                    });
                    const clear = document.createElement('button');
                    if (clearable) {
                        clear.type = 'button';
                        clear.title = 'Clear';
                        clear.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="display:block"><circle cx="12" cy="12" r="10" fill="currentColor" opacity=".45"/><path d="m15 9-6 6M9 9l6 6" stroke="${theme.contentBg}" stroke-width="2.2" stroke-linecap="round"/></svg>`;
                        Object.assign(clear.style, {
                            display: 'none',
                            flex: '0 0 auto',
                            padding: '0 2px',
                            border: '0',
                            background: 'transparent',
                            color: theme.contentColor,
                            cursor: 'pointer',
                        });
                        clear.addEventListener('mousedown', (e) => e.preventDefault());
                        clear.addEventListener('click', (e) => {
                            e.preventDefault();
                            input.value = '';
                            sync();
                            onInput?.('');
                            input.focus();
                        });
                    }
                    const sync = () => {
                        if (clearable) clear.style.display = input.value ? 'flex' : 'none';
                    };
                    input.addEventListener('input', sync);
                    box.append(input, ...inline, ...(clearable ? [clear] : []), ...trailing);
                    box.input = input;
                    box.setValue = (v) => {
                        input.value = v;
                        sync();
                    };
                    sync();
                    return box;
                },
                stepper({ value = 0, min = -Infinity, max = Infinity, step = 1, unit = '', onChange } = {}) {
                    const box = document.createElement('div');
                    Object.assign(box.style, {
                        display: 'flex',
                        alignItems: 'center',
                        flex: '0 0 auto',
                        height: '26px',
                        borderRadius: '999px',
                        background: T.WASH.hover,
                        padding: '0 2px',
                    });
                    let current = value;
                    const clamp = (v) => Math.min(max, Math.max(min, Math.round(v / step) * step));
                    const input = document.createElement('input');
                    input.spellcheck = false;
                    Object.assign(input.style, {
                        width: '44px',
                        height: '100%',
                        border: '0',
                        outline: 'none',
                        background: 'transparent',
                        textAlign: 'center',
                        color: theme.contentColor,
                        font: '12.5px ' + theme.font,
                        fontVariantNumeric: 'tabular-nums',
                        padding: '0',
                    });
                    const show = () => {
                        input.value = String(+current.toFixed(4)) + unit;
                    };
                    const commit = (v) => {
                        const next = clamp(Number.isFinite(v) ? v : current);
                        const changed = next !== current;
                        current = next;
                        show();
                        if (changed) onChange?.(current);
                    };
                    const base = () => {
                        const typed = parseFloat(input.value);
                        return Number.isFinite(typed) ? clamp(typed) : current;
                    };
                    const button = (glyph, title, delta) => {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.title = title;
                        b.innerHTML = icon(glyph, 13);
                        Object.assign(b.style, {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            border: '0',
                            borderRadius: '999px',
                            background: 'transparent',
                            color: QUIET,
                            cursor: 'pointer',
                            padding: '0',
                        });
                        pressable(b);
                        b.addEventListener('mousedown', (e) => e.preventDefault());
                        // From what is typed, if anything is: the press keeps the focus, so no blur has kept it yet.
                        b.addEventListener('click', () => commit(base() + delta));
                        return b;
                    };
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            commit(parseFloat(input.value));
                            input.blur();
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            commit(base() + step);
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            commit(base() - step);
                        } else if (e.key === 'Escape') {
                            e.preventDefault();
                            e.stopPropagation();
                            show();
                            input.blur();
                        }
                    });
                    input.addEventListener('blur', () => commit(parseFloat(input.value)));
                    box.append(button('minus', 'Less', -step), input, button('plus', 'More', step));
                    show();
                    Object.defineProperty(box, 'value', {
                        get: () => current,
                        set: (v) => {
                            current = clamp(v);
                            show();
                        },
                    });
                    return box;
                },
                searchBar({
                    placeholder = 'Find',
                    options = ['case', 'word', 'regex'],
                    nav = false,
                    replace = null,
                    onChange,
                    onNext,
                    onPrev,
                    onEscape,
                } = {}) {
                    const root = document.createElement('div');
                    Object.assign(root.style, { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '0' });
                    const line = () => {
                        const l = document.createElement('div');
                        Object.assign(l.style, { display: 'flex', alignItems: 'center', gap: '2px', minWidth: '0' });
                        return l;
                    };
                    const state = { query: '', caseSensitive: false, word: false, regex: false };
                    const changed = () => onChange?.({ ...state });

                    const OPTION = {
                        case: ['caseSensitive', 'Aa', 'Match case'],
                        word: ['word', 'ab', 'Whole word'],
                        regex: ['regex', '.*', 'Regular expression'],
                    };
                    const toggles = options
                        .filter((o) => OPTION[o])
                        .map((o) => {
                            const [key, label, title] = OPTION[o];
                            const t = ui.toggleButton(label, title, {
                                onChange: (on) => {
                                    state[key] = on;
                                    changed();
                                },
                            });
                            Object.assign(t.style, {
                                font: '600 11.5px ui-monospace, SFMono-Regular, Menlo, monospace',
                                lineHeight: '20px',
                            });
                            if (key === 'word')
                                Object.assign(t.style, {
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '3px',
                                    textDecorationThickness: '1px',
                                });
                            t.dataset.option = key;
                            return t;
                        });
                    const count = document.createElement('span');
                    Object.assign(count.style, {
                        flex: '0 0 auto',
                        padding: '0 4px',
                        color: QUIET,
                        font: '12px ' + theme.font,
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap',
                    });
                    const find = ui.field({
                        placeholder,
                        size: 'sm',
                        icon: icon('search', 13),
                        clearable: true,
                        trailing: toggles,
                        inline: nav ? [count] : [],
                        onInput: (v) => {
                            state.query = v;
                            changed();
                        },
                        onEnter: (_v, back) => {
                            if (nav) (back ? onPrev : onNext)?.();
                            else changed();
                        },
                        onEscape: () => onEscape?.(),
                    });

                    const first = line();
                    let open = !!replace?.open;
                    let caret = null;
                    if (replace) {
                        caret = ui.iconBtn(icon('chevronRight', 14), 'Replace', () => setReplaceOpen(!open), {
                            size: 'sm',
                        });
                        caret.style.transition = `transform ${MOTION.fast} ${MOTION.ease}`;
                        first.appendChild(caret);
                    }
                    find.style.maxWidth = '460px';
                    first.append(find);
                    if (nav) {
                        first.append(
                            ui.iconBtn(icon('chevronUp', 15), 'Previous (\u21e7\u21a9)', () => onPrev?.(), {
                                size: 'sm',
                            }),
                            ui.iconBtn(icon('chevronDown', 15), 'Next (\u21a9)', () => onNext?.(), { size: 'sm' })
                        );
                    }
                    root.appendChild(first);

                    let with_ = null;
                    let second = null;
                    if (replace) {
                        second = line();
                        // Lines the replace field up under the find field, past the chevron.
                        const indent = document.createElement('span');
                        Object.assign(indent.style, {
                            flex: '0 0 auto',
                            width: caret ? caret.style.width || '26px' : '0',
                        });
                        with_ = ui.field({
                            placeholder: 'Replace',
                            size: 'sm',
                            icon: icon('replace', 13),
                            onEnter: () => (replace.onReplace || replace.onReplaceAll)?.(),
                            onEscape: () => onEscape?.(),
                        });
                        with_.style.maxWidth = '460px';
                        second.append(indent, with_);
                        if (replace.onReplace)
                            second.appendChild(
                                ui.iconBtn(icon('replace', 15), 'Replace', () => replace.onReplace(), { size: 'sm' })
                            );
                        second.appendChild(
                            ui.iconBtn(icon('replaceAll', 15), 'Replace all', () => replace.onReplaceAll(), {
                                size: 'sm',
                            })
                        );
                        root.appendChild(second);
                    }
                    const setReplaceOpen = (on, { focus = true } = {}) => {
                        if (!replace) return;
                        open = !!on;
                        second.style.display = open ? 'flex' : 'none';
                        caret.style.transform = open ? 'rotate(90deg)' : 'none';
                        caret.title = open ? 'Hide replace' : 'Replace';
                        if (open && focus) with_.input.focus();
                    };
                    setReplaceOpen(open, { focus: false });

                    root.setQuery = (text, opts = {}) => {
                        find.setValue(text);
                        state.query = text;
                        for (const t of toggles)
                            if (t.dataset.option in opts) {
                                t.value = !!opts[t.dataset.option];
                                state[t.dataset.option] = !!opts[t.dataset.option];
                            }
                    };
                    root.focus = (which = 'find') => {
                        const i = which === 'replace' && with_ ? with_.input : find.input;
                        i.focus();
                        i.select();
                    };
                    root.setCount = (active, total) => {
                        count.textContent = !state.query ? '' : total ? `${active || '\u2013'}/${total}` : '0/0';
                    };
                    root.setReplaceOpen = setReplaceOpen;
                    root.setCount(0, 0);
                    Object.defineProperty(root, 'state', { get: () => ({ ...state }) });
                    Object.defineProperty(root, 'replacement', { get: () => (with_ ? with_.input.value : '') });
                    return root;
                },
            };
        },
    };
});
