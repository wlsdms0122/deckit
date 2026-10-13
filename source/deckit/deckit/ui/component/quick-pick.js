DeckitModule.define(
    'deckit/ui/component/quick-pick',
    { uses: ['deckit/ui/icon', 'deckit/ui/list', 'deckit/ui/list/listbox'], provides: ['STYLE', 'make'] },
    (ICON, LIST, LISTBOX) => {
        // MARK: - Property
        const STYLE = `
            .deckit-quick-pick-bar { display: flex; align-items: center; }
            .deckit-quick-pick-chip {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 0 0 auto;
                height: 28px;
                margin-left: 8px;
                padding: 0 10px;
                border-radius: var(--deckit-radius-control);
                background: var(--deckit-selected);
                font: 600 var(--deckit-type-medium);
                white-space: nowrap;
            }
            .deckit-quick-pick-chip[hidden] { display: none; }
            .deckit-quick-pick-chip svg { width: 15px; height: 15px; opacity: 0.85; }
            .deckit-quick-pick-field {
                flex: 1 1 auto;
                min-width: 0;
                width: 100%;
                box-sizing: border-box;
                height: 40px;
                padding: 0 12px;
                border: 0;
                border-radius: var(--deckit-radius-medium);
                outline: none;
                background: transparent;
                color: inherit;
                font: var(--deckit-type-heading);
            }
            .deckit-quick-pick-rule { margin: 2px 0 4px; border-top: var(--deckit-border); }
            .deckit-quick-pick-list { max-height: 44vh; overflow-y: auto; }
            .deckit-quick-pick-message { display: flex; align-items: center; gap: 8px; padding: 10px 12px; opacity: 0.45; }
            .deckit-quick-pick-message:empty { display: none; }
            .deckit-quick-pick-message[data-alert] { opacity: 1; color: var(--deckit-alert); }
            .deckit-quick-pick-note {
                margin-top: 4px;
                padding: 6px 12px 2px;
                border-top: var(--deckit-border);
                opacity: 0.5;
                font: var(--deckit-type-small);
            }
            .deckit-quick-pick-note:empty { display: none; }
        `;

        // MARK: - Initializer
        // MARK: - Public
        function make(theme, ui) {
            return { quickPick: (options) => quickPick(ui, options) };
        }

        // MARK: - Private
        // A field over a list to pick from, on a modal at the top of the page. The owner says what the list holds
        // (`set`), and hears what is typed (`onInput(text)`) and what is picked (`onPick(item, index)`). Items are drawn
        // by `key`, `create` and `update`, as a keyed list draws them; `optionOf(item)` is null for an item that is no
        // option (a heading), or else `{ disabled }`. The arrows move the active option and Enter picks it, or with
        // `onEnter({ item, text })` hands both to the owner. `onKey(event)` has a key first and returns whether it took
        // it. `onActive(item, index, { pointer })` hears the active option move, and `onCommandKey(held)` the Command
        // key held down in it or let go. The field keeps the focus: a press anywhere else on the card leaves it there.
        function quickPick(
            ui,
            {
                placeholder = '',
                value = '',
                width = 'min(520px, calc(100vw - 48px))',
                key,
                create,
                update = null,
                optionOf = () => ({ disabled: false }),
                onInput = () => {},
                onPick,
                onEnter = null,
                onKey = () => false,
                onActive = () => {},
                onCommandKey = () => {},
                onClose,
            }
        ) {
            const chip = element('span', 'deckit-quick-pick-chip');
            chip.hidden = true;
            const field = element('input', 'deckit-quick-pick-field');
            field.spellcheck = false;
            field.placeholder = placeholder;
            field.value = value;
            const box = element('div', 'deckit-quick-pick-list');
            const message = element('div', 'deckit-quick-pick-message');
            const note = element('div', 'deckit-quick-pick-note');
            const rows = LIST.list({ element: box, key, create, update });
            let options = []; // the items that are options, as the listbox counts them
            const listbox = LISTBOX.listbox(box, {
                onPick: (index) => onPick(options[index], index),
                onActivate: (index, { pointer }) => onActive(options[index], index, { pointer }),
            });
            field.addEventListener('input', () => onInput(field.value));
            field.addEventListener('keyup', (event) => event.key === 'Meta' && onCommandKey(false));
            field.addEventListener('blur', () => onCommandKey(false));
            const modal = ui.modal({
                chrome: false,
                align: 'top',
                width,
                onKey: handleKey,
                onClose,
                fill: (card) => {
                    card.addEventListener('mousedown', (event) => event.target !== field && event.preventDefault());
                    const bar = element('div', 'deckit-quick-pick-bar');
                    bar.append(chip, field);
                    card.append(bar, element('div', 'deckit-quick-pick-rule'), box, message, note);
                    return field;
                },
            });

            // A key that composes text in an input method is the method's.
            function handleKey(event) {
                if (event.isComposing) return false;
                if (event.key === 'Meta') onCommandKey(true);
                if (onKey(event)) return true;
                if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && options.length) {
                    listbox.move(event.key === 'ArrowDown' ? 1 : -1);
                    return true;
                }
                if (event.key !== 'Enter') return false;
                const index = listbox.active();
                const item = index >= 0 ? options[index] : null;
                if (onEnter) onEnter({ item, text: field.value });
                else if (item) onPick(item, index);
                return true;
            }

            // `active` is the option made active, -1 for none; `message` is said under the list, after a spinner while
            // `loading` and as a failure with `alert`; `note` is at its foot.
            function set(
                items,
                { active = 0, message: said = '', note: noted = '', loading = false, alert = false } = {}
            ) {
                rows.set(items);
                options = items.filter((item) => optionOf(item));
                listbox.set(
                    options.map((item) => ({
                        element: rows.elementOf(key(item)),
                        disabled: !!optionOf(item).disabled,
                    })),
                    { active }
                );
                message.replaceChildren(...(loading ? [ui.spinner().element] : []), said);
                message.toggleAttribute('data-alert', alert);
                note.textContent = noted;
            }

            // What the field searches in, shown before it: `{ icon, label }`, the icon as SVG markup, or null for none.
            function setScope(scope) {
                chip.hidden = !scope;
                chip.replaceChildren(...(scope ? [ICON.sanitize(scope.icon), scope.label] : []));
            }

            // The text typed is the owner's to set too; one it sets is not heard as typed.
            return {
                text: () => field.value,
                setText: (text) => (field.value = text),
                setPlaceholder: (text) => (field.placeholder = text),
                setScope,
                // The field takes the keyboard with its text selected, to type over.
                focus: () => field.select(),
                set,
                move: (by) => listbox.move(by),
                active: () => listbox.active(),
                close: () => modal.close(),
            };
        }

        function element(tag, className) {
            const made = document.createElement(tag);
            made.className = className;
            return made;
        }

        return { STYLE, make };
    }
);
