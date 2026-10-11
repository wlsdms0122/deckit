DeckitModule.define(
    'deckit/ui/component/dialog',
    {
        uses: ['deckit/ui/token'],
        provides: ['make'],
    },
    (TOKEN) => {
        const { MOTION, WASH, icon, pressable, selectable } = TOKEN;
        // Read from `ui` when a dialog opens, not when the kit is assembled, so load order does not matter.
        return {
            make: (theme, ui) => {
                return {
                    dialog({
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
                    }) {
                        const values = {};

                        const { toggle, colorPicker } = ui;
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
                                const paragraphs = (Array.isArray(message) ? message : [message]).filter(Boolean);
                                const after = fields.length ? '14px' : '18px';
                                paragraphs.forEach((text, i) => {
                                    const m = document.createElement('div');
                                    m.textContent = text;
                                    // Broken inside a word only when it is wider than the card (a path, an address).
                                    Object.assign(m.style, {
                                        opacity: '.7',
                                        lineHeight: '1.6',
                                        overflowWrap: 'anywhere',
                                        marginBottom: i < paragraphs.length - 1 ? '8px' : content ? '12px' : after,
                                    });
                                    selectable(m);
                                    card.appendChild(m);
                                });
                                if (content) {
                                    content.style.marginBottom = after;
                                    card.appendChild(content);
                                }

                                let firstInput = null;
                                for (const field of fields) {
                                    if (field.type === 'switch') {
                                        values[field.key] = !!field.value;
                                        // Not a <label>: that would pass its click to the switch too, and toggle it twice.
                                        const row = document.createElement('div');
                                        Object.assign(row.style, {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            gap: '12px',
                                            minHeight: '30px',
                                            marginBottom: '6px',
                                            cursor: 'pointer',
                                        });
                                        const name = document.createElement('span');
                                        name.textContent = field.label;
                                        Object.assign(name.style, { font: '14px ' + theme.font });
                                        const sw = toggle({
                                            on: values[field.key],
                                            onChange: (v) => {
                                                values[field.key] = v;
                                            },
                                        });
                                        row.addEventListener('click', (e) => {
                                            if (e.target !== sw && !sw.contains(e.target)) sw.click();
                                        });
                                        row.append(name, sw);
                                        card.appendChild(row);
                                        continue;
                                    }
                                    values[field.key] = field.value ?? '';
                                    const wrap = document.createElement('label');
                                    Object.assign(wrap.style, { display: 'block', marginBottom: '14px' });
                                    const name = document.createElement('div');
                                    name.textContent = field.label;
                                    Object.assign(name.style, {
                                        font: '700 12px ' + theme.font,
                                        opacity: '.55',
                                        marginBottom: '6px',
                                        letterSpacing: '.02em',
                                    });
                                    wrap.appendChild(name);

                                    if (field.type === 'color') {
                                        const swatches = document.createElement('div');
                                        Object.assign(swatches.style, {
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '8px',
                                            alignItems: 'center',
                                        });
                                        const swatch = (color) => {
                                            const b = document.createElement('button');
                                            b.type = 'button';
                                            b.dataset.color = color;
                                            b.title = color;
                                            Object.assign(b.style, {
                                                width: '22px',
                                                height: '22px',
                                                borderRadius: '6px',
                                                border: '0',
                                                background: color,
                                                cursor: 'pointer',
                                                padding: '0',
                                                flex: '0 0 auto',
                                                transition: `box-shadow ${MOTION.fast} ${MOTION.ease}, transform ${MOTION.fast} ${MOTION.ease}`,
                                            });
                                            b.addEventListener('click', () => {
                                                values[field.key] = color;
                                                paint();
                                            });
                                            return b;
                                        };
                                        // The presets, then one reused slot for a custom colour, so the row does not grow with each one tried.
                                        const custom = swatch(values[field.key]);
                                        custom.title = 'Custom colour';
                                        const more = document.createElement('button');
                                        more.type = 'button';
                                        more.innerHTML = icon('plus', 14);
                                        more.title = 'Pick a custom colour';
                                        Object.assign(more.style, {
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '22px',
                                            height: '22px',
                                            borderRadius: '6px',
                                            border: theme.border,
                                            background: 'transparent',
                                            color: 'inherit',
                                            cursor: 'pointer',
                                            padding: '0',
                                            flex: '0 0 auto',
                                            transition: `background-color ${MOTION.fast} ${MOTION.ease}`,
                                        });
                                        pressable(more, WASH.hover);
                                        more.addEventListener('click', () =>
                                            colorPicker({
                                                value: values[field.key],
                                                onPick: (picked) => {
                                                    values[field.key] = picked;
                                                    paint();
                                                },
                                            })
                                        );

                                        const paint = () => {
                                            const chosen = values[field.key];
                                            const preset = (field.options || []).includes(chosen);
                                            custom.style.display = preset ? 'none' : 'block';
                                            custom.dataset.color = chosen;
                                            custom.style.background = chosen;
                                            for (const b of swatches.children) {
                                                if (b === more) continue;
                                                const on = b.dataset.color === chosen;
                                                b.style.boxShadow = on
                                                    ? '0 0 0 2px ' + theme.contentBg + ', 0 0 0 4px ' + b.dataset.color
                                                    : 'none';
                                                b.style.transform = on ? 'scale(1.08)' : 'none';
                                            }
                                        };
                                        for (const color of field.options || []) swatches.appendChild(swatch(color));
                                        swatches.append(custom, more);
                                        paint();
                                        wrap.appendChild(swatches);
                                    } else {
                                        const input = document.createElement('input');
                                        input.value = values[field.key];
                                        input.placeholder = field.placeholder || '';
                                        input.spellcheck = false;
                                        Object.assign(input.style, {
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            height: '32px',
                                            padding: '0 10px',
                                            borderRadius: '8px',
                                            border: theme.border,
                                            background: 'rgba(128,128,128,.12)',
                                            color: 'inherit',
                                            font: '14px ' + theme.font,
                                            outline: 'none',
                                        });
                                        // What was typed, as typed: a field that cares about spaces at the ends trims where it uses the value.
                                        input.addEventListener('input', () => {
                                            values[field.key] = input.value;
                                        });
                                        wrap.appendChild(input);
                                        if (!firstInput) firstInput = input;
                                    }
                                    card.appendChild(wrap);
                                }
                                return firstInput;
                            },
                        });
                    },
                };
            },
        };
    }
);
