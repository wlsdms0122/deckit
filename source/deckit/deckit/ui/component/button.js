DeckitModule.define(
    'deckit/ui/component/button',
    {
        uses: ['deckit/ui/token', 'deckit/ui/color', 'deckit/ui/icon', 'deckit/ui/component/part'],
        provides: ['STYLE', 'make'],
    },
    (T, COLOR, ICON, K) => {
        const { MOTION } = T;
        const { icon } = ICON;
        const { pressable } = K;

        return {
            STYLE: '',
            make: (theme, ui, inner) => {
                return {
                    iconBtn(svg, title, onClick, { size = 'md', quiet = false } = {}) {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.title = title;
                        b.innerHTML = svg;
                        const box = size === 'sm' ? '24px' : '30px';
                        Object.assign(b.style, {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: box,
                            height: box,
                            borderRadius: size === 'sm' ? '6px' : '8px',
                            border: '0',
                            // No padding: the glyph is centred by flex, and the default padding set a floor under the width.
                            padding: '0',
                            background: 'transparent',
                            cursor: 'pointer',
                            flex: '0 0 auto',
                            transition:
                                `background-color ${MOTION.fast}ms ${MOTION.easing}, color ${MOTION.fast}ms ${MOTION.easing},` +
                                ` opacity ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        let over = false,
                            pressed = false,
                            enabled = true;
                        const rest = quiet ? theme.color.muted : theme.color.text;
                        const paint = () => {
                            b.style.color = !enabled
                                ? theme.color.disabled
                                : pressed
                                  ? theme.color.accent
                                  : over
                                    ? theme.color.text
                                    : rest;
                        };
                        b.addEventListener('mouseenter', () => {
                            over = true;
                            paint();
                        });
                        b.addEventListener('mouseleave', () => {
                            over = false;
                            paint();
                        });
                        pressable(b, theme);
                        b.addEventListener('click', onClick);
                        b.setPressed = (on) => {
                            pressed = !!on;
                            b.setAttribute('aria-pressed', String(pressed));
                            paint();
                            return b;
                        };
                        b.setEnabled = (on) => {
                            enabled = !!on;
                            b.disabled = !enabled;
                            b.style.cursor = enabled ? 'pointer' : 'default';
                            paint();
                            b.repaint?.();
                            return b;
                        };
                        b.setIcon = (next) => {
                            b.innerHTML = next;
                            return b;
                        };
                        paint();
                        return b;
                    },
                    textBtn(text, title, onClick, { size = 'md', icon: glyph = '', variant = 'plain' } = {}) {
                        const b = document.createElement('button');
                        b.type = 'button';
                        if (title) b.title = title;
                        const label = document.createElement('span');
                        label.textContent = text;
                        if (glyph) b.insertAdjacentHTML('afterbegin', glyph);
                        b.appendChild(label);
                        Object.assign(b.style, {
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            flex: '0 0 auto',
                            height: size === 'sm' ? '24px' : '30px',
                            padding: size === 'sm' ? '0 9px' : '0 11px',
                            borderRadius: size === 'sm' ? '7px' : '8px',
                            border: theme.border,
                            background: 'transparent',
                            color: theme.color.text,
                            cursor: 'pointer',
                            font: (size === 'sm' ? '12px ' : '13px ') + theme.font,
                            transition: `background-color ${MOTION.fast}ms ${MOTION.easing}, filter ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        const fill =
                            variant === 'primary'
                                ? theme.color.accent
                                : variant === 'destructive'
                                  ? theme.color.alert
                                  : null;
                        if (fill) {
                            // A filled button keeps its colour and answers the pointer in brightness; the kit's press would paint over the fill.
                            Object.assign(b.style, { border: '0', background: fill, color: '#fff' });
                            let over = false,
                                down = false;
                            const light = () => {
                                b.style.filter = b.disabled
                                    ? 'none'
                                    : down
                                      ? 'brightness(.92)'
                                      : over
                                        ? 'brightness(1.1)'
                                        : 'none';
                            };
                            b.addEventListener('mouseenter', () => {
                                over = true;
                                light();
                            });
                            b.addEventListener('mouseleave', () => {
                                over = down = false;
                                light();
                            });
                            b.addEventListener('mousedown', () => {
                                down = true;
                                light();
                            });
                            b.addEventListener('mouseup', () => {
                                down = false;
                                light();
                            });
                            b.repaint = light;
                        } else {
                            pressable(b, theme);
                        }
                        b.addEventListener('click', onClick);
                        b.setText = (next) => {
                            label.textContent = next;
                            return b;
                        };
                        b.setEnabled = (on) => {
                            b.disabled = !on;
                            if (fill) b.style.background = on ? fill : theme.color.disabled;
                            else b.style.color = on ? theme.color.text : theme.color.disabled;
                            b.style.cursor = on ? 'pointer' : 'default';
                            b.repaint?.();
                            return b;
                        };
                        return b;
                    },
                    miniBtn(label, title, onClick) {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.title = title;
                        if (/^\s*<svg/.test(label)) b.innerHTML = label;
                        else b.textContent = label;
                        Object.assign(b.style, {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '22px',
                            height: '22px',
                            flex: '0 0 auto',
                            border: '0',
                            borderRadius: '6px',
                            background: 'transparent',
                            color: 'inherit',
                            cursor: 'pointer',
                            opacity: '0',
                            padding: '0',
                            font: '13px ' + theme.font,
                            lineHeight: '1',
                            transition: `opacity ${MOTION.fast}ms ${MOTION.easing}, background-color ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        b.dataset.deckitReveal = '';
                        pressable(b, theme);
                        b.addEventListener('click', (e) => {
                            e.stopPropagation();
                            onClick();
                        });
                        return b;
                    },
                    segmented(items, { value = null, onChange, size = 'md', accent = null } = {}) {
                        const bar = document.createElement('div');
                        Object.assign(bar.style, {
                            display: 'flex',
                            flex: '0 0 auto',
                            border: theme.border,
                            borderRadius: '8px',
                            overflow: 'hidden',
                        });
                        const buttons = new Map(); // key -> { b, lead, text, over }
                        let current = value;
                        const paintOne = (key, e) => {
                            const on = key === current;
                            e.b.setAttribute('aria-pressed', String(on));
                            e.b.style.background = on
                                ? accent || theme.color.selected
                                : e.over
                                  ? theme.color.hover
                                  : 'transparent';
                            e.b.style.color = on ? (accent ? '#fff' : theme.color.text) : theme.color.muted;
                        };
                        const paint = () => {
                            for (const [key, e] of buttons) paintOne(key, e);
                        };
                        const setItems = (list) => {
                            const keys = list.map((x) => x.key);
                            for (const [key, e] of buttons)
                                if (!keys.includes(key)) {
                                    e.b.remove();
                                    buttons.delete(key);
                                }
                            for (const item of list) {
                                let e = buttons.get(item.key);
                                if (!e) {
                                    const b = document.createElement('button');
                                    b.type = 'button';
                                    Object.assign(b.style, {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        border: '0',
                                        cursor: 'pointer',
                                        padding: size === 'sm' ? '3px 10px' : '4px 12px',
                                        font: (size === 'sm' ? '600 12px ' : '600 13px ') + theme.font,
                                        transition: `background-color ${MOTION.fast}ms ${MOTION.easing}, color ${MOTION.fast}ms ${MOTION.easing}`,
                                    });
                                    const text = document.createElement('span');
                                    b.append(text);
                                    e = { b, text, lead: null, over: false };
                                    b.addEventListener('mouseenter', () => {
                                        e.over = true;
                                        paintOne(item.key, e);
                                    });
                                    b.addEventListener('mouseleave', () => {
                                        e.over = false;
                                        paintOne(item.key, e);
                                    });
                                    b.addEventListener('click', () => {
                                        if (current === item.key) return;
                                        current = item.key;
                                        paint();
                                        onChange?.(item.key);
                                    });
                                    buttons.set(item.key, e);
                                }
                                e.text.textContent = item.label;
                                e.b.title = item.title || item.label;
                                if (item.lead !== e.lead) {
                                    e.lead?.remove();
                                    if (item.lead) e.b.prepend(item.lead);
                                    e.lead = item.lead || null;
                                }
                                bar.appendChild(e.b); // in the order given
                            }
                            paint();
                        };
                        setItems(items);
                        bar.setItems = setItems;
                        bar.setValue = (key) => {
                            current = key;
                            paint();
                        };
                        Object.defineProperty(bar, 'value', { get: () => current });
                        return bar;
                    },
                    toggleButton(label, title, { on = false, onChange } = {}) {
                        const b = document.createElement('button');
                        b.type = 'button';
                        b.title = title;
                        if (/^\s*<svg/.test(label)) b.innerHTML = label;
                        else b.textContent = label;
                        Object.assign(b.style, {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto',
                            minWidth: '22px',
                            height: '20px',
                            padding: '0 4px',
                            borderRadius: '5px',
                            border: '0',
                            cursor: 'pointer',
                            font: '600 11px ui-monospace, SFMono-Regular, Menlo, monospace',
                            background: 'transparent',
                            transition: `background-color ${MOTION.fast}ms ${MOTION.easing}, color ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        let value = !!on,
                            marked = false;
                        const paint = () => {
                            b.setAttribute('aria-pressed', String(value));
                            b.style.color = value || marked ? theme.color.accent : theme.color.muted;
                            b.style.background = value ? COLOR.alpha(theme.color.accent, 0.16) : 'transparent';
                        };
                        b.setMarked = (v) => {
                            marked = !!v;
                            paint();
                            return b;
                        };
                        b.addEventListener('mousedown', (e) => e.preventDefault()); // the field keeps the keyboard
                        b.addEventListener('click', (e) => {
                            e.preventDefault();
                            value = !value;
                            paint();
                            onChange?.(value);
                        });
                        Object.defineProperty(b, 'value', {
                            get: () => value,
                            set: (v) => {
                                value = !!v;
                                paint();
                            },
                        });
                        paint();
                        return b;
                    },
                    toggle({ on = false, onChange } = {}) {
                        const sw = document.createElement('button');
                        sw.type = 'button';
                        sw.setAttribute('role', 'switch');
                        Object.assign(sw.style, {
                            position: 'relative',
                            flex: '0 0 auto',
                            width: '34px',
                            height: '20px',
                            padding: '0',
                            borderRadius: '999px',
                            border: '0',
                            cursor: 'pointer',
                            transition: `background-color ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        const knob = document.createElement('span');
                        Object.assign(knob.style, {
                            position: 'absolute',
                            top: '2px',
                            left: '2px',
                            width: '16px',
                            height: '16px',
                            borderRadius: '999px',
                            background: '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,.3)',
                            transition: `transform ${MOTION.fast}ms ${MOTION.easing}`,
                        });
                        sw.appendChild(knob);
                        let value = !!on;
                        const paint = () => {
                            sw.setAttribute('aria-checked', String(value));
                            // Off is a solid grey: a track that lets the page through does not read as an object.
                            sw.style.background = value ? theme.color.accent : theme.color.disabled;
                            knob.style.transform = value ? 'translateX(14px)' : 'none';
                        };
                        sw.addEventListener('click', () => {
                            value = !value;
                            paint();
                            onChange?.(value);
                        });
                        Object.defineProperty(sw, 'value', {
                            get: () => value,
                            set: (v) => {
                                value = !!v;
                                paint();
                            },
                        });
                        paint();
                        return sw;
                    },
                    tip(el, text, chord) {
                        const say = () => {
                            const c = chord?.() || '';
                            el.title = c ? `${text} (${c})` : text;
                        };
                        say();
                        el.addEventListener('pointerenter', say);
                        return el;
                    },
                };
            },
        };
    }
);
