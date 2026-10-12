DeckitModule.define('deckit/ui/component/field', { uses: ['deckit/ui/icon'], provides: ['STYLE', 'make'] }, (ICON) => {
    // MARK: - Property
    const STYLE = `
            .deckit-field {
                display: flex;
                align-items: center;
                gap: 4px;
                flex: 1 1 auto;
                min-width: 0;
                box-sizing: border-box;
                height: 28px;
                padding: 0 4px 0 11px;
                border-radius: var(--deckit-radius-round);
                background: var(--deckit-fill);
                box-shadow: inset 0 0 0 1px transparent;
                cursor: text;
                transition: box-shadow var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-field[data-size='small'] { height: 26px; }
            .deckit-field[data-icon] { padding-left: 9px; }
            .deckit-field:focus-within { box-shadow: inset 0 0 0 1px var(--deckit-focus); }
            .deckit-field-icon { display: flex; flex: 0 0 auto; opacity: 0.5; }
            .deckit-field-input,
            .deckit-stepper-input {
                height: 100%;
                padding: 0;
                border: 0;
                outline: none;
                background: transparent;
                color: var(--deckit-text);
                font: var(--deckit-type-body);
            }
            .deckit-field-input { flex: 1 1 auto; min-width: 0; }
            .deckit-field[data-size='small'] .deckit-field-input { font: var(--deckit-type-small); }
            .deckit-field-clear { display: none; flex: 0 0 auto; padding: 0 2px; border: 0; background: transparent; cursor: pointer; }
            .deckit-field[data-filled] .deckit-field-clear { display: flex; }
            .deckit-field-clear circle { fill: var(--deckit-text); opacity: 0.45; }
            .deckit-field-clear path { stroke: var(--deckit-background); }
            .deckit-stepper {
                display: flex;
                align-items: center;
                flex: 0 0 auto;
                height: 26px;
                padding: 0 2px;
                border-radius: var(--deckit-radius-round);
                background: var(--deckit-fill);
            }
            .deckit-stepper-input { width: 44px; text-align: center; font-variant-numeric: tabular-nums; }
            .deckit-stepper-button {
                width: 22px;
                height: 22px;
                border-radius: var(--deckit-radius-round);
                color: var(--deckit-muted);
            }
            .deckit-find { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
            .deckit-find-line { display: flex; align-items: center; gap: 2px; min-width: 0; }
            .deckit-find-line[hidden] { display: none; }
            .deckit-find .deckit-field { max-width: 460px; }
            .deckit-find-option { font: 600 11.5px var(--deckit-mono); line-height: 20px; }
            .deckit-find-option[data-option='word'] {
                text-decoration: underline;
                text-underline-offset: 3px;
                text-decoration-thickness: 1px;
            }
            .deckit-find-count {
                flex: 0 0 auto;
                padding: 0 4px;
                color: var(--deckit-muted);
                font: var(--deckit-type-small);
                font-variant-numeric: tabular-nums;
                white-space: nowrap;
            }
            .deckit-find-caret { transition: transform var(--deckit-fast) var(--deckit-easing); }
            .deckit-find-caret[aria-expanded='true'] { transform: rotate(90deg); }
            .deckit-find-indent { flex: 0 0 auto; width: 24px; }
        `;
    const CLEAR =
        '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" style="display:block">' +
        '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6" stroke-width="2.2" stroke-linecap="round"/></svg>';
    // The search options a find bar offers: the key it reports, its face and its tooltip.
    const OPTION = {
        case: ['caseSensitive', 'Aa', 'Match case'],
        word: ['word', 'ab', 'Whole word'],
        regex: ['regex', '.*', 'Regular expression'],
    };

    // MARK: - Initializer
    // MARK: - Public
    function make(theme, ui) {
        return { field, stepper, searchBar: (options) => searchBar(ui, options) };
    }

    // MARK: - Private
    // A text field. `inline` goes after the text, `trailing` after the clear button. Enter reports the value and
    // whether Shift was held; Escape is the field's only when `onEscape` takes it.
    function field({
        placeholder = '',
        value = '',
        icon = '',
        inline = [],
        trailing = [],
        size = 'md',
        clearable = false,
        onInput,
        onEnter,
        onEscape,
    } = {}) {
        const box = document.createElement('label');
        box.className = 'deckit-field';
        if (size === 'sm') box.dataset.size = 'small';
        if (icon) {
            box.dataset.icon = '';
            const glyph = document.createElement('span');
            glyph.className = 'deckit-field-icon';
            glyph.innerHTML = icon;
            box.append(glyph);
        }
        const input = document.createElement('input');
        input.className = 'deckit-field-input';
        input.spellcheck = false;
        input.placeholder = placeholder;
        input.value = value;
        const filled = () => box.toggleAttribute('data-filled', clearable && !!input.value);
        input.addEventListener('input', () => {
            filled();
            onInput?.(input.value);
        });
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' && onEnter) {
                event.preventDefault();
                onEnter(input.value, event.shiftKey);
            } else if (event.key === 'Escape' && onEscape) {
                event.preventDefault();
                event.stopPropagation();
                onEscape();
            }
        });
        box.append(input, ...inline);
        if (clearable) {
            const clear = document.createElement('button');
            clear.type = 'button';
            clear.className = 'deckit-field-clear';
            clear.title = 'Clear';
            clear.innerHTML = CLEAR;
            clear.addEventListener('mousedown', (event) => event.preventDefault());
            clear.addEventListener('click', (event) => {
                event.preventDefault();
                input.value = '';
                filled();
                onInput?.('');
                input.focus();
            });
            box.append(clear);
        }
        box.append(...trailing);
        box.input = input;
        box.setValue = (next) => {
            input.value = next;
            filled();
        };
        filled();
        return box;
    }

    // A number typed or stepped. Enter and leaving the field commit what is typed; Escape puts the value back.
    function stepper({ value = 0, min = -Infinity, max = Infinity, step = 1, unit = '', onChange } = {}) {
        const box = document.createElement('div');
        box.className = 'deckit-stepper';
        let current = value;
        const clamp = (number) => Math.min(max, Math.max(min, Math.round(number / step) * step));
        const input = document.createElement('input');
        input.className = 'deckit-stepper-input';
        input.spellcheck = false;
        const show = () => {
            input.value = String(+current.toFixed(4)) + unit;
        };
        const commit = (number) => {
            const next = clamp(Number.isFinite(number) ? number : current);
            const changed = next !== current;
            current = next;
            show();
            if (changed) onChange?.(current);
        };
        // From what is typed, if anything is: a step button keeps the focus, so nothing has committed it yet.
        const typed = () => {
            const number = parseFloat(input.value);
            return Number.isFinite(number) ? clamp(number) : current;
        };
        const buttonOf = (name, title, delta) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'deckit-button deckit-stepper-button';
            button.title = title;
            button.innerHTML = ICON.icon(name, 13);
            button.addEventListener('mousedown', (event) => event.preventDefault());
            button.addEventListener('click', () => commit(typed() + delta));
            return button;
        };
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                commit(parseFloat(input.value));
                input.blur();
            } else if (event.key === 'ArrowUp') commit(typed() + step);
            else if (event.key === 'ArrowDown') commit(typed() - step);
            else if (event.key === 'Escape') {
                event.stopPropagation();
                show();
                input.blur();
            } else return;
            event.preventDefault();
        });
        input.addEventListener('blur', () => commit(parseFloat(input.value)));
        box.append(buttonOf('minus', 'Less', -step), input, buttonOf('plus', 'More', step));
        show();
        Object.defineProperty(box, 'value', {
            get: () => current,
            set: (next) => {
                current = clamp(next);
                show();
            },
        });
        return box;
    }

    // A find field with its options, and with `nav` a count and previous and next, with `replace` a second line.
    // What it reports is read from its controls when asked: the text in the field and the options turned on.
    function searchBar(
        ui,
        {
            placeholder = 'Find',
            options = ['case', 'word', 'regex'],
            nav = false,
            replace = null,
            onChange,
            onNext,
            onPrev,
            onEscape,
        } = {}
    ) {
        const root = element('div', 'deckit-find');
        const toggles = options.map((name) => {
            const [key, label, title] = OPTION[name];
            const toggle = ui.toggleButton(label, title, { onChange: () => changed() });
            toggle.classList.add('deckit-find-option');
            toggle.dataset.option = key;
            return toggle;
        });
        const count = element('span', 'deckit-find-count');
        const find = field({
            placeholder,
            size: 'sm',
            icon: ICON.icon('search', 13),
            clearable: true,
            trailing: toggles,
            inline: nav ? [count] : [],
            onInput: () => changed(),
            onEnter: (_value, back) => (nav ? (back ? onPrev : onNext)?.() : changed()),
            onEscape: () => onEscape?.(),
        });
        const stateOf = () => ({
            query: find.input.value,
            ...Object.fromEntries(['caseSensitive', 'word', 'regex'].map((key) => [key, false])),
            ...Object.fromEntries(toggles.map((toggle) => [toggle.dataset.option, toggle.value])),
        });
        const changed = () => onChange?.(stateOf());

        const first = element('div', 'deckit-find-line');
        let open = !!replace?.open;
        let caret = null;
        if (replace) {
            caret = ui.iconBtn(ICON.icon('chevronRight', 14), 'Replace', () => setReplaceOpen(!open), { size: 'sm' });
            caret.classList.add('deckit-find-caret');
            first.append(caret);
        }
        first.append(find);
        if (nav) {
            first.append(
                ui.iconBtn(ICON.icon('chevronUp', 15), 'Previous (⇧↩)', () => onPrev?.(), { size: 'sm' }),
                ui.iconBtn(ICON.icon('chevronDown', 15), 'Next (↩)', () => onNext?.(), { size: 'sm' })
            );
        }
        root.append(first);

        let replacement = null;
        let second = null;
        if (replace) {
            second = element('div', 'deckit-find-line');
            replacement = field({
                placeholder: 'Replace',
                size: 'sm',
                icon: ICON.icon('replace', 13),
                onEnter: () => (replace.onReplace || replace.onReplaceAll)?.(),
                onEscape: () => onEscape?.(),
            });
            second.append(element('span', 'deckit-find-indent'), replacement);
            if (replace.onReplace)
                second.append(
                    ui.iconBtn(ICON.icon('replace', 15), 'Replace', () => replace.onReplace(), { size: 'sm' })
                );
            second.append(
                ui.iconBtn(ICON.icon('replaceAll', 15), 'Replace all', () => replace.onReplaceAll(), { size: 'sm' })
            );
            root.append(second);
        }
        const setReplaceOpen = (on, { focus = true } = {}) => {
            if (!replace) return;
            open = !!on;
            second.hidden = !open;
            caret.setAttribute('aria-expanded', String(open));
            caret.title = open ? 'Hide replace' : 'Replace';
            if (open && focus) replacement.input.focus();
        };
        setReplaceOpen(open, { focus: false });

        root.setQuery = (text, given = {}) => {
            find.setValue(text);
            for (const toggle of toggles) {
                if (toggle.dataset.option in given) toggle.value = !!given[toggle.dataset.option];
            }
        };
        root.focus = (which = 'find') => {
            const input = which === 'replace' && replacement ? replacement.input : find.input;
            input.focus();
            input.select();
        };
        root.setCount = (active, total) => {
            count.textContent = !find.input.value ? '' : total ? `${active || '–'}/${total}` : '0/0';
        };
        root.setReplaceOpen = setReplaceOpen;
        root.setCount(0, 0);
        Object.defineProperty(root, 'state', { get: stateOf });
        Object.defineProperty(root, 'replacement', { get: () => (replacement ? replacement.input.value : '') });
        return root;
    }

    function element(tag, className) {
        const made = document.createElement(tag);
        made.className = className;
        return made;
    }

    return { STYLE, make };
});
