DeckitModule.define(
    'deckit/ui/component/dialog',
    { uses: ['deckit/ui/icon', 'deckit/ui/component/part'], provides: ['STYLE', 'make'] },
    (ICON, PART) => {
        // MARK: - Property
        const STYLE = `
            .deckit-dialog-message { opacity: 0.7; line-height: 1.6; overflow-wrap: anywhere; margin-bottom: 8px; }
            .deckit-dialog-message[data-last],
            .deckit-dialog-content { margin-bottom: 18px; }
            .deckit-dialog[data-fields] .deckit-dialog-message[data-last],
            .deckit-dialog[data-fields] .deckit-dialog-content { margin-bottom: 14px; }
            .deckit-dialog[data-content] .deckit-dialog-message[data-last] { margin-bottom: 12px; }
            .deckit-dialog-switch {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                min-height: 30px;
                margin-bottom: 6px;
                cursor: pointer;
            }
            .deckit-dialog-field { display: block; margin-bottom: 14px; }
            .deckit-dialog-label { margin-bottom: 6px; opacity: 0.55; font: 700 var(--deckit-type-small); letter-spacing: 0.02em; }
            .deckit-input {
                width: 100%;
                box-sizing: border-box;
                height: 32px;
                padding: 0 10px;
                border: var(--deckit-border);
                border-radius: var(--deckit-radius-medium);
                outline: none;
                background: var(--deckit-fill);
                color: inherit;
                font: var(--deckit-type-medium);
            }
            .deckit-input:focus-visible { box-shadow: 0 0 0 2px var(--deckit-focus); }
            .deckit-swatches { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
            .deckit-swatch {
                flex: 0 0 auto;
                width: 22px;
                height: 22px;
                padding: 0;
                border: 0;
                border-radius: var(--deckit-radius-control);
                cursor: pointer;
                transition:
                    box-shadow var(--deckit-fast) var(--deckit-easing),
                    transform var(--deckit-fast) var(--deckit-easing);
            }
            .deckit-swatch[aria-pressed='true'] {
                box-shadow: 0 0 0 2px var(--deckit-background), 0 0 0 4px var(--deckit-swatch);
                transform: scale(1.08);
            }
            .deckit-swatch[hidden] { display: none; }
            .deckit-swatch-more {
                display: flex;
                align-items: center;
                justify-content: center;
                background: transparent;
                border: var(--deckit-border);
                color: inherit;
            }
        `;

        // MARK: - Initializer
        // MARK: - Public
        function make(theme, ui) {
            return { dialog: (options) => dialog(ui, options) };
        }

        // MARK: - Private
        // A modal that says something and asks for values: `fields` are { key, label, type, value, placeholder,
        // options }, a text field unless `type` is `switch` or `color`. `onConfirm` hears the values by key.
        function dialog(
            ui,
            {
                title,
                message,
                content = null,
                fields = [],
                confirmLabel = 'Save',
                cancelLabel = 'Cancel',
                extraLabel = null,
                onExtra = null,
                destructive = false,
                onConfirm,
                onClose,
            }
        ) {
            const values = {};
            return ui.sheet({
                title,
                confirmLabel,
                cancelLabel,
                destructive,
                extraLabel,
                onExtra,
                onClose,
                onConfirm: () => onConfirm?.(values),
                fill(card) {
                    card.classList.add('deckit-dialog');
                    card.toggleAttribute('data-fields', fields.length > 0);
                    card.toggleAttribute('data-content', !!content);
                    const paragraphs = (Array.isArray(message) ? message : [message]).filter(Boolean);
                    paragraphs.forEach((text, index) => {
                        const paragraph = element('div', 'deckit-dialog-message');
                        paragraph.textContent = text;
                        paragraph.toggleAttribute('data-last', index === paragraphs.length - 1);
                        card.append(PART.selectable(paragraph));
                    });
                    if (content) {
                        content.classList.add('deckit-dialog-content');
                        card.append(content);
                    }
                    let focus = null;
                    for (const field of fields) {
                        if (field.type === 'switch') {
                            values[field.key] = !!field.value;
                            card.append(switchOf(ui, field, values));
                            continue;
                        }
                        values[field.key] = field.value ?? '';
                        const wrap = element('label', 'deckit-dialog-field');
                        const name = element('div', 'deckit-dialog-label');
                        name.textContent = field.label;
                        wrap.append(name);
                        if (field.type === 'color') wrap.append(swatchesOf(ui, field, values));
                        else {
                            const input = inputOf(field, values);
                            wrap.append(input);
                            focus ??= input;
                        }
                        card.append(wrap);
                    }
                    return focus;
                },
            });
        }

        // Not a <label>: that would pass its click to the switch too, and turn it twice.
        function switchOf(ui, field, values) {
            const row = element('div', 'deckit-dialog-switch');
            const name = element('span', '');
            name.textContent = field.label;
            const control = ui.toggle({ on: values[field.key], onChange: (on) => (values[field.key] = on) });
            row.addEventListener('click', (event) => !control.contains(event.target) && control.click());
            row.append(name, control);
            return row;
        }

        // What was typed, as typed: a field that cares about spaces at the ends trims where it uses the value.
        function inputOf(field, values) {
            const input = element('input', 'deckit-input');
            input.value = values[field.key];
            input.placeholder = field.placeholder || '';
            input.spellcheck = false;
            input.addEventListener('input', () => (values[field.key] = input.value));
            return input;
        }

        // The presets, then one slot for a colour of one's own, so the row does not grow with each one tried.
        function swatchesOf(ui, field, values) {
            const presets = field.options || [];
            const swatches = element('div', 'deckit-swatches');
            const swatchOf = (color) => {
                const swatch = element('button', 'deckit-swatch');
                swatch.type = 'button';
                swatch.addEventListener('click', () => {
                    values[field.key] = swatch.dataset.color;
                    paint();
                });
                return swatch;
            };
            const paintSwatch = (swatch, color) => {
                swatch.dataset.color = color;
                swatch.title = color;
                swatch.style.background = color;
                swatch.style.setProperty('--deckit-swatch', color);
                swatch.setAttribute('aria-pressed', String(color === values[field.key]));
            };
            const preset = presets.map((color) => swatchOf(color));
            const custom = swatchOf(values[field.key]);
            const more = element('button', 'deckit-swatch deckit-swatch-more');
            more.type = 'button';
            more.title = 'Pick a custom colour';
            more.innerHTML = ICON.icon('plus', 14);
            PART.pressable(more);
            more.addEventListener('click', () =>
                ui.colorPicker({
                    value: values[field.key],
                    onPick: (picked) => {
                        values[field.key] = picked;
                        paint();
                    },
                })
            );
            const paint = () => {
                presets.forEach((color, index) => paintSwatch(preset[index], color));
                paintSwatch(custom, values[field.key]);
                custom.title = 'Custom colour';
                custom.hidden = presets.includes(values[field.key]);
            };
            swatches.append(...preset, custom, more);
            paint();
            return swatches;
        }

        function element(tag, className) {
            const made = document.createElement(tag);
            if (className) made.className = className;
            return made;
        }

        return { STYLE, make };
    }
);
